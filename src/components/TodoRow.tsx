import { useState } from 'react';
import type { Todo } from '../types';
import InlineText from './InlineText';
import DragHandle from './DragHandle';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { triggerClickFeel } from '../utils/clickFeel';
import { loadUiPrefs } from '../utils/uiPrefs';
import { useDragRowState } from '../dnd/DragContext';

interface Props {
  todo: Todo;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  meta?: string; // 「ゴール名 › ステップ名」など
  /** ツリービュー(StepBlock配下)でのみtrue。Todoビューではドラッグ&ドロップ非対応のため付けない */
  draggable?: boolean;
}

export default function TodoRow({ todo, onToggle, onRename, onDelete, meta, draggable = false }: Props) {
  const [justCompleted, setJustCompleted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const { isDragging, isShaking } = useDragRowState('todo', todo.id);

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
    <div
      className={`todo-row${todo.done ? ' todo-row--done' : ''}${draggable && isDragging ? ' dnd-dragging' : ''}${draggable && isShaking ? ' dnd-shake' : ''}`}
      data-drag-row={draggable ? 'todo' : undefined}
      data-drag-id={draggable ? todo.id : undefined}
    >
      {draggable && <DragHandle kind="todo" id={todo.id} label={`Todo「${todo.title}」`} />}
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
      <ConfirmDeleteButton onDelete={onDelete} label="削除" />
    </div>
  );
}
