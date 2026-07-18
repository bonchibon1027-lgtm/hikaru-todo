import type { Folder, Goal, Step, Todo } from '../types';
import type { Repository } from './types';

const STORAGE_KEY = 'hikaru-todo-data';

export interface StoredData {
  folders: Folder[];
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

function emptyStoredData(): StoredData {
  return { folders: [], goals: [], steps: [], todos: [] };
}

/**
 * localStorageから読み込み、v1.2のマイグレーション(folders補完・goal.folderId補完)を行う。
 * 既存フィールド・未知フィールドはスプレッドで保持し、絶対に落とさない。
 * トップレベルJSONとして壊れている場合のみ例外を投げる(呼び出し側でエラー表示に留め、上書きしない)。
 */
function loadStorage(): StoredData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return emptyStoredData();

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('保存されているデータの形式が正しくありません(JSONの解析に失敗しました)');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('保存されているデータの形式が正しくありません');
  }

  const obj = parsed as Record<string, unknown>;

  const folders: Folder[] = Array.isArray(obj.folders) ? (obj.folders as Folder[]) : [];
  const goalsRaw = Array.isArray(obj.goals) ? (obj.goals as Array<Record<string, unknown>>) : [];
  // v1.2マイグレーション: folderIdが無いgoalにnullを補う(他のフィールドはスプレッドで保持)
  const goals: Goal[] = goalsRaw.map((g) => ({
    ...(g as unknown as Goal),
    folderId: (g.folderId as string | null | undefined) ?? null,
  }));
  const steps: Step[] = Array.isArray(obj.steps) ? (obj.steps as Step[]) : [];
  const todos: Todo[] = Array.isArray(obj.todos) ? (obj.todos as Todo[]) : [];

  return { folders, goals, steps, todos };
}

function saveStorage(data: StoredData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * ローカルストレージの生データを読み取る(v2追加。クラウド移行バナー用)。
 * LocalRepositoryのインスタンス状態とは独立していて、呼び出しても副作用はない。
 * 読み込みに失敗した場合は null を返す(呼び出し側でエラー扱いにする)。
 */
export function readLocalSnapshot(): StoredData | null {
  try {
    return loadStorage();
  } catch {
    return null;
  }
}

/** ローカルにフォルダまたはゴールが1件以上あるか(移行バナーの表示判定用) */
export function hasLocalData(snapshot: StoredData | null): boolean {
  if (!snapshot) return false;
  return snapshot.folders.length > 0 || snapshot.goals.length > 0;
}

function nowIso(): string {
  return new Date().toISOString();
}

export class LocalRepository implements Repository {
  private data: StoredData;

  constructor() {
    // 初期化時の例外でアプリ全体をクラッシュさせない。実際のエラー通知は loadAll() 側で行う。
    try {
      this.data = loadStorage();
    } catch {
      this.data = emptyStoredData();
    }
  }

  async loadAll() {
    // ここで例外が発生した場合は呼び出し元(DataContext)がcatchしてエラー表示する。
    // 何も上書きしていないので既存のlocalStorageの内容は保持されたまま。
    this.data = loadStorage();
    return {
      folders: [...this.data.folders],
      goals: [...this.data.goals],
      steps: [...this.data.steps],
      todos: [...this.data.todos],
    };
  }

  private persist() {
    saveStorage(this.data);
  }

  // ---- Folder ----
  async createFolder(input: { title: string }): Promise<Folder> {
    const maxSort = this.data.folders.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    const folder: Folder = {
      id: crypto.randomUUID(),
      title: input.title,
      sortOrder: maxSort + 1,
      createdAt: nowIso(),
    };
    this.data.folders.push(folder);
    this.persist();
    return folder;
  }

  async updateFolder(id: string, patch: Partial<Pick<Folder, 'title' | 'sortOrder'>>): Promise<void> {
    // 既存オブジェクトをin-placeでmutateしない(呼び出し元がloadAll()で受け取った
    // 「更新前」の配列/オブジェクト参照を後から書き換えてしまうバグを防ぐため、常に新規オブジェクトで置き換える)
    const idx = this.data.folders.findIndex((f) => f.id === id);
    if (idx === -1) return;
    this.data.folders[idx] = { ...this.data.folders[idx], ...patch };
    this.persist();
  }

  async deleteFolder(id: string): Promise<void> {
    // 配下ゴールは削除せずトップレベルに戻す
    this.data.goals = this.data.goals.map((g) => (g.folderId === id ? { ...g, folderId: null } : g));
    this.data.folders = this.data.folders.filter((f) => f.id !== id);
    this.persist();
  }

  // ---- Goal ----
  async createGoal(input: { title: string; dueDate: string | null; folderId?: string | null }): Promise<Goal> {
    const maxSort = this.data.goals.reduce((m, g) => Math.max(m, g.sortOrder), -1);
    const goal: Goal = {
      id: crypto.randomUUID(),
      folderId: input.folderId ?? null,
      title: input.title,
      sortOrder: maxSort + 1,
      status: 'active',
      dueDate: input.dueDate,
      createdAt: nowIso(),
    };
    this.data.goals.push(goal);
    this.persist();
    return goal;
  }

  async updateGoal(
    id: string,
    patch: Partial<Pick<Goal, 'title' | 'dueDate' | 'status' | 'sortOrder' | 'folderId'>>
  ): Promise<void> {
    // in-place mutateしない(理由はupdateFolder参照)
    const idx = this.data.goals.findIndex((g) => g.id === id);
    if (idx === -1) return;
    this.data.goals[idx] = { ...this.data.goals[idx], ...patch };
    this.persist();
  }

  async deleteGoal(id: string): Promise<void> {
    const stepIds = this.data.steps.filter((s) => s.goalId === id).map((s) => s.id);
    this.data.todos = this.data.todos.filter((t) => !stepIds.includes(t.stepId));
    this.data.steps = this.data.steps.filter((s) => s.goalId !== id);
    this.data.goals = this.data.goals.filter((g) => g.id !== id);
    this.persist();
  }

  async createStep(input: { goalId: string; title: string }): Promise<Step> {
    const maxSort = this.data.steps
      .filter((s) => s.goalId === input.goalId)
      .reduce((m, s) => Math.max(m, s.sortOrder), -1);
    const step: Step = {
      id: crypto.randomUUID(),
      goalId: input.goalId,
      title: input.title,
      sortOrder: maxSort + 1,
      status: 'active',
      createdAt: nowIso(),
    };
    this.data.steps.push(step);
    this.persist();
    return step;
  }

  async updateStep(id: string, patch: Partial<Pick<Step, 'title' | 'status' | 'sortOrder' | 'goalId'>>): Promise<void> {
    // in-place mutateしない(理由はupdateFolder参照)
    const idx = this.data.steps.findIndex((s) => s.id === id);
    if (idx === -1) return;
    this.data.steps[idx] = { ...this.data.steps[idx], ...patch };
    this.persist();
  }

  async deleteStep(id: string): Promise<void> {
    this.data.todos = this.data.todos.filter((t) => t.stepId !== id);
    this.data.steps = this.data.steps.filter((s) => s.id !== id);
    this.persist();
  }

  async createTodo(input: { stepId: string; title: string }): Promise<Todo> {
    const maxSort = this.data.todos
      .filter((t) => t.stepId === input.stepId)
      .reduce((m, t) => Math.max(m, t.sortOrder), -1);
    const todo: Todo = {
      id: crypto.randomUUID(),
      stepId: input.stepId,
      title: input.title,
      done: false,
      sortOrder: maxSort + 1,
      createdAt: nowIso(),
      completedAt: null,
    };
    this.data.todos.push(todo);
    this.persist();
    return todo;
  }

  async updateTodo(
    id: string,
    patch: Partial<Pick<Todo, 'title' | 'done' | 'sortOrder' | 'completedAt' | 'stepId'>>
  ): Promise<void> {
    // in-place mutateしない(理由はupdateFolder参照)
    const idx = this.data.todos.findIndex((t) => t.id === id);
    if (idx === -1) return;
    this.data.todos[idx] = { ...this.data.todos[idx], ...patch };
    this.persist();
  }

  async deleteTodo(id: string): Promise<void> {
    this.data.todos = this.data.todos.filter((t) => t.id !== id);
    this.persist();
  }

  // ---- アンドゥ用の復元(v3追加。ID保持で挿入/上書き) ----
  async restoreFolder(folder: Folder): Promise<void> {
    const idx = this.data.folders.findIndex((f) => f.id === folder.id);
    if (idx === -1) this.data.folders.push({ ...folder });
    else this.data.folders[idx] = { ...folder };
    this.persist();
  }

  async restoreGoal(goal: Goal): Promise<void> {
    const idx = this.data.goals.findIndex((g) => g.id === goal.id);
    if (idx === -1) this.data.goals.push({ ...goal });
    else this.data.goals[idx] = { ...goal };
    this.persist();
  }

  async restoreStep(step: Step): Promise<void> {
    const idx = this.data.steps.findIndex((s) => s.id === step.id);
    if (idx === -1) this.data.steps.push({ ...step });
    else this.data.steps[idx] = { ...step };
    this.persist();
  }

  async restoreTodo(todo: Todo): Promise<void> {
    const idx = this.data.todos.findIndex((t) => t.id === todo.id);
    if (idx === -1) this.data.todos.push({ ...todo });
    else this.data.todos[idx] = { ...todo };
    this.persist();
  }
}
