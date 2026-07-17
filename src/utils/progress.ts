import type { Goal, Step, Todo } from '../types';

export function calcTodoProgress(todos: Todo[]): { done: number; total: number; percent: number } {
  const total = todos.length;
  const done = todos.filter((t) => t.done).length;
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return { done, total, percent };
}

export function stepTodos(todos: Todo[], stepId: string): Todo[] {
  return todos.filter((t) => t.stepId === stepId);
}

export function goalTodos(todos: Todo[], steps: Step[], goalId: string): Todo[] {
  const stepIds = steps.filter((s) => s.goalId === goalId).map((s) => s.id);
  return todos.filter((t) => stepIds.includes(t.stepId));
}

/**
 * 進捗率の計算ルール(v1.1で修正・SPEC.md準拠)
 * ステップ進捗 = status が done なら 1(100%)。それ以外は配下Todoの完了率(Todoが0件なら 0)
 * 返り値は 0〜1 の割合。
 */
export function calcStepProgressRatio(step: Pick<Step, 'status'>, todosOfStep: Todo[]): number {
  if (step.status === 'done') return 1;
  if (todosOfStep.length === 0) return 0;
  const done = todosOfStep.filter((t) => t.done).length;
  return done / todosOfStep.length;
}

export function calcStepProgressPercent(step: Pick<Step, 'status'>, todosOfStep: Todo[]): number {
  return Math.round(calcStepProgressRatio(step, todosOfStep) * 100);
}

/**
 * ゴール進捗 = 全ステップ進捗の平均(ステップ0件なら 0)。
 * → Todoを全部消化しても、Todoが空のステップが残っていれば100%にならない。
 * 返り値は 0〜1 の割合。
 */
export function calcGoalProgressRatio(stepsOfGoal: Step[], todos: Todo[]): number {
  if (stepsOfGoal.length === 0) return 0;
  const sum = stepsOfGoal.reduce(
    (acc, step) => acc + calcStepProgressRatio(step, stepTodos(todos, step.id)),
    0
  );
  return sum / stepsOfGoal.length;
}

export function calcGoalProgressPercent(stepsOfGoal: Step[], todos: Todo[]): number {
  return Math.round(calcGoalProgressRatio(stepsOfGoal, todos) * 100);
}

/**
 * フォルダ進捗 = 配下ゴール進捗の平均(ゴール0件なら0)(v1.2追加・SPEC.md準拠)
 * 返り値は 0〜1 の割合。
 */
export function calcFolderProgressRatio(goalsInFolder: Goal[], steps: Step[], todos: Todo[]): number {
  if (goalsInFolder.length === 0) return 0;
  const sum = goalsInFolder.reduce((acc, goal) => {
    const stepsOfGoal = steps.filter((s) => s.goalId === goal.id);
    return acc + calcGoalProgressRatio(stepsOfGoal, todos);
  }, 0);
  return sum / goalsInFolder.length;
}

export function calcFolderProgressPercent(goalsInFolder: Goal[], steps: Step[], todos: Todo[]): number {
  return Math.round(calcFolderProgressRatio(goalsInFolder, steps, todos) * 100);
}

/**
 * 「現在のステップ」= ゴール内でsortOrderが最初のstatus!=='done'のステップ(v1.2追加・SPEC.md準拠)
 * 全ステップ完了(またはステップ0件)の場合は null。
 */
export function getCurrentStep(stepsOfGoal: Step[]): Step | null {
  const sorted = [...stepsOfGoal].sort((a, b) => a.sortOrder - b.sortOrder);
  return sorted.find((s) => s.status !== 'done') ?? null;
}

/** 残り日数を計算。返り値: 正=残り日数、0=今日、負=超過日数 */
export function daysUntil(dueDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diffMs = due.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function formatDueLabel(dueDate: string | null): { text: string; overdue: boolean } | null {
  if (!dueDate) return null;
  const diff = daysUntil(dueDate);
  if (diff < 0) {
    return { text: `${Math.abs(diff)}日超過`, overdue: true };
  }
  if (diff === 0) {
    return { text: '今日まで', overdue: false };
  }
  return { text: `残り${diff}日`, overdue: false };
}
