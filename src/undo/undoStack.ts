import type { AppData } from '../types';

// アンドゥ(v3追加)。DataContextの全mutating操作の入口で、変更前スナップショットをここへpushする。
// Reactの外側にあるモジュール状態として実装する(celebrationBus / dragStore と同じ方針)。
// フィールドはすべてプリミティブなフラットオブジェクトなので、各要素をスプレッドするだけでディープコピーになる。

const MAX_DEPTH = 20;

export interface UndoEntry {
  snapshot: AppData;
}

let stack: UndoEntry[] = [];

function cloneAppData(data: AppData): AppData {
  return {
    folders: data.folders.map((f) => ({ ...f })),
    goals: data.goals.map((g) => ({ ...g })),
    steps: data.steps.map((s) => ({ ...s })),
    todos: data.todos.map((t) => ({ ...t })),
  };
}

/** 変更前の状態をスナップショットとしてpushする(1操作=1エントリ)。深さ20を超えたら古いものから破棄する。 */
export function pushUndoSnapshot(data: AppData): void {
  stack.push({ snapshot: cloneAppData(data) });
  if (stack.length > MAX_DEPTH) {
    stack = stack.slice(stack.length - MAX_DEPTH);
  }
}

/** 直近のスナップショットを取り出す(スタックから取り除く)。無ければnull。 */
export function popUndoSnapshot(): UndoEntry | null {
  return stack.pop() ?? null;
}

/** タブ復帰の自動再取得時など、別端末の変更との整合が取れなくなるタイミングで呼ぶ。 */
export function clearUndoStack(): void {
  stack = [];
}

export function hasUndo(): boolean {
  return stack.length > 0;
}
