// ツリービュー ドラッグ&ドロップ(v2.1)のドラッグエンジン。
// Reactツリーの外側にある単純なモジュール状態として実装し、pointermoveのような高頻度イベントで
// ツリー全体が再レンダリングされるのを防ぐ(購読はuseSyncExternalStoreで行い、必要なコンポーネントだけ更新される)。

import type { Folder, Goal, Step, Todo } from '../types';
import type { DragKind, DropPlan } from './types';
import { INDENT_THRESHOLD, resolvePlan, type TargetRow } from './resolve';

const LONG_PRESS_MS = 250;
const MOVE_CANCEL_THRESHOLD = 8; // 長押し確定前にこれ以上動いたらキャンセル(スクロール意図とみなす)
const AUTOSCROLL_EDGE = 56;
const AUTOSCROLL_SPEED = 12;

export interface DataSnapshot {
  folders: Folder[];
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

export interface DragActions {
  moveFolder: (id: string, beforeId: string | null) => Promise<void>;
  moveGoal: (id: string, folderId: string | null, beforeId: string | null) => Promise<void>;
  moveStep: (id: string, goalId: string, beforeId: string | null) => Promise<void>;
  moveTodo: (id: string, stepId: string, beforeId: string | null) => Promise<void>;
  promoteTodoToStep: (todoId: string) => Promise<void>;
  demoteStepToTodo: (stepId: string, targetStepId: string) => Promise<void>;
  promoteStepToGoal: (stepId: string) => Promise<void>;
}

export interface OverlaySnapshot {
  active: boolean;
  kind: DragKind | null;
  id: string | null;
  pointerX: number;
  pointerY: number;
  deltaX: number;
  plan: DropPlan;
  indicator: { left: number; top: number; width: number } | null;
  badge: string | null;
  badgeVariant: 'move' | 'promote' | 'invalid' | null;
}

const NULL_OVERLAY: OverlaySnapshot = {
  active: false,
  kind: null,
  id: null,
  pointerX: 0,
  pointerY: 0,
  deltaX: 0,
  plan: { type: 'none' },
  indicator: null,
  badge: null,
  badgeVariant: null,
};

interface LowFreqSnapshot {
  draggingKind: DragKind | null;
  draggingId: string | null;
  shakeId: string | null;
}

const NULL_LOWFREQ: LowFreqSnapshot = { draggingKind: null, draggingId: null, shakeId: null };

let dataSnapshot: DataSnapshot = { folders: [], goals: [], steps: [], todos: [] };
let actions: DragActions | null = null;

let overlaySnapshot: OverlaySnapshot = NULL_OVERLAY;
let lowFreqSnapshot: LowFreqSnapshot = NULL_LOWFREQ;

const overlayListeners = new Set<() => void>();
const lowFreqListeners = new Set<() => void>();

function notifyOverlay() {
  for (const l of overlayListeners) l();
}
function notifyLowFreq() {
  for (const l of lowFreqListeners) l();
}

export function setDataSnapshot(snap: DataSnapshot) {
  dataSnapshot = snap;
}
export function setActions(a: DragActions) {
  actions = a;
}

export function subscribeOverlay(cb: () => void): () => void {
  overlayListeners.add(cb);
  return () => overlayListeners.delete(cb);
}
export function getOverlaySnapshot(): OverlaySnapshot {
  return overlaySnapshot;
}
export function subscribeLowFreq(cb: () => void): () => void {
  lowFreqListeners.add(cb);
  return () => lowFreqListeners.delete(cb);
}
export function getLowFreqSnapshot(): LowFreqSnapshot {
  return lowFreqSnapshot;
}

// ---- 内部セッション状態 ----
interface Session {
  kind: DragKind;
  id: string;
  pointerId: number;
  originX: number;
  gripEl: Element;
  lastClientX: number;
  lastClientY: number;
}

let session: Session | null = null;
let pending: { kind: DragKind; id: string; pointerId: number; startX: number; startY: number; timer: number } | null =
  null;

function reduceMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/**
 * オートスクロール対象を返す。レイアウト上 .app-main は overflow-y:auto だが、
 * .app-shell が min-height でコンテンツに合わせて伸びるため実際にはスクロールせず、
 * document(html)がスクローラーになる。実際にスクロール可能な要素を優先して返す。
 */
function findScrollContainer(): HTMLElement {
  const main = document.querySelector('.app-main') as HTMLElement | null;
  if (main && main.scrollHeight > main.clientHeight) return main;
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function findTargetRow(kind: DragKind, x: number, y: number): TargetRow | null {
  const el = document.elementFromPoint(x, y);
  if (!el) return null;
  let selector: string;
  if (kind === 'folder') selector = '[data-drag-row="folder"]';
  else if (kind === 'goal') selector = '[data-drag-row="goal"],[data-drag-row="folder"]';
  else if (kind === 'step') selector = '[data-drag-row="step"],[data-drag-row="goal"]';
  else selector = '[data-drag-row="todo"],[data-drag-row="step"]';
  const rowEl = el.closest(selector);
  if (!rowEl) return null;
  const type = rowEl.getAttribute('data-drag-row') as DragKind | null;
  const id = rowEl.getAttribute('data-drag-id');
  if (!type || !id) return null;
  const rect = rowEl.getBoundingClientRect();
  return { type, id, top: rect.top, bottom: rect.bottom };
}

function badgeFor(plan: DropPlan, kind: DragKind, deltaX: number): { text: string; variant: 'move' | 'promote' | 'invalid' } | null {
  switch (plan.type) {
    case 'promoteTodoToStep':
      return { text: '← 新しいステップに昇格', variant: 'promote' };
    case 'demoteStepToTodo':
      return { text: '→ 直前のステップのTodoに降格', variant: 'promote' };
    case 'promoteStepToGoal':
      return { text: '← ゴールに昇格', variant: 'promote' };
    case 'moveGoal':
      // ゴールの横ずらし(フォルダ出し入れ)は挿入線ではなくバッジで階層変化を示す
      if (kind === 'goal' && deltaX >= INDENT_THRESHOLD) return { text: '→ フォルダに入れる', variant: 'promote' };
      if (kind === 'goal' && deltaX <= -INDENT_THRESHOLD) return { text: '← フォルダから出す', variant: 'promote' };
      return null;
    case 'invalid':
      return { text: '✕ この操作はできません', variant: 'invalid' };
    default:
      return null;
  }
}

function computeIndicator(kind: DragKind, target: TargetRow | null, pointerY: number, plan: DropPlan, deltaX: number) {
  if (plan.type !== 'moveFolder' && plan.type !== 'moveGoal' && plan.type !== 'moveStep' && plan.type !== 'moveTodo') {
    return null;
  }
  // ゴールの横ずらし(フォルダ出し入れ)中は挿入線を出さない(バッジのみ)
  if (kind === 'goal' && Math.abs(deltaX) >= INDENT_THRESHOLD) return null;
  if (!target) return null;
  const sameKind = target.type === kind;
  const mid = (target.top + target.bottom) / 2;
  const y = sameKind ? (pointerY < mid ? target.top : target.bottom) : target.bottom;
  // インジケータの左右幅は対象行のDOM要素から直接取得する
  const rowEl = document.querySelector(`[data-drag-row="${target.type}"][data-drag-id="${target.id}"]`);
  const rect = rowEl?.getBoundingClientRect();
  return {
    left: rect ? rect.left : 0,
    top: y,
    width: rect ? rect.width : 0,
  };
}

// pointermoveイベント駆動で更新する(requestAnimationFrameはタブが非表示/非合成の環境で
// 発火しないことがあるため使わない。オートスクロールのみ、ポインタが静止していても
// 継続する必要があるので別途setIntervalで駆動する)。
function processMove() {
  if (!session) return;
  const { kind, id, originX, lastClientX, lastClientY } = session;
  const deltaX = lastClientX - originX;

  const target = findTargetRow(kind, lastClientX, lastClientY);
  const plan = resolvePlan({ kind, draggedId: id, target, pointerY: lastClientY, deltaX, state: dataSnapshot });
  const indicator = computeIndicator(kind, target, lastClientY, plan, deltaX);
  const badgeInfo = badgeFor(plan, kind, deltaX);

  overlaySnapshot = {
    active: true,
    kind,
    id,
    pointerX: lastClientX,
    pointerY: lastClientY,
    deltaX,
    plan,
    indicator,
    badge: badgeInfo?.text ?? null,
    badgeVariant: badgeInfo?.variant ?? null,
  };
  notifyOverlay();
}

function autoscrollTick() {
  if (!session) return;
  const y = session.lastClientY;
  const container = findScrollContainer();
  // documentがスクローラーの場合、判定エッジはビューポート基準(0〜innerHeight)
  const isDocument = container === document.scrollingElement || container === document.documentElement;
  const topEdge = isDocument ? 0 : container.getBoundingClientRect().top;
  const bottomEdge = isDocument ? window.innerHeight : container.getBoundingClientRect().bottom;
  if (y < topEdge + AUTOSCROLL_EDGE) {
    container.scrollTop -= AUTOSCROLL_SPEED;
  } else if (y > bottomEdge - AUTOSCROLL_EDGE) {
    container.scrollTop += AUTOSCROLL_SPEED;
  } else {
    return;
  }
  // スクロールした場合は対象行が動くので、インジケータ等を再計算する
  processMove();
}

let autoscrollTimer: number | null = null;

function beginDrag(kind: DragKind, id: string, pointerId: number, clientX: number, clientY: number, gripEl: Element) {
  session = {
    kind,
    id,
    pointerId,
    originX: clientX,
    gripEl,
    lastClientX: clientX,
    lastClientY: clientY,
  };
  try {
    (gripEl as Element & { setPointerCapture?: (id: number) => void }).setPointerCapture?.(pointerId);
  } catch {
    // setPointerCaptureが使えない環境では無視(通常のpointermove/upで継続)
  }
  lowFreqSnapshot = { draggingKind: kind, draggingId: id, shakeId: null };
  notifyLowFreq();
  document.body.classList.add('dnd-active');
  autoscrollTimer = window.setInterval(autoscrollTick, 40);
  processMove();
}

function endDrag(commit: boolean) {
  if (!session) return;
  const { kind, id } = session;
  if (autoscrollTimer !== null) {
    window.clearInterval(autoscrollTimer);
    autoscrollTimer = null;
  }
  const finalPlan = overlaySnapshot.plan;
  const finalKind = kind;
  const finalId = id;

  session = null;
  document.body.classList.remove('dnd-active');
  overlaySnapshot = NULL_OVERLAY;
  notifyOverlay();

  if (commit && actions) {
    void applyPlan(finalKind, finalId, finalPlan);
  } else if (finalPlan.type === 'invalid') {
    triggerShake(finalId);
  } else {
    lowFreqSnapshot = NULL_LOWFREQ;
    notifyLowFreq();
  }
}

function triggerShake(id: string) {
  const shakeMs = reduceMotion() ? 1 : 420;
  lowFreqSnapshot = { draggingKind: null, draggingId: null, shakeId: id };
  notifyLowFreq();
  window.setTimeout(() => {
    lowFreqSnapshot = NULL_LOWFREQ;
    notifyLowFreq();
  }, shakeMs);
}

async function applyPlan(_kind: DragKind, id: string, plan: DropPlan) {
  if (!actions) return;
  try {
    switch (plan.type) {
      case 'moveFolder':
        await actions.moveFolder(plan.id, plan.beforeId);
        break;
      case 'moveGoal':
        await actions.moveGoal(plan.id, plan.folderId, plan.beforeId);
        break;
      case 'moveStep':
        await actions.moveStep(plan.id, plan.goalId, plan.beforeId);
        break;
      case 'moveTodo':
        await actions.moveTodo(plan.id, plan.stepId, plan.beforeId);
        break;
      case 'promoteTodoToStep':
        await actions.promoteTodoToStep(plan.id);
        break;
      case 'demoteStepToTodo':
        await actions.demoteStepToTodo(plan.id, plan.targetStepId);
        break;
      case 'promoteStepToGoal':
        await actions.promoteStepToGoal(plan.id);
        break;
      case 'invalid':
        triggerShake(id);
        return;
      case 'none':
      default:
        break;
    }
  } catch (e) {
    console.error('[dnd] 移動処理に失敗しました', e);
  }
  lowFreqSnapshot = NULL_LOWFREQ;
  notifyLowFreq();
}

// ---- グローバルpointerイベント配線(1回だけ初期化) ----
let initialized = false;

export function initDragEngine() {
  if (initialized) return;
  initialized = true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).__dndDebug = { getOverlaySnapshot, getLowFreqSnapshot, getSession: () => session, getPending: () => pending };

  window.addEventListener(
    'pointermove',
    (e: PointerEvent) => {
      if (session && e.pointerId === session.pointerId) {
        session.lastClientX = e.clientX;
        session.lastClientY = e.clientY;
        e.preventDefault();
        processMove();
        return;
      }
      if (pending && e.pointerId === pending.pointerId) {
        const dx = Math.abs(e.clientX - pending.startX);
        const dy = Math.abs(e.clientY - pending.startY);
        if (dx > MOVE_CANCEL_THRESHOLD || dy > MOVE_CANCEL_THRESHOLD) {
          window.clearTimeout(pending.timer);
          pending = null;
        }
      }
    },
    { passive: false }
  );

  window.addEventListener('pointerup', (e: PointerEvent) => {
    if (session && e.pointerId === session.pointerId) {
      endDrag(true);
      return;
    }
    if (pending && e.pointerId === pending.pointerId) {
      window.clearTimeout(pending.timer);
      pending = null;
    }
  });

  window.addEventListener('pointercancel', (e: PointerEvent) => {
    if (session && e.pointerId === session.pointerId) {
      endDrag(false);
      return;
    }
    if (pending && e.pointerId === pending.pointerId) {
      window.clearTimeout(pending.timer);
      pending = null;
    }
  });
}

/** グリップのpointerdownから呼ばれる開始トリガー */
export function startGripPointerDown(kind: DragKind, id: string, e: React.PointerEvent) {
  if (e.pointerType === 'mouse' && e.button !== 0) return;
  const pointerId = e.pointerId;
  const clientX = e.clientX;
  const clientY = e.clientY;
  const gripEl = e.currentTarget as Element;

  if (e.pointerType === 'touch') {
    pending = {
      kind,
      id,
      pointerId,
      startX: clientX,
      startY: clientY,
      timer: window.setTimeout(() => {
        pending = null;
        beginDrag(kind, id, pointerId, clientX, clientY, gripEl);
      }, LONG_PRESS_MS),
    };
  } else {
    beginDrag(kind, id, pointerId, clientX, clientY, gripEl);
  }
}
