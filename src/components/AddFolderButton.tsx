import { useState, type FormEvent } from 'react';
import { useData } from '../context/DataContext';

/** 「フォルダを追加」の控えめなトリガー(v1.2追加)。押すとインラインの入力フォームに切り替わる。 */
export default function AddFolderButton() {
  const { addFolder } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');

  function reset() {
    setTitle('');
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addFolder(trimmed);
    reset();
  }

  if (!open) {
    return (
      <button type="button" className="add-folder-trigger" onClick={() => setOpen(true)}>
        + フォルダを追加
      </button>
    );
  }

  return (
    <form className="add-inline-form add-folder-form" onSubmit={handleSubmit}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="フォルダ名"
        className="add-inline-input"
      />
      <button type="submit" className="add-inline-button" aria-label="フォルダを追加" disabled={!title.trim()}>
        +
      </button>
      <button type="button" className="row-delete-button" onClick={reset} aria-label="キャンセル">
        ×
      </button>
    </form>
  );
}
