import type { Folder, Goal, Step, Todo } from '../types';
import type { DragKind, DropPlan } from './types';

export const INDENT_THRESHOLD = 40;

export interface TargetRow {
  type: DragKind;
  id: string;
  top: number;
  bottom: number;
}

interface StateSnapshot {
  folders: Folder[];
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

function isAbove(target: TargetRow, pointerY: number): boolean {
  const mid = (target.top + target.bottom) / 2;
  return pointerY < mid;
}

/** targetIdの直前(above=true)または直後(above=false)にドラッグ対象を挿入する場合のbeforeIdを求める */
function beforeIdForInsertion(sortedSiblings: { id: string }[], targetId: string, above: boolean): string | null {
  const idx = sortedSiblings.findIndex((s) => s.id === targetId);
  if (idx === -1) return null;
  if (above) return sortedSiblings[idx].id;
  const next = sortedSiblings[idx + 1];
  return next ? next.id : null;
}

function byOrder<T extends { sortOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * 現在のポインタ位置・X変位・データ状態からドロップ操作プランを算出する(純粋関数、DOM非依存)。
 * target は DragContext 側で document.elementFromPoint + closest() を使って求めた「一番近い行」。
 */
export function resolvePlan(params: {
  kind: DragKind;
  draggedId: string;
  target: TargetRow | null;
  pointerY: number;
  deltaX: number;
  state: StateSnapshot;
}): DropPlan {
  const { kind, draggedId, target, pointerY, deltaX, state } = params;

  if (kind === 'folder') {
    if (!target || target.type !== 'folder') return { type: 'none' };
    if (target.id === draggedId) return { type: 'none' };
    const siblings = byOrder(state.folders.filter((f) => f.id !== draggedId));
    const beforeId = beforeIdForInsertion(siblings, target.id, isAbove(target, pointerY));
    return { type: 'moveFolder', id: draggedId, beforeId };
  }

  if (kind === 'goal') {
    const draggedGoal = state.goals.find((g) => g.id === draggedId);
    if (!draggedGoal) return { type: 'invalid' };

    if (deltaX >= INDENT_THRESHOLD) {
      // ゴール→右: 直前(上)にあるフォルダ(またはフォルダ内ゴール)に入る。
      // ポインタが他のフォルダ/フォルダ内ゴールの上にあればそのフォルダを優先し、
      // そうでなければSPECの規則どおり「元の位置の直前(上)にあるフォルダ」を採用する。
      let destFolderId: string | null = null;
      if (target && target.id !== draggedId) {
        if (target.type === 'folder') {
          destFolderId = target.id;
        } else if (target.type === 'goal') {
          const targetGoal = state.goals.find((g) => g.id === target.id);
          if (targetGoal && targetGoal.folderId !== null) destFolderId = targetGoal.folderId;
        }
      }
      if (destFolderId === null) {
        // ツリーの表示順はフォルダ群→トップレベルゴール群。したがって「直前(上)がフォルダ
        // (またはフォルダ内ゴール)」になるのは先頭のトップレベルゴールだけで、その場合は最後のフォルダに入る。
        if (draggedGoal.folderId === null) {
          const topLevel = byOrder(state.goals.filter((g) => g.folderId === null));
          const idx = topLevel.findIndex((g) => g.id === draggedId);
          const sortedFolders = byOrder(state.folders);
          if (idx === 0 && sortedFolders.length > 0) {
            destFolderId = sortedFolders[sortedFolders.length - 1].id;
          }
        }
      }
      // 直前にフォルダがない、または既に自分が属しているフォルダへの「入る」は無効
      if (destFolderId === null || destFolderId === draggedGoal.folderId) return { type: 'invalid' };
      return { type: 'moveGoal', id: draggedId, folderId: destFolderId, beforeId: null };
    }

    if (deltaX <= -INDENT_THRESHOLD) {
      // ゴール→左: フォルダから出てトップレベルへ
      if (draggedGoal.folderId === null) return { type: 'invalid' };
      return { type: 'moveGoal', id: draggedId, folderId: null, beforeId: null };
    }

    // 縦ドラッグのみ: フォルダ領域内に落とすと入る、外に落とすと出る
    if (!target) return { type: 'none' };
    if (target.type === 'folder') {
      // フォルダの行自体(ヘッダー等)にドロップ = 末尾に追加
      return { type: 'moveGoal', id: draggedId, folderId: target.id, beforeId: null };
    }
    if (target.type === 'goal') {
      if (target.id === draggedId) return { type: 'none' };
      const targetGoal = state.goals.find((g) => g.id === target.id);
      if (!targetGoal) return { type: 'none' };
      const siblings = byOrder(state.goals.filter((g) => g.folderId === targetGoal.folderId && g.id !== draggedId));
      const beforeId = beforeIdForInsertion(siblings, target.id, isAbove(target, pointerY));
      return { type: 'moveGoal', id: draggedId, folderId: targetGoal.folderId, beforeId };
    }
    return { type: 'none' };
  }

  if (kind === 'step') {
    const draggedStep = state.steps.find((s) => s.id === draggedId);
    if (!draggedStep) return { type: 'invalid' };

    if (deltaX >= INDENT_THRESHOLD) {
      // ステップ→右: 直前のステップのTodoに降格
      const siblingSteps = byOrder(state.steps.filter((s) => s.goalId === draggedStep.goalId));
      const idx = siblingSteps.findIndex((s) => s.id === draggedId);
      const prev = idx > 0 ? siblingSteps[idx - 1] : null;
      if (!prev) return { type: 'invalid' };
      return { type: 'demoteStepToTodo', id: draggedId, targetStepId: prev.id };
    }

    if (deltaX <= -INDENT_THRESHOLD) {
      // ステップ→左: ゴールに昇格
      return { type: 'promoteStepToGoal', id: draggedId };
    }

    if (!target) return { type: 'none' };
    if (target.type === 'goal') {
      return { type: 'moveStep', id: draggedId, goalId: target.id, beforeId: null };
    }
    if (target.type === 'step') {
      if (target.id === draggedId) return { type: 'none' };
      const targetStep = state.steps.find((s) => s.id === target.id);
      if (!targetStep) return { type: 'none' };
      const siblings = byOrder(state.steps.filter((s) => s.goalId === targetStep.goalId && s.id !== draggedId));
      const beforeId = beforeIdForInsertion(siblings, target.id, isAbove(target, pointerY));
      return { type: 'moveStep', id: draggedId, goalId: targetStep.goalId, beforeId };
    }
    return { type: 'none' };
  }

  // kind === 'todo'
  const draggedTodo = state.todos.find((t) => t.id === draggedId);
  if (!draggedTodo) return { type: 'invalid' };

  if (deltaX <= -INDENT_THRESHOLD) {
    // Todo→左: 同ゴール内で新しいステップに昇格
    return { type: 'promoteTodoToStep', id: draggedId };
  }

  if (!target) return { type: 'none' };
  if (target.type === 'step') {
    return { type: 'moveTodo', id: draggedId, stepId: target.id, beforeId: null };
  }
  if (target.type === 'todo') {
    if (target.id === draggedId) return { type: 'none' };
    const targetTodo = state.todos.find((t) => t.id === target.id);
    if (!targetTodo) return { type: 'none' };
    const siblings = byOrder(state.todos.filter((t) => t.stepId === targetTodo.stepId && t.id !== draggedId));
    const beforeId = beforeIdForInsertion(siblings, target.id, isAbove(target, pointerY));
    return { type: 'moveTodo', id: draggedId, stepId: targetTodo.stepId, beforeId };
  }
  return { type: 'none' };
}
