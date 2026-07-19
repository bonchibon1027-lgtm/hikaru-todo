// データモデル(SPEC.md準拠)

export type GoalStatus = 'active' | 'done' | 'archived';
export type StepStatus = 'active' | 'done';

export interface Folder {
  id: string;
  title: string;
  sortOrder: number;
  createdAt: string; // ISO datetime
}

export interface Goal {
  id: string;
  folderId: string | null; // v1.2追加。null = トップレベル
  title: string;
  sortOrder: number;
  status: GoalStatus;
  dueDate: string | null; // ISO date (YYYY-MM-DD) | null = 無期限
  createdAt: string; // ISO datetime
}

export interface Step {
  id: string;
  goalId: string;
  title: string;
  sortOrder: number;
  status: StepStatus;
  dueDate: string | null; // ISO date (YYYY-MM-DD) | null = 無期限(v3.1追加)
  createdAt: string;
}

export interface Todo {
  id: string;
  stepId: string;
  title: string;
  done: boolean;
  sortOrder: number;
  dueDate: string | null; // ISO date (YYYY-MM-DD) | null = 無期限(v3.1追加)
  createdAt: string;
  completedAt: string | null;
}

export interface AppData {
  folders: Folder[];
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

// ツリー表示用の集約型(リポジトリではなくUI層で計算)
export interface StepWithTodos extends Step {
  todos: Todo[];
}

export interface GoalWithChildren extends Goal {
  steps: StepWithTodos[];
}
