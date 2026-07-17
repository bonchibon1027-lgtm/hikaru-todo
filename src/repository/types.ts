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
  updateStep(id: string, patch: Partial<Pick<Step, 'title' | 'status' | 'sortOrder'>>): Promise<void>;
  deleteStep(id: string): Promise<void>;

  createTodo(input: { stepId: string; title: string }): Promise<Todo>;
  updateTodo(id: string, patch: Partial<Pick<Todo, 'title' | 'done' | 'sortOrder' | 'completedAt'>>): Promise<void>;
  deleteTodo(id: string): Promise<void>;
}
