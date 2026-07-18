import { useEffect, useMemo } from 'react';
import { useData } from '../context/DataContext';
import { isSupabaseConfigured } from '../repository';
import { getCurrentStep } from '../utils/progress';
import { triggerClickFeel } from '../utils/clickFeel';
import { loadUiPrefs } from '../utils/uiPrefs';

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * ウィジェットビュー(v3追加)。`?widget=1` で起動する超軽量表示。
 * 各ゴールの「現在のステップ」の未完了Todoだけを一覧表示する。タブ・追加UI・演出は一切出さない。
 */
export default function WidgetView() {
  const { goals, steps, todos, loading, toggleTodo, reload } = useData();

  // 5分ごと+フォーカス時の自動再取得(Supabaseモードのみ)
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const interval = window.setInterval(() => void reload(), REFRESH_INTERVAL_MS);
    function handleFocus() {
      void reload();
    }
    window.addEventListener('focus', handleFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [reload]);

  const pending = useMemo(() => {
    const activeGoalIds = new Set(goals.filter((g) => g.status === 'active').map((g) => g.id));
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const currentStepIdByGoal = new Map<string, string | null>();
    for (const goal of goals) {
      const goalSteps = steps.filter((s) => s.goalId === goal.id);
      const current = getCurrentStep(goalSteps);
      currentStepIdByGoal.set(goal.id, current ? current.id : null);
    }
    return todos
      .filter((t) => !t.done)
      .filter((t) => {
        const step = stepById.get(t.stepId);
        if (!step || step.status === 'done' || !activeGoalIds.has(step.goalId)) return false;
        return currentStepIdByGoal.get(step.goalId) === step.id;
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [goals, steps, todos]);

  function handleToggle(id: string) {
    triggerClickFeel(loadUiPrefs().soundMuted);
    void toggleTodo(id);
  }

  return (
    <div className="widget-view">
      <header className="widget-header">
        <h1 className="widget-title">今日のやること</h1>
        <span className="widget-count">{pending.length}</span>
      </header>
      {loading && <p className="muted-text center-text">読み込み中…</p>}
      {!loading && pending.length === 0 && (
        <div className="widget-empty">
          <p>ぜんぶ完了!🎉</p>
        </div>
      )}
      <div className="widget-list">
        {pending.map((todo) => (
          <button
            key={todo.id}
            type="button"
            className="widget-todo-row"
            onClick={() => handleToggle(todo.id)}
          >
            <span className="widget-todo-checkbox" aria-hidden="true" />
            <span className="widget-todo-title">{todo.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
