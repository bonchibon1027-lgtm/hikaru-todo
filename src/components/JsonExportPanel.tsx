import { useRef, useState } from 'react';
import { useData } from '../context/DataContext';
import { formatExportJson } from '../utils/jsonExport';

// JSONエクスポート(v2追加)。全active(非アーカイブ)データをインポート互換JSONで表示し、コピーできる。
export default function JsonExportPanel() {
  const { folders, goals, steps, todos } = useData();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [json, setJson] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleOpen() {
    setJson(formatExportJson(folders, goals, steps, todos));
    setCopied(false);
    setOpen(true);
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error('clipboard unavailable');
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // クリップボードAPIが使えない場合は選択状態にするフォールバック
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }
  }

  if (!open) {
    return (
      <button type="button" className="json-export-trigger" onClick={handleOpen}>
        エクスポート
      </button>
    );
  }

  return (
    <div className="json-import-overlay" onClick={() => setOpen(false)}>
      <div className="json-import-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="json-import-title">JSONエクスポート</h2>
        <textarea
          ref={textareaRef}
          readOnly
          className="json-import-textarea"
          value={json}
          rows={10}
          onFocus={(e) => e.currentTarget.select()}
        />
        <div className="json-import-actions">
          <button type="button" className="primary-button primary-button--small" onClick={handleCopy}>
            {copied ? 'コピーしました' : 'コピー'}
          </button>
          <button type="button" className="link-button" onClick={() => setOpen(false)}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
