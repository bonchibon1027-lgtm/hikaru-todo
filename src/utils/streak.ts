import type { Todo } from '../types';

// ストリーク計算(v2追加)。completedAt(ローカル時刻)ベースで、
// 今日から遡って1件以上Todoを完了した連続日数を数える純粋関数。
// 今日まだ0件のときは「昨日から数えた日数」を返す(今日やれば+1される寄り添い仕様)。
// date-fns等は使わずDate素で計算する。

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function calcStreak(todos: Pick<Todo, 'completedAt'>[], now: Date = new Date()): number {
  const completedDates = new Set<string>();
  for (const t of todos) {
    if (t.completedAt) {
      const d = new Date(t.completedAt);
      if (!Number.isNaN(d.getTime())) {
        completedDates.add(toLocalDateKey(d));
      }
    }
  }

  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayKey = toLocalDateKey(cursor);

  if (!completedDates.has(todayKey)) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  while (completedDates.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
