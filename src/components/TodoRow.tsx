import { useState } from 'react';
import type { Todo } from '../types';
import InlineText from './InlineText';
import { triggerClickFeel } from '../utils/clickFeel';
import { loadUiPrefs } from '../utils/uiPrefs';

interface Props {
  todo: Todo;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  meta?: string; // 「ゴール名 › ステップ名」など
}

export default function TodoRow({ todo, onToggle, onRename, onDelete, meta }: Props) {
  const [justCompleted, setJustCompleted] = useState(false);
  const [pressed, setPressed] = useState(false);

  function handleToggle() {
    setPressed(true);
    window.setTimeout(() => setPressed(false), 160);
    if (!todo.done) {
      setJustCompleted(true);
      window.setTimeout(() => setJustCompleted(false), 500);
      triggerClickFeel(loadUiPrefs().soundMuted);
    }
    onToggle();
  }

  return (
    <div className={`todo-row${todo.done ? ' todo-row--done' : ''}`}>
      <button
        type="button"
        className={`todo-checkbox${justCompleted ? ' todo-checkbox--flash' : ''}${todo.done ? ' todo-checkbox--checked' : ''}${pressed ? ' checkbox--press' : ''}`}
        onClick={handleToggle}
        aria-label={todo.done ? '未完了に戻す' : '完了にする'}
      >
        {todo.done && (
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M2 8.5L6 12L14 4" stroke="#121212" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <div className="todo-row-body">
        <InlineText value={todo.title} onChange={onRename} className="todo-title" />
        {meta && <div className="todo-meta">{meta}</div>}
      </div>
      <button type="button" className="row-delete-button" onClick={onDelete} aria-label="削除">
        ×
      </button>
    </div>
  );
}
