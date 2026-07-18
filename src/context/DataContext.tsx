import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Folder, Goal, GoalStatus, Step, StepStatus, Todo } from '../types';
import { getRepository, isSupabaseConfigured } from '../repository';
import type { Repository } from '../repository/types';
import type { ImportData, ImportGoalInput } from '../utils/jsonImport';
import { calcGoalProgressRatio, getCurrentStep } from '../utils/progress';
import { emitCelebration } from '../utils/celebrationBus';
import { computeNewOrder, sortByOrder } from '../utils/reorder';
import { clearUndoStack, popUndoSnapshot, pushUndoSnapshot } from '../undo/undoStack';
import { updateAppBadge } from '../utils/appBadge';

/** 削除・D&D移動の直後に「元に戻す」トースト(v3追加)を出す */
function notifyUndo(message: string): void {
  emitCelebration({ type: 'undoToast', message });
}

/**
 * アンドゥの実行(v3追加)。target(復元先スナップショット)と現在の配列を突き合わせ、
 * targetに存在する項目はRepository経由でupsert(内容が同じならスキップ)、
 * targetに存在しない(現在にだけある)項目は削除する。IDは保持される。
 */
async function reconcileEntities<T extends { id: string }>(
  current: T[],
  target: T[],
  restore: (item: T) => Promise<void>,
  remove: (id: string) => Promise<void>
): Promise<void> {
  const currentById = new Map(current.map((i) => [i.id, i]));
  const targetById = new Map(target.map((i) => [i.id, i]));
  const ops: Promise<void>[] = [];
  for (const [id, item] of targetById) {
    const cur = currentById.get(id);
    if (!cur || JSON.stringify(cur) !== JSON.stringify(item)) {
      ops.push(restore(item));
    }
  }
  for (const id of currentById.keys()) {
    if (!targetById.has(id)) {
      ops.push(remove(id));
    }
  }
  await Promise.all(ops);
}

/**
 * スナップショットへの復元をRepository経由で一括適用する。
 * 親→子の順(folders→goals→steps→todos)で処理することで、復元時に外部キー先が
 * 必ず先に存在した状態になる。同じ型の中では削除/復元とも対象idが重ならないため、
 * 1つの型の中は並行実行しても安全(folders.folder_idはon delete set null、
 * steps/todosはon delete cascadeのため、親の削除が子に波及しても後続処理は冪等)。
 */
async function applyUndoToRepo(repo: Repository, current: AppData, target: AppData): Promise<void> {
  await reconcileEntities(current.folders, target.folders, (f) => repo.restoreFolder(f), (id) => repo.deleteFolder(id));
  await reconcileEntities(current.goals, target.goals, (g) => repo.restoreGoal(g), (id) => repo.deleteGoal(id));
  await reconcileEntities(current.steps, target.steps, (s) => repo.restoreStep(s), (id) => repo.deleteStep(id));
  await reconcileEntities(current.todos, target.todos, (t) => repo.restoreTodo(t), (id) => repo.deleteTodo(id));
}

/**
 * 達成演出の判定(v2追加)。完了操作のハンドラ内で、変更前後のステップ配列・Todo配列を渡して比較する。
 * - ゴール進捗が100%未満→100%になった: goalComplete を発火
 * - そうでなく、かつ allowStepUnlock(完了方向の操作の時だけtrue)の場合、
 *   「現在のステップ」が変わっていれば stepUnlock を発火
 * 再レンダリングでの誤発火を防ぐため、必ずこの関数はハンドラ内(状態更新の直後)から呼ぶこと。
 */
function detectAndEmitCelebration(
  goal: Goal | undefined,
  beforeSteps: Step[],
  beforeTodos: Todo[],
  afterSteps: Step[],
  afterTodos: Todo[],
  allowStepUnlock: boolean
): void {
  if (!goal) return;
  const beforeGoalSteps = beforeSteps.filter((s) => s.goalId === goal.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const afterGoalSteps = afterSteps.filter((s) => s.goalId === goal.id).sort((a, b) => a.sortOrder - b.sortOrder);
  const beforeProgress = calcGoalProgressRatio(beforeGoalSteps, beforeTodos);
  const afterProgress = calcGoalProgressRatio(afterGoalSteps, afterTodos);

  if (beforeProgress < 1 && afterProgress >= 1) {
    emitCelebration({ type: 'goalComplete' });
    return;
  }

  if (!allowStepUnlock) return;
  const beforeCurrentId = getCurrentStep(beforeGoalSteps)?.id ?? null;
  const afterCurrent = getCurrentStep(afterGoalSteps);
  if (afterCurrent && afterCurrent.id !== beforeCurrentId) {
    const stepNumber = afterGoalSteps.findIndex((s) => s.id === afterCurrent.id) + 1;
    emitCelebration({ type: 'stepUnlock', stepNumber, stepTitle: afterCurrent.title });
  }
}

interface DataContextValue {
  folders: Folder[];
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;

  addFolder: (title: string) => Promise<void>;
  renameFolder: (id: string, title: string) => Promise<void>;
  removeFolder: (id: string) => Promise<void>;

  addGoal: (title: string, dueDate: string | null) => Promise<void>;
  renameGoal: (id: string, title: string) => Promise<void>;
  setGoalDueDate: (id: string, dueDate: string | null) => Promise<void>;
  setGoalStatus: (id: string, status: GoalStatus) => Promise<void>;
  moveGoalToFolder: (id: string, folderId: string | null) => Promise<void>;
  removeGoal: (id: string) => Promise<void>;

  addStep: (goalId: string, title: string) => Promise<void>;
  renameStep: (id: string, title: string) => Promise<void>;
  setStepStatus: (id: string, status: StepStatus) => Promise<void>;
  removeStep: (id: string) => Promise<void>;

  addTodo: (stepId: string, title: string) => Promise<void>;
  renameTodo: (id: string, title: string) => Promise<void>;
  toggleTodo: (id: string) => Promise<void>;
  removeTodo: (id: string) => Promise<void>;

  importData: (data: ImportData) => Promise<void>;

  // ---- アンドゥ(v3追加) ----
  undo: () => Promise<void>;

  // ---- ドラッグ&ドロップ(v2.1追加) ----
  moveFolder: (id: string, beforeId: string | null) => Promise<void>;
  moveGoal: (id: string, folderId: string | null, beforeId: string | null) => Promise<void>;
  moveStep: (id: string, goalId: string, beforeId: string | null) => Promise<void>;
  moveTodo: (id: string, stepId: string, beforeId: string | null) => Promise<void>;
  promoteTodoToStep: (todoId: string) => Promise<void>;
  demoteStepToTodo: (stepId: string, targetStepId: string) => Promise<void>;
  promoteStepToGoal: (stepId: string) => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepository(), []);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [steps, setSteps] = useState<Step[]>([]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo
      .loadAll()
      .then((data) => {
        if (cancelled) return;
        setFolders(data.folders);
        setGoals(data.goals);
        setSteps(data.steps);
        setTodos(data.todos);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repo]);

  // 全データの再取得(v2追加)。クラウド移行完了後の反映、タブ復帰時の自動再取得に使う。
  const reload = useCallback(async () => {
    try {
      const data = await repo.loadAll();
      setFolders(data.folders);
      setGoals(data.goals);
      setSteps(data.steps);
      setTodos(data.todos);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'データの読み込みに失敗しました');
    }
  }, [repo]);

  // タブ復帰時の自動再取得(v2追加、Supabaseモードのみ。ローカルモードでは何もしない)
  // v3追加: 別端末の変更と食い違うおそれがあるため、再取得のたびにアンドゥスタックをクリアする。
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        clearUndoStack();
        void reload();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reload]);

  // アプリバッジ(v3追加)。データが変わるたびに未完了Todo数を反映する。
  useEffect(() => {
    updateAppBadge(steps, todos);
  }, [steps, todos]);

  // ---- Folder(v1.2で追加) ----
  const addFolder = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const folder = await repo.createFolder({ title: trimmed });
      setFolders((prev) => [...prev, folder]);
    },
    [repo, folders, goals, steps, todos]
  );

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateFolder(id, { title: trimmed });
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, title: trimmed } : f)));
    },
    [repo, folders, goals, steps, todos]
  );

  const removeFolder = useCallback(
    async (id: string) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      // 配下ゴールは削除せずトップレベルに戻す
      await repo.deleteFolder(id);
      setGoals((prev) => prev.map((g) => (g.folderId === id ? { ...g, folderId: null } : g)));
      setFolders((prev) => prev.filter((f) => f.id !== id));
      notifyUndo('フォルダを削除しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- Goal ----
  const addGoal = useCallback(
    async (title: string, dueDate: string | null) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const goal = await repo.createGoal({ title: trimmed, dueDate });
      setGoals((prev) => [...prev, goal]);
    },
    [repo, folders, goals, steps, todos]
  );

  const renameGoal = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateGoal(id, { title: trimmed });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, title: trimmed } : g)));
    },
    [repo, folders, goals, steps, todos]
  );

  const setGoalDueDate = useCallback(
    async (id: string, dueDate: string | null) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateGoal(id, { dueDate });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, dueDate } : g)));
    },
    [repo, folders, goals, steps, todos]
  );

  const setGoalStatus = useCallback(
    async (id: string, status: GoalStatus) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateGoal(id, { status });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    },
    [repo, folders, goals, steps, todos]
  );

  const moveGoalToFolder = useCallback(
    async (id: string, folderId: string | null) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateGoal(id, { folderId });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, folderId } : g)));
    },
    [repo, folders, goals, steps, todos]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.deleteGoal(id);
      const stepIds = steps.filter((s) => s.goalId === id).map((s) => s.id);
      setTodos((prev) => prev.filter((t) => !stepIds.includes(t.stepId)));
      setSteps((prev) => prev.filter((s) => s.goalId !== id));
      setGoals((prev) => prev.filter((g) => g.id !== id));
      notifyUndo('ゴールを削除しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- Step ----
  const addStep = useCallback(
    async (goalId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const step = await repo.createStep({ goalId, title: trimmed });
      setSteps((prev) => [...prev, step]);
    },
    [repo, folders, goals, steps, todos]
  );

  const renameStep = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateStep(id, { title: trimmed });
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    },
    [repo, folders, goals, steps, todos]
  );

  const setStepStatus = useCallback(
    async (id: string, status: StepStatus) => {
      const step = steps.find((s) => s.id === id);
      const goal = step ? goals.find((g) => g.id === step.goalId) : undefined;

      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateStep(id, { status });
      const updatedSteps = steps.map((s) => (s.id === id ? { ...s, status } : s));
      setSteps(updatedSteps);

      // 達成演出の判定(v2追加。手動でのステップ完了時のみ「解放」を検知する)
      detectAndEmitCelebration(goal, steps, todos, updatedSteps, todos, status === 'done');
    },
    [repo, folders, goals, steps, todos]
  );

  const removeStep = useCallback(
    async (id: string) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.deleteStep(id);
      setTodos((prev) => prev.filter((t) => t.stepId !== id));
      setSteps((prev) => prev.filter((s) => s.id !== id));
      notifyUndo('ステップを削除しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- Todo ----
  const addTodo = useCallback(
    async (stepId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const todo = await repo.createTodo({ stepId, title: trimmed });
      setTodos((prev) => [...prev, todo]);
    },
    [repo, folders, goals, steps, todos]
  );

  const renameTodo = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateTodo(id, { title: trimmed });
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    },
    [repo, folders, goals, steps, todos]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const target = todos.find((t) => t.id === id);
      if (!target) return;
      const done = !target.done;
      const completedAt = done ? new Date().toISOString() : null;

      const step = steps.find((s) => s.id === target.stepId);
      const goal = step ? goals.find((g) => g.id === step.goalId) : undefined;

      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.updateTodo(id, { done, completedAt });
      const updatedTodos = todos.map((t) => (t.id === id ? { ...t, done, completedAt } : t));
      setTodos(updatedTodos);

      // 親ステップの全Todoが完了したら自動でステップも完了扱いにする(逆も然り)
      let updatedSteps = steps;
      if (step) {
        const siblingTodos = updatedTodos.filter((t) => t.stepId === step.id);
        const allDone = siblingTodos.length > 0 && siblingTodos.every((t) => t.done);
        const nextStatus: StepStatus = allDone ? 'done' : 'active';
        if (nextStatus !== step.status) {
          await repo.updateStep(step.id, { status: nextStatus });
          updatedSteps = steps.map((s) => (s.id === step.id ? { ...s, status: nextStatus } : s));
          setSteps(updatedSteps);
        }
      }

      // 達成演出の判定(v2追加。完了方向の操作の時だけ「次ステップ解放」を検知する)
      detectAndEmitCelebration(goal, steps, todos, updatedSteps, updatedTodos, done);
    },
    [repo, folders, goals, steps, todos]
  );

  const removeTodo = useCallback(
    async (id: string) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      await repo.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
      notifyUndo('Todoを削除しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ==================== ドラッグ&ドロップ(v2.1追加) ====================
  // 共通方針: 移動先の兄弟間でsortOrderを0からの連番に振り直す(SPEC.md「実装メモ」準拠)。
  // 削除を伴う操作(降格/昇格でstepを消す場合)は、配下todoの付け替えを確実に先にawaitしてから
  // deleteStepを呼ぶ(Supabase側はtodos.step_id/steps.goal_idがon delete cascadeのため、
  // 同一Promise.allで並行に投げると付け替え前にDELETEが先着してデータを失うおそれがある)。

  // ---- フォルダの並び替え ----
  const moveFolder = useCallback(
    async (id: string, beforeId: string | null) => {
      const moved = folders.find((f) => f.id === id);
      if (!moved) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const others = sortByOrder(folders.filter((f) => f.id !== id));
      const newOrder = computeNewOrder(others, moved, beforeId);
      const idToSort = new Map(newOrder.map((f, idx) => [f.id, idx]));

      const updates: Promise<void>[] = [];
      for (const f of newOrder) {
        const sortOrder = idToSort.get(f.id)!;
        if (sortOrder !== f.sortOrder) updates.push(repo.updateFolder(f.id, { sortOrder }));
      }
      await Promise.all(updates);

      setFolders((prev) =>
        prev.map((f) => {
          const sortOrder = idToSort.get(f.id);
          return sortOrder !== undefined && sortOrder !== f.sortOrder ? { ...f, sortOrder } : f;
        })
      );
      notifyUndo('移動しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- ゴールの並び替え・フォルダ所属変更・昇格/降格の着地先 ----
  const moveGoal = useCallback(
    async (id: string, folderId: string | null, beforeId: string | null) => {
      const moved = goals.find((g) => g.id === id);
      if (!moved) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const others = sortByOrder(goals.filter((g) => g.folderId === folderId && g.id !== id));
      const movedForOrder = { ...moved, folderId };
      const newOrder = computeNewOrder(others, movedForOrder, beforeId);
      const idToSort = new Map(newOrder.map((g, idx) => [g.id, idx]));

      const updates: Promise<void>[] = [];
      for (const g of newOrder) {
        const sortOrder = idToSort.get(g.id)!;
        if (g.id === id) {
          updates.push(repo.updateGoal(id, { sortOrder, folderId }));
        } else if (sortOrder !== g.sortOrder) {
          updates.push(repo.updateGoal(g.id, { sortOrder }));
        }
      }
      await Promise.all(updates);

      setGoals((prev) =>
        prev.map((g) => {
          const sortOrder = idToSort.get(g.id);
          if (sortOrder === undefined) return g;
          if (g.id === id) return { ...g, sortOrder, folderId };
          return sortOrder !== g.sortOrder ? { ...g, sortOrder } : g;
        })
      );
      notifyUndo('移動しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- ステップの並び替え・ゴール間移動 ----
  const moveStep = useCallback(
    async (id: string, goalId: string, beforeId: string | null) => {
      const moved = steps.find((s) => s.id === id);
      if (!moved) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const others = sortByOrder(steps.filter((s) => s.goalId === goalId && s.id !== id));
      const movedForOrder = { ...moved, goalId };
      const newOrder = computeNewOrder(others, movedForOrder, beforeId);
      const idToSort = new Map(newOrder.map((s, idx) => [s.id, idx]));

      const updates: Promise<void>[] = [];
      for (const s of newOrder) {
        const sortOrder = idToSort.get(s.id)!;
        if (s.id === id) {
          updates.push(repo.updateStep(id, { sortOrder, goalId }));
        } else if (sortOrder !== s.sortOrder) {
          updates.push(repo.updateStep(s.id, { sortOrder }));
        }
      }
      await Promise.all(updates);

      setSteps((prev) =>
        prev.map((s) => {
          const sortOrder = idToSort.get(s.id);
          if (sortOrder === undefined) return s;
          if (s.id === id) return { ...s, sortOrder, goalId };
          return sortOrder !== s.sortOrder ? { ...s, sortOrder } : s;
        })
      );
      notifyUndo('移動しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- Todoの並び替え・ステップ間移動 ----
  const moveTodo = useCallback(
    async (id: string, stepId: string, beforeId: string | null) => {
      const moved = todos.find((t) => t.id === id);
      if (!moved) return;
      pushUndoSnapshot({ folders, goals, steps, todos });
      const others = sortByOrder(todos.filter((t) => t.stepId === stepId && t.id !== id));
      const movedForOrder = { ...moved, stepId };
      const newOrder = computeNewOrder(others, movedForOrder, beforeId);
      const idToSort = new Map(newOrder.map((t, idx) => [t.id, idx]));

      const updates: Promise<void>[] = [];
      for (const t of newOrder) {
        const sortOrder = idToSort.get(t.id)!;
        if (t.id === id) {
          updates.push(repo.updateTodo(id, { sortOrder, stepId }));
        } else if (sortOrder !== t.sortOrder) {
          updates.push(repo.updateTodo(t.id, { sortOrder }));
        }
      }
      await Promise.all(updates);

      setTodos((prev) =>
        prev.map((t) => {
          const sortOrder = idToSort.get(t.id);
          if (sortOrder === undefined) return t;
          if (t.id === id) return { ...t, sortOrder, stepId };
          return sortOrder !== t.sortOrder ? { ...t, sortOrder } : t;
        })
      );
      notifyUndo('移動しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- Todo→左: 同ゴール内で新しいステップに昇格(タイトル引継ぎ、元ステップの直後に挿入) ----
  const promoteTodoToStep = useCallback(
    async (todoId: string) => {
      const todo = todos.find((t) => t.id === todoId);
      if (!todo) return;
      const originalStep = steps.find((s) => s.id === todo.stepId);
      if (!originalStep) return;
      const goalId = originalStep.goalId;

      pushUndoSnapshot({ folders, goals, steps, todos });
      const newStep = await repo.createStep({ goalId, title: todo.title });

      const sorted = sortByOrder(steps.filter((s) => s.goalId === goalId));
      const idx = sorted.findIndex((s) => s.id === originalStep.id);
      const nextStep = idx >= 0 ? sorted[idx + 1] : undefined;
      const beforeId = nextStep ? nextStep.id : null;
      const newOrder = computeNewOrder(sorted, newStep, beforeId);
      const idToSort = new Map(newOrder.map((s, i) => [s.id, i]));

      const stepUpdates: Promise<void>[] = [];
      for (const s of newOrder) {
        const sortOrder = idToSort.get(s.id)!;
        if (s.id === newStep.id || sortOrder !== s.sortOrder) {
          stepUpdates.push(repo.updateStep(s.id, { sortOrder }));
        }
      }
      await Promise.all(stepUpdates);
      await repo.deleteTodo(todoId);

      const finalNewStep = { ...newStep, sortOrder: idToSort.get(newStep.id)! };
      setSteps((prev) => {
        const renumbered = prev.map((s) => {
          const sortOrder = idToSort.get(s.id);
          return sortOrder !== undefined && sortOrder !== s.sortOrder ? { ...s, sortOrder } : s;
        });
        return [...renumbered, finalNewStep];
      });
      setTodos((prev) => prev.filter((t) => t.id !== todoId));
      notifyUndo('昇格しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- ステップ→右: 直前のステップのTodoに降格(タイトル引継ぎ、配下Todoも同じStepへ順序維持で移動) ----
  const demoteStepToTodo = useCallback(
    async (stepId: string, targetStepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      const targetStep = steps.find((s) => s.id === targetStepId);
      if (!step || !targetStep) return;

      pushUndoSnapshot({ folders, goals, steps, todos });
      const childTodos = sortByOrder(todos.filter((t) => t.stepId === stepId));
      const existingTargetTodos = sortByOrder(todos.filter((t) => t.stepId === targetStepId));

      const titleTodo = await repo.createTodo({ stepId: targetStepId, title: step.title });

      const finalOrder = [...existingTargetTodos, titleTodo, ...childTodos];
      const idToSort = new Map(finalOrder.map((t, i) => [t.id, i]));
      const childIds = new Set(childTodos.map((t) => t.id));

      const todoUpdates: Promise<void>[] = [];
      for (const t of finalOrder) {
        const sortOrder = idToSort.get(t.id)!;
        if (childIds.has(t.id)) {
          todoUpdates.push(repo.updateTodo(t.id, { stepId: targetStepId, sortOrder }));
        } else if (t.id === titleTodo.id) {
          if (sortOrder !== t.sortOrder) todoUpdates.push(repo.updateTodo(t.id, { sortOrder }));
        } else if (sortOrder !== t.sortOrder) {
          todoUpdates.push(repo.updateTodo(t.id, { sortOrder }));
        }
      }
      // 配下Todoの付け替えを確実に完了させてから、空になったステップを削除する
      // (cascadeでの巻き添え削除を防ぐため、意図的にPromise.allを分ける)
      await Promise.all(todoUpdates);
      await repo.deleteStep(stepId);

      const finalTitleTodo = { ...titleTodo, sortOrder: idToSort.get(titleTodo.id)! };
      setTodos((prev) => {
        const updated = prev.map((t) => {
          const sortOrder = idToSort.get(t.id);
          if (sortOrder === undefined) return t;
          if (childIds.has(t.id)) return { ...t, stepId: targetStepId, sortOrder };
          return sortOrder !== t.sortOrder ? { ...t, sortOrder } : t;
        });
        return [...updated, finalTitleTodo];
      });
      setSteps((prev) => prev.filter((s) => s.id !== stepId));
      notifyUndo('降格しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- ステップ→左: ゴールに昇格(タイトル引継ぎ、元ゴールの直後に挿入、配下Todoは「その他」ステップへ) ----
  const promoteStepToGoal = useCallback(
    async (stepId: string) => {
      const step = steps.find((s) => s.id === stepId);
      if (!step) return;
      const goal = goals.find((g) => g.id === step.goalId);
      if (!goal) return;
      const folderId = goal.folderId;

      pushUndoSnapshot({ folders, goals, steps, todos });
      const newGoal = await repo.createGoal({ title: step.title, dueDate: null, folderId });

      const sortedGoals = sortByOrder(goals.filter((g) => g.folderId === folderId));
      const gIdx = sortedGoals.findIndex((g) => g.id === goal.id);
      const nextGoal = gIdx >= 0 ? sortedGoals[gIdx + 1] : undefined;
      const goalBeforeId = nextGoal ? nextGoal.id : null;
      const newGoalOrder = computeNewOrder(sortedGoals, newGoal, goalBeforeId);
      const goalIdToSort = new Map(newGoalOrder.map((g, i) => [g.id, i]));

      const goalUpdates: Promise<void>[] = [];
      for (const g of newGoalOrder) {
        const sortOrder = goalIdToSort.get(g.id)!;
        if (g.id === newGoal.id || sortOrder !== g.sortOrder) {
          goalUpdates.push(repo.updateGoal(g.id, { sortOrder }));
        }
      }
      await Promise.all(goalUpdates);

      const childTodos = sortByOrder(todos.filter((t) => t.stepId === stepId));
      let newStep: Step | null = null;
      if (childTodos.length > 0) {
        newStep = await repo.createStep({ goalId: newGoal.id, title: 'その他' });
        await Promise.all(
          childTodos.map((t, i) => repo.updateTodo(t.id, { stepId: (newStep as Step).id, sortOrder: i }))
        );
      }
      // 配下Todoの付け替え(あれば)を確実に完了させてから元ステップを削除する
      await repo.deleteStep(stepId);

      const finalNewGoal = { ...newGoal, sortOrder: goalIdToSort.get(newGoal.id)! };
      setGoals((prev) => {
        const renumbered = prev.map((g) => {
          const sortOrder = goalIdToSort.get(g.id);
          return sortOrder !== undefined && sortOrder !== g.sortOrder ? { ...g, sortOrder } : g;
        });
        return [...renumbered, finalNewGoal];
      });
      if (newStep) {
        const finalStep = newStep;
        setSteps((prev) => [...prev.filter((s) => s.id !== stepId), finalStep]);
        setTodos((prev) =>
          prev.map((t) => {
            const idx = childTodos.findIndex((c) => c.id === t.id);
            return idx !== -1 ? { ...t, stepId: finalStep.id, sortOrder: idx } : t;
          })
        );
      } else {
        setSteps((prev) => prev.filter((s) => s.id !== stepId));
      }
      notifyUndo('ゴールに昇格しました');
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- JSONインポート(v1.1で追加、v1.2でフォルダ対応) ----
  // 既存のCRUDメソッド(createFolder/createGoal/createStep/createTodo)をRepository経由で
  // 配列順に呼び出すことで、sortOrderは既存データの続きから割り振られる。
  const importData = useCallback(
    async (data: ImportData) => {
      pushUndoSnapshot({ folders, goals, steps, todos });
      const newFolders: Folder[] = [];
      const newGoals: Goal[] = [];
      const newSteps: Step[] = [];
      const newTodos: Todo[] = [];

      const importGoal = async (goalInput: ImportGoalInput, folderId: string | null) => {
        const goal = await repo.createGoal({ title: goalInput.title, dueDate: goalInput.dueDate, folderId });
        newGoals.push(goal);

        for (const stepInput of goalInput.steps) {
          const step = await repo.createStep({ goalId: goal.id, title: stepInput.title });
          let finalStep = step;
          // v2追加: エクスポートJSONのstatus("done")を受理し、完了状態を復元する
          if (stepInput.status === 'done') {
            await repo.updateStep(step.id, { status: 'done' });
            finalStep = { ...step, status: 'done' };
          }
          newSteps.push(finalStep);

          for (const todoInput of stepInput.todos) {
            const todo = await repo.createTodo({ stepId: step.id, title: todoInput.title });
            let finalTodo = todo;
            // v2追加: エクスポートJSONのdone(true)を受理し、completedAt=現在時刻で復元する
            if (todoInput.done) {
              const completedAt = new Date().toISOString();
              await repo.updateTodo(todo.id, { done: true, completedAt });
              finalTodo = { ...todo, done: true, completedAt };
            }
            newTodos.push(finalTodo);
          }
        }
      };

      for (const folderInput of data.folders) {
        // フォルダ名が既存(またはこのインポート中に作成済み)のフォルダと完全一致すれば流用する
        let folder = [...folders, ...newFolders].find((f) => f.title === folderInput.title);
        if (!folder) {
          folder = await repo.createFolder({ title: folderInput.title });
          newFolders.push(folder);
        }
        for (const goalInput of folderInput.goals) {
          await importGoal(goalInput, folder.id);
        }
      }

      for (const goalInput of data.goals) {
        await importGoal(goalInput, null);
      }

      setFolders((prev) => [...prev, ...newFolders]);
      setGoals((prev) => [...prev, ...newGoals]);
      setSteps((prev) => [...prev, ...newSteps]);
      setTodos((prev) => [...prev, ...newTodos]);
    },
    [repo, folders, goals, steps, todos]
  );

  // ---- アンドゥ(v3追加) ----
  // undoStack(モジュール外部の状態)から直近のスナップショットを取り出し、Repository経由で差分適用してstateを復元する。
  // 実行中に他の操作が割り込むと不整合が起きうるため、簡易的な多重実行ガードを設ける。
  const undoingRef = useRef(false);
  const undo = useCallback(async () => {
    if (undoingRef.current) return;
    const entry = popUndoSnapshot();
    if (!entry) return;
    undoingRef.current = true;
    try {
      const current: AppData = { folders, goals, steps, todos };
      const target = entry.snapshot;
      await applyUndoToRepo(repo, current, target);
      setFolders(target.folders);
      setGoals(target.goals);
      setSteps(target.steps);
      setTodos(target.todos);
    } catch (e) {
      console.error('[undo] 復元に失敗しました', e);
    } finally {
      undoingRef.current = false;
    }
  }, [repo, folders, goals, steps, todos, undoingRef]);

  // Ctrl+Z / Cmd+Z でアンドゥを実行する(v3追加)。input/textarea/contentEditableにフォーカス中は無視する。
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key.toLowerCase() !== 'z') return;
      const active = document.activeElement as HTMLElement | null;
      const tag = active?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || active?.isContentEditable) return;
      e.preventDefault();
      void undo();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo]);

  const value: DataContextValue = {
    folders,
    goals,
    steps,
    todos,
    loading,
    error,
    reload,
    addFolder,
    renameFolder,
    removeFolder,
    addGoal,
    renameGoal,
    setGoalDueDate,
    setGoalStatus,
    moveGoalToFolder,
    removeGoal,
    addStep,
    renameStep,
    setStepStatus,
    removeStep,
    addTodo,
    renameTodo,
    toggleTodo,
    removeTodo,
    importData,
    undo,
    moveFolder,
    moveGoal,
    moveStep,
    moveTodo,
    promoteTodoToStep,
    demoteStepToTodo,
    promoteStepToGoal,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
