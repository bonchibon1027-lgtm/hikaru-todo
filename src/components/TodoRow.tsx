import { useState } from 'react';
import type { Todo } from '../types';
import { formatDueChip } from '../utils/progress';
import InlineText from './InlineText';
import DragHandle from './DragHandle';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import DueDateEditor from './DueDateEditor';
import { triggerClickFeel } from '../utils/clickFeel';
import { loadUiPrefs } from '../utils/uiPrefs';
import { useDragRowState } from '../dnd/DragContext';

interface Props {
  todo: Todo;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  /** v3.1追加。期限の設定・変更・「無期限」クリア */
  onDueDateChange: (dueDate: string | null) => void;
  meta?: string; // 「ゴール名 › ステップ名」など
  /** ツリービュー(StepBlock配下)でのみtrue。Todoビューではドラッグ&ドロップ非対応のため付けない */
  draggable?: boolean;
}

export default function TodoRow({
  todo,
  onToggle,
  onRename,
  onDelete,
  onDueDateChange,
  meta,
  draggable = false,
}: Props) {
  const [justCompleted, setJustCompleted] = useState(false);
  const [pressed, setPressed] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const { isDragging, isShaking } = useDragRowState('todo', todo.id);
  const dueChip = formatDueChip(todo.dueDate);

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
      {dueChip && (
        <span className={`due-chip${todo.done ? ' due-chip--muted' : dueChip.overdue ? ' due-chip--overdue' : ''}`}>
          {dueChip.text}
        </span>
      )}
      <button
        type="button"
        className="due-icon-button"
        onClick={() => setEditingDue((v) => !v)}
        aria-label="Todoの期限を設定"
      >
        📅
      </button>
      <ConfirmDeleteButton onDelete={onDelete} label="削除" />
      {editingDue && (
        <div className="todo-due-editor-inline">
          <DueDateEditor
            value={todo.dueDate}
            onSave={(v) => {
              onDueDateChange(v);
              setEditingDue(false);
            }}
            onCancel={() => setEditingDue(false)}
          />
        </div>
      )}
    </div>
  );
}
