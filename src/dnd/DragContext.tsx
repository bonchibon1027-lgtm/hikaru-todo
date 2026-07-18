import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react';
import { useData } from '../context/DataContext';
import type { DragKind } from './types';
import {
  getLowFreqSnapshot,
  getOverlaySnapshot,
  initDragEngine,
  setActions,
  setDataSnapshot,
  startGripPointerDown,
  subscribeLowFreq,
  subscribeOverlay,
} from './dragStore';

interface DragRowUiState {
  isDragging: boolean;
  isShaking: boolean;
}

const DragLowFreqContext = createContext<{ draggingKind: DragKind | null; draggingId: string | null; shakeId: string | null }>({
  draggingKind: null,
  draggingId: null,
  shakeId: null,
});

/** TreeView配下をこれで包み、D&Dエンジンをデータ層(DataContext)に接続する */
export function DragProvider({ children }: { children: ReactNode }) {
  const data = useData();

  useEffect(() => {
    initDragEngine();
  }, []);

  // 最新のデータ・アクションをモジュール外部ストアへ都度反映(pointermoveの度にReactツリーを再構築しないため)
  setDataSnapshot({ folders: data.folders, goals: data.goals, steps: data.steps, todos: data.todos });
  setActions({
    moveFolder: data.moveFolder,
    moveGoal: data.moveGoal,
    moveStep: data.moveStep,
    moveTodo: data.moveTodo,
    promoteTodoToStep: data.promoteTodoToStep,
    demoteStepToTodo: data.demoteStepToTodo,
    promoteStepToGoal: data.promoteStepToGoal,
  });

  const lowFreq = useSyncExternalStore(subscribeLowFreq, getLowFreqSnapshot);

  return (
    <DragLowFreqContext.Provider value={lowFreq}>
      {children}
      <DragOverlay />
    </DragLowFreqContext.Provider>
  );
}

/** 行コンポーネント(Folder/Goal/Step/Todo)がグリップをつなぐためのフック */
export function useDragHandle(kind: DragKind, id: string) {
  const onPointerDown = (e: React.PointerEvent) => {
    startGripPointerDown(kind, id, e);
  };
  return { onPointerDown };
}

/** 行コンポーネントが自分がドラッグ中/揺れ中かを知るためのフック(低頻度更新のみ購読) */
export function useDragRowState(kind: DragKind, id: string): DragRowUiState {
  const ctx = useContext(DragLowFreqContext);
  return {
    isDragging: ctx.draggingKind === kind && ctx.draggingId === id,
    isShaking: ctx.shakeId === id,
  };
}

/** ドラッグ中のインジケータ線・バッジを描画する(高頻度更新はここだけに閉じ込める) */
function DragOverlay() {
  const overlay = useSyncExternalStore(subscribeOverlay, getOverlaySnapshot);

  if (!overlay.active) return null;

  return (
    <>
      {overlay.indicator && (
        <div
          className="dnd-indicator-line"
          style={{
            left: overlay.indicator.left,
            top: overlay.indicator.top,
            width: overlay.indicator.width,
          }}
        />
      )}
      {overlay.badge && (
        <div
          className={`dnd-badge${overlay.badgeVariant === 'invalid' ? ' dnd-badge--invalid' : ''}`}
          style={{ left: overlay.pointerX, top: overlay.pointerY }}
        >
          {overlay.badge}
        </div>
      )}
    </>
  );
}
