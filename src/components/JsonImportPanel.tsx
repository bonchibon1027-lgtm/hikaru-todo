import { useState, type FormEvent } from 'react';
import { useData } from '../context/DataContext';
import { parseImportJson, type ImportData, type ImportSummary } from '../utils/jsonImport';

export default function JsonImportPanel() {
  const { importData } = useData();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ data: ImportData; summary: ImportSummary } | null>(null);
  const [importing, setImporting] = useState(false);

  function reset() {
    setOpen(false);
    setText('');
    setError(null);
    setPreview(null);
    setImporting(false);
  }

  function handleParse(e: FormEvent) {
    e.preventDefault();
    const result = parseImportJson(text);
    if (!result.ok) {
      setError(result.error);
      setPreview(null);
      return;
    }
    setError(null);
    setPreview({ data: result.data, summary: result.summary });
  }

  async function handleConfirmImport() {
    if (!preview) return;
    setImporting(true);
    try {
      await importData(preview.data);
      reset();
    } catch (err) {
      setImporting(false);
      setError(err instanceof Error ? err.message : 'インポートに失敗しました');
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        className="json-import-trigger"
        onClick={() => setOpen(true)}
      >
        JSONインポート
      </button>
    );
  }

  return (
    <div className="json-import-overlay" onClick={reset}>
      <div className="json-import-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="json-import-title">JSONインポート</h2>

        {!preview && (
          <form onSubmit={handleParse}>
            <textarea
              autoFocus
              className="json-import-textarea"
              placeholder='{"goals": [...]}'
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
            />
            {error && <p className="error-text json-import-error">{error}</p>}
            <div className="json-import-actions">
              <button type="submit" className="primary-button primary-button--small" disabled={!text.trim()}>
                読み込む
              </button>
              <button type="button" className="link-button" onClick={reset}>
                キャンセル
              </button>
            </div>
          </form>
        )}

        {preview && (
          <div className="json-import-preview">
            <p>
              {preview.summary.folderCount > 0 && `フォルダ${preview.summary.folderCount}件・`}
              ゴール{preview.summary.goalCount}件・ステップ{preview.summary.stepCount}件・Todo
              {preview.summary.todoCount}件を追加します
            </p>
            <div className="json-import-actions">
              <button
                type="button"
                className="primary-button primary-button--small"
                onClick={handleConfirmImport}
                disabled={importing}
              >
                {importing ? '取り込み中…' : '取り込む'}
              </button>
              <button type="button" className="link-button" onClick={reset} disabled={importing}>
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
