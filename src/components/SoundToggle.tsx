import { useState } from 'react';
import { loadUiPrefs, saveUiPrefs } from '../utils/uiPrefs';

// チェック音のミュートトグル(v2追加)。ヘッダーに配置する小さなスピーカーアイコン。デフォルトON(=音あり)。
export default function SoundToggle() {
  const [muted, setMuted] = useState(() => loadUiPrefs().soundMuted);

  function handleToggle() {
    setMuted((prev) => {
      const next = !prev;
      saveUiPrefs({ soundMuted: next });
      return next;
    });
  }

  return (
    <button
      type="button"
      className="sound-toggle"
      onClick={handleToggle}
      aria-label={muted ? '音を有効にする' : '音をミュートにする'}
      aria-pressed={muted}
    >
      {muted ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
          <line x1="16" y1="9" x2="21.5" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <line x1="21.5" y1="9" x2="16" y2="15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor" />
          <path d="M16.2 8.5a5 5 0 010 7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M18.8 6a9 9 0 010 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      )}
    </button>
  );
}
