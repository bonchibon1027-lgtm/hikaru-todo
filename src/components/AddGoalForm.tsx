import { useState, type FormEvent } from 'react';
import { useData } from '../context/DataContext';

export default function AddGoalForm() {
  const { addGoal } = useData();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [noDue, setNoDue] = useState(true);
  const [date, setDate] = useState('');

  function reset() {
    setTitle('');
    setNoDue(true);
    setDate('');
    setOpen(false);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) return;
    addGoal(trimmed, noDue ? null : date || null);
    reset();
  }

  if (!open) {
    return (
      <button type="button" className="fab-button" onClick={() => setOpen(true)} aria-label="ゴールを追加">
        +
      </button>
    );
  }

  return (
    <div className="add-goal-overlay" onClick={reset}>
      <form className="add-goal-form" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <h2 className="add-goal-title">新しいゴール</h2>
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="ゴールのタイトル"
          className="add-goal-input"
        />
        <div className="due-editor-option-row">
          <label className="due-editor-option">
            <input type="checkbox" checked={noDue} onChange={(e) => setNoDue(e.target.checked)} />
            無期限
          </label>
          {!noDue && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="due-editor-date" />
          )}
        </div>
        <div className="add-goal-actions">
          <button type="submit" className="primary-button" disabled={!title.trim()}>
            追加する
          </button>
          <button type="button" className="link-button" onClick={reset}>
            キャンセル
          </button>
        </div>
      </form>
    </div>
  );
}
