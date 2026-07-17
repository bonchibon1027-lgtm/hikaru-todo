import { useEffect, useState } from 'react';
import { onCelebration, type CelebrationEvent } from '../utils/celebrationBus';
import Confetti from './Confetti';

// 達成演出のレイヤー(v2追加)。celebrationBus を購読し、紙吹雪・STEP解放トーストを表示する。
// AppShell配下にマウントすることでアプリ全体から見えるオーバーレイになる。
export default function CelebrationLayer() {
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  useEffect(() => {
    return onCelebration((event: CelebrationEvent) => {
      if (event.type === 'goalComplete') {
        setConfettiKey(Date.now());
      } else if (event.type === 'stepUnlock') {
        const id = Date.now();
        setToast({ id, text: `STEP ${event.stepNumber} 解放!` });
        window.setTimeout(() => {
          setToast((cur) => (cur && cur.id === id ? null : cur));
        }, 1500);
      }
    });
  }, []);

  return (
    <>
      {confettiKey !== null && <Confetti key={confettiKey} onDone={() => setConfettiKey(null)} />}
      {toast && (
        <div className="step-unlock-toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
    </>
  );
}
