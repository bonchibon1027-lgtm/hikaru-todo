// ツリービュー ドラッグ&ドロップ(v2.1)の型定義

export type DragKind = 'folder' | 'goal' | 'step' | 'todo';

export interface DragDescriptor {
  kind: DragKind;
  id: string;
}

/**
 * ドロップ時に実行する操作のプラン。
 * resolvePlan() が現在のポインタ位置・X変位・データ状態から算出する。
 * DragContext はこのプランを見てインジケータを描画し、ドロップ時に対応する
 * DataContext のメソッドを呼び出す。
 */
export type DropPlan =
  | { type: 'moveFolder'; id: string; beforeId: string | null }
  | { type: 'moveGoal'; id: string; folderId: string | null; beforeId: string | null }
  | { type: 'moveStep'; id: string; goalId: string; beforeId: string | null }
  | { type: 'moveTodo'; id: string; stepId: string; beforeId: string | null }
  | { type: 'promoteTodoToStep'; id: string }
  | { type: 'demoteStepToTodo'; id: string; targetStepId: string }
  | { type: 'promoteStepToGoal'; id: string }
  | { type: 'invalid' }
  | { type: 'none' };
