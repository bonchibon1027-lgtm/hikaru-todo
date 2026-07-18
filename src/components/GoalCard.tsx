import { useState } from 'react';
import type { Goal, Step, Todo } from '../types';
import { calcGoalProgressPercent, formatDueLabel, getCurrentStep } from '../utils/progress';
import ProgressBar from './ProgressBar';
import InlineText from './InlineText';
import StepBlock from './StepBlock';
import AddInlineForm from './AddInlineForm';
import DragHandle from './DragHandle';
import { useData } from '../context/DataContext';
import { useDragRowState } from '../dnd/DragContext';

interface Props {
  goal: Goal;
  steps: Step[];
  todos: Todo[];
}

export default function GoalCard({ goal, steps, todos }: Props) {
  const { folders, renameGoal, removeGoal, setGoalStatus, setGoalDueDate, moveGoalToFolder, addStep } = useData();
  const [expanded, setExpanded] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderSubmenu, setFolderSubmenu] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const { isDragging, isShaking } = useDragRowState('goal', goal.id);

  const percent = calcGoalProgressPercent(steps, todos);
  const dueLabel = formatDueLabel(goal.dueDate);
  const currentStep = getCurrentStep(steps);

  function closeMenu() {
    setMenuOpen(false);
    setFolderSubmenu(false);
  }

  return (
    <div
      className={`goal-card${goal.status !== 'active' ? ' goal-card--inactive' : ''}${isDragging ? ' dnd-dragging' : ''}${isShaking ? ' dnd-shake' : ''}`}
      data-drag-row="goal"
      data-drag-id={goal.id}
    >
      <div className="goal-card-header">
        <DragHandle kind="goal" id={goal.id} label={`ゴール「${goal.title}」`} />
        <button
          type="button"
          className="expand-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? '折りたたむ' : '展開する'}
        >
          <span className={`chevron${expanded ? ' chevron--open' : ''}`}>›</span>
        </button>
        <div className="goal-card-title-row">
          <InlineText value={goal.title} onChange={(t) => renameGoal(goal.id, t)} className="goal-title" />
          {goal.status === 'done' && <span className="status-pill status-pill--done">完了</span>}
          {goal.status === 'archived' && <span className="status-pill status-pill--archived">アーカイブ</span>}
        </div>
        <div className="goal-menu-wrap">
          <button
            type="button"
            className="menu-trigger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="ゴールメニュー"
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="goal-menu" onMouseLeave={closeMenu}>
              {!folderSubmenu ? (
                <>
                  {goal.status !== 'active' && (
                    <button onClick={() => { setGoalStatus(goal.id, 'active'); closeMenu(); }}>
                      再開する
                    </button>
                  )}
                  {goal.status !== 'done' && (
                    <button onClick={() => { setGoalStatus(goal.id, 'done'); closeMenu(); }}>
                      完了にする
                    </button>
                  )}
                  {goal.status !== 'archived' && (
                    <button onClick={() => { setGoalStatus(goal.id, 'archived'); closeMenu(); }}>
                      アーカイブ
                    </button>
                  )}
                  <button onClick={() => { setEditingDue(true); closeMenu(); }}>期限を変更</button>
                  <button onClick={() => setFolderSubmenu(true)}>フォルダへ移動</button>
                  <button className="menu-danger" onClick={() => { removeGoal(goal.id); closeMenu(); }}>
                    削除
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setFolderSubmenu(false)}>← 戻る</button>
                  {goal.folderId !== null && (
                    <button onClick={() => { moveGoalToFolder(goal.id, null); closeMenu(); }}>
                      フォルダから出す
                    </button>
                  )}
                  {folders.length === 0 && <p className="folder-menu-empty muted-text">フォルダがありません</p>}
                  {[...folders]
                    .filter((f) => f.id !== goal.folderId)
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((f) => (
                      <button key={f.id} onClick={() => { moveGoalToFolder(goal.id, f.id); closeMenu(); }}>
                        {f.title}
                      </button>
                    ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="goal-progress-row">
        <ProgressBar percent={percent} />
        <span className="goal-progress-percent">{percent}%</span>
      </div>
      {dueLabel && (
        <div className={`due-label${dueLabel.overdue ? ' due-label--overdue' : ''}`}>{dueLabel.text}</div>
      )}

      {editingDue && (
        <DueDateEditor
          value={goal.dueDate}
          onSave={(v) => {
            setGoalDueDate(goal.id, v);
            setEditingDue(false);
          }}
          onCancel={() => setEditingDue(false)}
        />
      )}

      {expanded && (
        <div className="goal-card-body">
          {steps.map((step, idx) => (
            <StepBlock
              key={step.id}
              step={step}
              stepNumber={idx + 1}
              todos={todos.filter((t) => t.stepId === step.id).sort((a, b) => a.sortOrder - b.sortOrder)}
              isCurrent={currentStep?.id === step.id}
            />
          ))}
          <AddInlineForm placeholder="ステップを追加" onAdd={(title) => addStep(goal.id, title)} />
        </div>
      )}
    </div>
  );
}

function DueDateEditor({
  value,
  onSave,
  onCancel,
}: {
  value: string | null;
  onSave: (value: string | null) => void;
  onCancel: () => void;
}) {
  const [noDue, setNoDue] = useState(value === null);
  const [date, setDate] = useState(value ?? '');

  return (
    <div className="due-editor">
      <label className="due-editor-option">
        <input
          type="checkbox"
          checked={noDue}
          onChange={(e) => setNoDue(e.target.checked)}
        />
        無期限
      </label>
      {!noDue && (
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="due-editor-date"
        />
      )}
      <div className="due-editor-actions">
        <button
          type="button"
          className="primary-button primary-button--small"
          onClick={() => onSave(noDue ? null : date || null)}
        >
          保存
        </button>
        <button type="button" className="link-button" onClick={onCancel}>
          キャンセル
        </button>
      </div>
    </div>
  );
}
