import type { Step, Todo } from '../types';

/**
 * アプリバッジ(v3追加)。未完了Todo数(done扱いステップ配下は除外)を navigator.setAppBadge() に反映する。
 * 対応環境がなければ何もしない(黙ってスキップ)。データ変更のたびにDataContextから呼ばれる。
 */
export function updateAppBadge(steps: Step[], todos: Todo[]): void {
  if (typeof navigator === 'undefined') return;
  const nav = navigator;
  if (typeof nav.setAppBadge !== 'function') return;

  const doneStepIds = new Set(steps.filter((s) => s.status === 'done').map((s) => s.id));
  let count = 0;
  for (const t of todos) {
    if (t.done) continue;
    if (doneStepIds.has(t.stepId)) continue;
    count += 1;
  }

  if (count > 0) {
    void nav.setAppBadge(count).catch(() => {});
  } else if (typeof nav.clearAppBadge === 'function') {
    void nav.clearAppBadge().catch(() => {});
  }
}
