import { useEffect, useRef, useState } from 'react';
import { onCelebration, type CelebrationEvent } from '../utils/celebrationBus';
import { useData } from '../context/DataContext';
import Confetti from './Confetti';

const UNDO_TOAST_MS = 4000;

// 達成演出のレイヤー(v2追加)。celebrationBus を購読し、紙吹雪・STEP解放トースト・
// 「元に戻す」トースト(v3追加)を表示する。AppShell配下にマウントすることでアプリ全体から見えるオーバーレイになる。
export default function CelebrationLayer() {
  const { undo } = useData();
  const [confettiKey, setConfettiKey] = useState<number | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [undoToast, setUndoToast] = useState<{ id: number; message: string } | null>(null);
  const undoTimerRef = useRef<number | null>(null);

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
      } else if (event.type === 'undoToast') {
        const id = Date.now();
        if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
        setUndoToast({ id, message: event.message });
        undoTimerRef.current = window.setTimeout(() => {
          setUndoToast((cur) => (cur && cur.id === id ? null : cur));
        }, UNDO_TOAST_MS);
      }
    });
  }, []);

  function handleUndoClick() {
    if (undoTimerRef.current !== null) window.clearTimeout(undoTimerRef.current);
    setUndoToast(null);
    void undo();
  }

  return (
    <>
      {confettiKey !== null && <Confetti key={confettiKey} onDone={() => setConfettiKey(null)} />}
      {toast && (
        <div className="step-unlock-toast" role="status" key={toast.id}>
          {toast.text}
        </div>
      )}
      {undoToast && (
        <div className="undo-toast" role="status" key={undoToast.id}>
          <span className="undo-toast-message">{undoToast.message}</span>
          <button type="button" className="undo-toast-button" onClick={handleUndoClick}>
            元に戻す
          </button>
        </div>
      )}
    </>
  );
}
