import type { Folder, Goal, Step, Todo } from '../types';

// データ永続化層のインターフェース。LocalRepository / SupabaseRepository が実装する。
export interface Repository {
  /** 初期データを一括取得 */
  loadAll(): Promise<{ folders: Folder[]; goals: Goal[]; steps: Step[]; todos: Todo[] }>;

  createFolder(input: { title: string }): Promise<Folder>;
  updateFolder(id: string, patch: Partial<Pick<Folder, 'title' | 'sortOrder'>>): Promise<void>;
  deleteFolder(id: string): Promise<void>;

  createGoal(input: { title: string; dueDate: string | null; folderId?: string | null }): Promise<Goal>;
  updateGoal(
    id: string,
    patch: Partial<Pick<Goal, 'title' | 'dueDate' | 'status' | 'sortOrder' | 'folderId'>>
  ): Promise<void>;
  deleteGoal(id: string): Promise<void>;

  createStep(input: { goalId: string; title: string }): Promise<Step>;
  // goalId はv2.1(ドラッグ&ドロップ)で追加。別ゴールへの移動時にステップの所属を付け替えるために必要。
  updateStep(id: string, patch: Partial<Pick<Step, 'title' | 'status' | 'sortOrder' | 'goalId'>>): Promise<void>;
  deleteStep(id: string): Promise<void>;

  createTodo(input: { stepId: string; title: string }): Promise<Todo>;
  // stepId はv2.1(ドラッグ&ドロップ)で追加。別ステップへの移動時にTodoの所属を付け替えるために必要。
  updateTodo(
    id: string,
    patch: Partial<Pick<Todo, 'title' | 'done' | 'sortOrder' | 'completedAt' | 'stepId'>>
  ): Promise<void>;
  deleteTodo(id: string): Promise<void>;

  // ---- アンドゥ用の復元(v3追加) ----
  // 指定したIDのまま挿入(存在しなければ作成、存在すれば全フィールドを上書き)する。
  // undoStack.ts のスナップショットをRepository経由で復元するために使う(ID保持のため通常のcreateXは使えない)。
  restoreFolder(folder: Folder): Promise<void>;
  restoreGoal(goal: Goal): Promise<void>;
  restoreStep(step: Step): Promise<void>;
  restoreTodo(todo: Todo): Promise<void>;
}
