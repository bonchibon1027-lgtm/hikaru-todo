// 達成演出の通知バス(v2追加)。
// DataContext(完了操作のハンドラ内)で前後の進捗を比較して発火し、
// AppShell配下のCelebrationLayerが購読して紙吹雪・トーストを表示する。
// 再レンダリングでの誤発火を防ぐため、判定は必ず呼び出し側(ハンドラ)で行うこと。

export type CelebrationEvent =
  | { type: 'goalComplete' }
  | { type: 'stepUnlock'; stepNumber: number; stepTitle: string };

type Listener = (event: CelebrationEvent) => void;

const listeners = new Set<Listener>();

export function emitCelebration(event: CelebrationEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

export function onCelebration(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
