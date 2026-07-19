import { useState } from 'react';
import { useData } from '../context/DataContext';
import TodoRow from '../components/TodoRow';
import { compareTodoDueOrder, getCurrentStep } from '../utils/progress';
import { loadUiPrefs, saveUiPrefs } from '../utils/uiPrefs';

export default function TodoView() {
  const { goals, steps, todos, loading, toggleTodo, renameTodo, removeTodo, setTodoDueDate } = useData();
  const [showAll, setShowAll] = useState(() => loadUiPrefs().showAllTodos);

  function handleToggleShowAll() {
    setShowAll((prev) => {
      const next = !prev;
      saveUiPrefs({ showAllTodos: next });
      return next;
    });
  }

  const activeGoalIds = new Set(goals.filter((g) => g.status === 'active').map((g) => g.id));
  const stepById = new Map(steps.map((s) => [s.id, s]));

  // ゴールごとの「現在のステップ」id(現在ステップのみ表示モードの絞り込みに使う)
  const currentStepIdByGoal = new Map<string, string | null>();
  for (const goal of goals) {
    const goalSteps = steps.filter((s) => s.goalId === goal.id);
    const current = getCurrentStep(goalSteps);
    currentStepIdByGoal.set(goal.id, current ? current.id : null);
  }

  const pending = todos
    .filter((t) => !t.done)
    .filter((t) => {
      const step = stepById.get(t.stepId);
      if (!step || step.status === 'done' || !activeGoalIds.has(step.goalId)) return false;
      if (showAll) return true;
      return currentStepIdByGoal.get(step.goalId) === step.id;
    })
    .sort(compareTodoDueOrder);

  const goalById = new Map(goals.map((g) => [g.id, g]));

  return (
    <div className="view-container todo-view">
      <div className="todo-view-header">
        <button
          type="button"
          className={`show-all-toggle${showAll ? ' show-all-toggle--active' : ''}`}
          onClick={handleToggleShowAll}
          aria-pressed={showAll}
        >
          すべて表示
        </button>
      </div>
      {loading && <p className="muted-text center-text">読み込み中…</p>}
      {!loading && pending.length === 0 && (
        <div className="empty-state">
          <p className="empty-state-emoji">🎉</p>
          <p>ぜんぶ完了!</p>
        </div>
      )}
      <div className="todo-flat-list">
        {pending.map((todo) => {
          const step = stepById.get(todo.stepId);
          const goal = step ? goalById.get(step.goalId) : undefined;
          const meta = goal && step ? `${goal.title} › ${step.title}` : undefined;
          return (
            <TodoRow
              key={todo.id}
              todo={todo}
              meta={meta}
              onToggle={() => toggleTodo(todo.id)}
              onRename={(title) => renameTodo(todo.id, title)}
              onDelete={() => removeTodo(todo.id)}
              onDueDateChange={(d) => setTodoDueDate(todo.id, d)}
            />
          );
        })}
      </div>
    </div>
  );
}
