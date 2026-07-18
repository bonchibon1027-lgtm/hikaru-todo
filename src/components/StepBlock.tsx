import { useEffect, useRef, useState } from 'react';
import type { Step, Todo } from '../types';
import { calcTodoProgress, calcStepProgressPercent } from '../utils/progress';
import InlineText from './InlineText';
import TodoRow from './TodoRow';
import AddInlineForm from './AddInlineForm';
import DragHandle from './DragHandle';
import { useData } from '../context/DataContext';
import { triggerClickFeel } from '../utils/clickFeel';
import { loadUiPrefs } from '../utils/uiPrefs';
import { useDragRowState } from '../dnd/DragContext';

interface Props {
  step: Step;
  stepNumber: number;
  todos: Todo[];
  /** ゴール内でsortOrderが最初の未完了ステップかどうか(v1.2追加。NOWバッジ+デフォルト展開に使う) */
  isCurrent: boolean;
}

export default function StepBlock({ step, stepNumber, todos, isCurrent }: Props) {
  const { renameStep, removeStep, addTodo, renameTodo, toggleTodo, removeTodo, setStepStatus } = useData();
  const { done, total } = calcTodoProgress(todos);
  const percent = calcStepProgressPercent(step, todos);
  const isDone = step.status === 'done';
  // 完了ステップは折りたたみ、現在のステップは展開、それより先の未来ステップは折りたたみがデフォルト
  const [expanded, setExpanded] = useState(!isDone && isCurrent);
  const [pressed, setPressed] = useState(false);
  const prevIsDone = useRef(isDone);
  const prevIsCurrent = useRef(isCurrent);
  const { isDragging, isShaking } = useDragRowState('step', step.id);

  useEffect(() => {
    if (isDone && !prevIsDone.current) {
      setExpanded(false);
    }
    prevIsDone.current = isDone;
  }, [isDone]);

  useEffect(() => {
    // ステップ完了により次のステップが「現在のステップ」として解放されたら自動展開する
    if (isCurrent && !prevIsCurrent.current && !isDone) {
      setExpanded(true);
    }
    prevIsCurrent.current = isCurrent;
  }, [isCurrent, isDone]);

  return (
    <div
      className={`step-block${isDone ? ' step-block--done' : ''}${isDragging ? ' dnd-dragging' : ''}${isShaking ? ' dnd-shake' : ''}`}
      data-drag-row="step"
      data-drag-id={step.id}
    >
      <div className="step-header" onClick={() => setExpanded((v) => !v)}>
        <DragHandle kind="step" id={step.id} label={`ステップ「${step.title}」`} />
        <button
          type="button"
          className={`step-checkbox${isDone ? ' step-checkbox--checked' : ''}${pressed ? ' checkbox--press' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            const nextDone = !isDone;
            setPressed(true);
            window.setTimeout(() => setPressed(false), 160);
            if (nextDone) triggerClickFeel(loadUiPrefs().soundMuted);
            setStepStatus(step.id, nextDone ? 'done' : 'active');
          }}
          aria-label={isDone ? 'ステップを未完了に戻す' : 'ステップを完了にする'}
        >
          {isDone && (
            <svg viewBox="0 0 16 16" width="10" height="10" aria-hidden="true">
              <path d="M2 8.5L6 12L14 4" stroke="#121212" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <span className="step-number">STEP {stepNumber}</span>
        {isCurrent && !isDone && <span className="now-badge">NOW</span>}
        <div className="step-title-wrap" onClick={(e) => e.stopPropagation()}>
          <InlineText value={step.title} onChange={(t) => renameStep(step.id, t)} className="step-title" />
        </div>
        <span className="step-progress-mini">
          {done}/{total || 0}
        </span>
        <button
          type="button"
          className="row-delete-button"
          onClick={(e) => {
            e.stopPropagation();
            removeStep(step.id);
          }}
          aria-label="ステップを削除"
        >
          ×
        </button>
        <span className={`chevron${expanded ? ' chevron--open' : ''}`}>›</span>
      </div>

      {expanded && (
        <div className="step-body">
          {total > 0 && (
            <div className="step-progress-bar">
              <div className="progress-track progress-track--thin">
                <div className="progress-fill" style={{ width: `${percent}%` }} />
              </div>
            </div>
          )}
          <div className="todo-list">
            {todos.map((todo) => (
              <TodoRow
                key={todo.id}
                todo={todo}
                draggable
                onToggle={() => toggleTodo(todo.id)}
                onRename={(title) => renameTodo(todo.id, title)}
                onDelete={() => removeTodo(todo.id)}
              />
            ))}
          </div>
          <AddInlineForm placeholder="Todoを追加" onAdd={(title) => addTodo(step.id, title)} />
        </div>
      )}
    </div>
  );
}
