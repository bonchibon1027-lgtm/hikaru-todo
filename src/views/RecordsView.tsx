import { useMemo } from 'react';
import { useData } from '../context/DataContext';
import { calcStreak } from '../utils/streak';
import type { Goal, Step, Todo } from '../types';

// 記録タブ(v3追加)。上段=ストリーク大表示+過去7日の完了数バーグラフ、下段=実績の棚。
// データは既存の completedAt / status から計算する(スキーマ変更なし)。閲覧専用+「アクティブに戻す」のみ。

const WEEKDAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'];

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 過去7日(今日含む)の日別完了Todo数。古い順で返す。 */
function calcLast7Days(todos: Todo[], now: Date = new Date()): { key: string; label: string; count: number; isToday: boolean }[] {
  const countByDay = new Map<string, number>();
  for (const t of todos) {
    if (!t.completedAt) continue;
    const d = new Date(t.completedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = toLocalDateKey(d);
    countByDay.set(key, (countByDay.get(key) ?? 0) + 1);
  }

  const days: { key: string; label: string; count: number; isToday: boolean }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const key = toLocalDateKey(d);
    days.push({
      key,
      label: WEEKDAY_LABELS[d.getDay()],
      count: countByDay.get(key) ?? 0,
      isToday: i === 0,
    });
  }
  return days;
}

/** ゴールの達成日 = 配下Todoの最後のcompletedAt(無ければnull) */
function goalAchievedDate(goal: Goal, steps: Step[], todos: Todo[]): string | null {
  const stepIds = new Set(steps.filter((s) => s.goalId === goal.id).map((s) => s.id));
  let latest: string | null = null;
  for (const t of todos) {
    if (!stepIds.has(t.stepId) || !t.completedAt) continue;
    if (latest === null || t.completedAt > latest) latest = t.completedAt;
  }
  return latest;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

export default function RecordsView() {
  const { goals, steps, todos, loading, setGoalStatus } = useData();

  const streak = useMemo(() => calcStreak(todos), [todos]);
  const week = useMemo(() => calcLast7Days(todos), [todos]);
  const maxCount = Math.max(1, ...week.map((d) => d.count));

  const trophyGoals = useMemo(
    () =>
      goals
        .filter((g) => g.status === 'done' || g.status === 'archived')
        .map((g) => {
          const stepIds = new Set(steps.filter((s) => s.goalId === g.id).map((s) => s.id));
          const doneCount = todos.filter((t) => stepIds.has(t.stepId) && t.done).length;
          const achievedAt = goalAchievedDate(g, steps, todos);
          return { goal: g, doneCount, achievedAt };
        })
        .sort((a, b) => (b.achievedAt ?? '').localeCompare(a.achievedAt ?? '')),
    [goals, steps, todos]
  );

  return (
    <div className="view-container records-view">
      {loading && <p className="muted-text center-text">読み込み中…</p>}

      {/* 上段: ストリーク+7日間バーグラフ */}
      <section className="records-stats">
        <div className="records-streak" aria-label={`${streak}日連続達成中`}>
          <span className="records-streak-flame" aria-hidden="true">🔥</span>
          <span className="records-streak-number">{streak}</span>
          <span className="records-streak-unit">日連続</span>
        </div>
        <div className="records-chart" role="img" aria-label="過去7日の完了数">
          {week.map((day) => (
            <div key={day.key} className="records-chart-col">
              <span className="records-chart-count">{day.count > 0 ? day.count : ''}</span>
              <div className="records-chart-track">
                <div
                  className={`records-chart-bar${day.isToday ? ' records-chart-bar--today' : ''}`}
                  style={{ height: `${Math.round((day.count / maxCount) * 100)}%` }}
                />
              </div>
              <span className={`records-chart-label${day.isToday ? ' records-chart-label--today' : ''}`}>
                {day.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 下段: 実績の棚 */}
      <section className="records-shelf">
        <h2 className="records-shelf-title">実績の棚</h2>
        {!loading && trophyGoals.length === 0 && (
          <div className="empty-state records-shelf-empty">
            <p className="empty-state-emoji">🏆</p>
            <p>最初のゴールを達成しよう</p>
          </div>
        )}
        <div className="records-trophy-grid">
          {trophyGoals.map(({ goal, doneCount, achievedAt }) => (
            <div key={goal.id} className="trophy-card">
              <div className="trophy-card-icon" aria-hidden="true">🏆</div>
              <div className="trophy-card-title">{goal.title}</div>
              <div className="trophy-card-meta">
                <span>{formatDate(achievedAt)}</span>
                <span>{doneCount} Todo</span>
              </div>
              {goal.status === 'archived' && <span className="status-pill status-pill--archived">アーカイブ</span>}
              <button
                type="button"
                className="link-button trophy-card-reactivate"
                onClick={() => setGoalStatus(goal.id, 'active')}
              >
                アクティブに戻す
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
