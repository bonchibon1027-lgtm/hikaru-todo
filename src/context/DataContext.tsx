import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Folder, Goal, GoalStatus, Step, StepStatus, Todo } from '../types';
import { getRepository, isSupabaseConfigured } from '../repository';
import type { ImportData, ImportGoalInput } from '../utils/jsonImport';
import { calcGoalProgressRatio, getCurrentStep } from '../utils/progress';
import { emitCelebration } from '../utils/celebrationBus';

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
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        void reload();
      }
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [reload]);

  // ---- Folder(v1.2で追加) ----
  const addFolder = useCallback(
    async (title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const folder = await repo.createFolder({ title: trimmed });
      setFolders((prev) => [...prev, folder]);
    },
    [repo]
  );

  const renameFolder = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await repo.updateFolder(id, { title: trimmed });
      setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, title: trimmed } : f)));
    },
    [repo]
  );

  const removeFolder = useCallback(
    async (id: string) => {
      // 配下ゴールは削除せずトップレベルに戻す
      await repo.deleteFolder(id);
      setGoals((prev) => prev.map((g) => (g.folderId === id ? { ...g, folderId: null } : g)));
      setFolders((prev) => prev.filter((f) => f.id !== id));
    },
    [repo]
  );

  // ---- Goal ----
  const addGoal = useCallback(
    async (title: string, dueDate: string | null) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const goal = await repo.createGoal({ title: trimmed, dueDate });
      setGoals((prev) => [...prev, goal]);
    },
    [repo]
  );

  const renameGoal = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await repo.updateGoal(id, { title: trimmed });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, title: trimmed } : g)));
    },
    [repo]
  );

  const setGoalDueDate = useCallback(
    async (id: string, dueDate: string | null) => {
      await repo.updateGoal(id, { dueDate });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, dueDate } : g)));
    },
    [repo]
  );

  const setGoalStatus = useCallback(
    async (id: string, status: GoalStatus) => {
      await repo.updateGoal(id, { status });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, status } : g)));
    },
    [repo]
  );

  const moveGoalToFolder = useCallback(
    async (id: string, folderId: string | null) => {
      await repo.updateGoal(id, { folderId });
      setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, folderId } : g)));
    },
    [repo]
  );

  const removeGoal = useCallback(
    async (id: string) => {
      await repo.deleteGoal(id);
      const stepIds = steps.filter((s) => s.goalId === id).map((s) => s.id);
      setTodos((prev) => prev.filter((t) => !stepIds.includes(t.stepId)));
      setSteps((prev) => prev.filter((s) => s.goalId !== id));
      setGoals((prev) => prev.filter((g) => g.id !== id));
    },
    [repo, steps]
  );

  // ---- Step ----
  const addStep = useCallback(
    async (goalId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const step = await repo.createStep({ goalId, title: trimmed });
      setSteps((prev) => [...prev, step]);
    },
    [repo]
  );

  const renameStep = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await repo.updateStep(id, { title: trimmed });
      setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s)));
    },
    [repo]
  );

  const setStepStatus = useCallback(
    async (id: string, status: StepStatus) => {
      const step = steps.find((s) => s.id === id);
      const goal = step ? goals.find((g) => g.id === step.goalId) : undefined;

      await repo.updateStep(id, { status });
      const updatedSteps = steps.map((s) => (s.id === id ? { ...s, status } : s));
      setSteps(updatedSteps);

      // 達成演出の判定(v2追加。手動でのステップ完了時のみ「解放」を検知する)
      detectAndEmitCelebration(goal, steps, todos, updatedSteps, todos, status === 'done');
    },
    [repo, steps, goals, todos]
  );

  const removeStep = useCallback(
    async (id: string) => {
      await repo.deleteStep(id);
      setTodos((prev) => prev.filter((t) => t.stepId !== id));
      setSteps((prev) => prev.filter((s) => s.id !== id));
    },
    [repo]
  );

  // ---- Todo ----
  const addTodo = useCallback(
    async (stepId: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      const todo = await repo.createTodo({ stepId, title: trimmed });
      setTodos((prev) => [...prev, todo]);
    },
    [repo]
  );

  const renameTodo = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      await repo.updateTodo(id, { title: trimmed });
      setTodos((prev) => prev.map((t) => (t.id === id ? { ...t, title: trimmed } : t)));
    },
    [repo]
  );

  const toggleTodo = useCallback(
    async (id: string) => {
      const target = todos.find((t) => t.id === id);
      if (!target) return;
      const done = !target.done;
      const completedAt = done ? new Date().toISOString() : null;

      const step = steps.find((s) => s.id === target.stepId);
      const goal = step ? goals.find((g) => g.id === step.goalId) : undefined;

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
    [repo, todos, steps, goals]
  );

  const removeTodo = useCallback(
    async (id: string) => {
      await repo.deleteTodo(id);
      setTodos((prev) => prev.filter((t) => t.id !== id));
    },
    [repo]
  );

  // ---- JSONインポート(v1.1で追加、v1.2でフォルダ対応) ----
  // 既存のCRUDメソッド(createFolder/createGoal/createStep/createTodo)をRepository経由で
  // 配列順に呼び出すことで、sortOrderは既存データの続きから割り振られる。
  const importData = useCallback(
    async (data: ImportData) => {
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
    [repo, folders]
  );

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
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
