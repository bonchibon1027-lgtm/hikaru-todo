import { useCallback, useEffect, useState } from 'react';

// 削除確認(v3追加)。全×ボタン共通のインライン2段階確認。
// 1回目のクリックで armed=true(見た目が「削除?」に変わる)。2.5秒以内に再度押すと確定して onConfirm() を呼ぶ。
// 時間切れ、またはボタン以外の場所をポインタダウンすると armed=false に自動で戻る。
const AUTO_REVERT_MS = 2500;

export function useConfirmDelete(onConfirm: () => void) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    // このeffectはarmedになった後のコミット(=このクリックイベントの完全終了後)に走るので、
    // armする1回目のクリック自体がここで即revertされることはない。
    const timer = window.setTimeout(() => setArmed(false), AUTO_REVERT_MS);
    const handleOutside = () => setArmed(false);
    document.addEventListener('pointerdown', handleOutside);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('pointerdown', handleOutside);
    };
  }, [armed]);

  const trigger = useCallback(
    (e?: { stopPropagation?: () => void }) => {
      e?.stopPropagation?.();
      if (armed) {
        setArmed(false);
        onConfirm();
      } else {
        setArmed(true);
      }
    },
    [armed, onConfirm]
  );

  // 2回目クリックのpointerdownがdocumentの「他所クリック」リスナーに拾われて
  // 確定前にdisarmされるのを防ぐ。確認ボタン自身には必ずこれを付けること。
  const onPointerDown = useCallback((e: { stopPropagation: () => void }) => {
    e.stopPropagation();
  }, []);

  const reset = useCallback(() => setArmed(false), []);

  return { armed, trigger, onPointerDown, reset };
}
