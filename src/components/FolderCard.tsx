import { useState } from 'react';
import type { Folder, Goal, Step, Todo } from '../types';
import { calcFolderProgressPercent } from '../utils/progress';
import ProgressBar from './ProgressBar';
import InlineText from './InlineText';
import GoalCard from './GoalCard';
import DragHandle from './DragHandle';
import ConfirmDeleteButton from './ConfirmDeleteButton';
import { useData } from '../context/DataContext';
import { useDragRowState } from '../dnd/DragContext';

interface Props {
  folder: Folder;
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

export default function FolderCard({ folder, goals, steps, todos }: Props) {
  const { renameFolder, removeFolder } = useData();
  const [expanded, setExpanded] = useState(true);
  const { isDragging, isShaking } = useDragRowState('folder', folder.id);

  const percent = calcFolderProgressPercent(goals, steps, todos);

  return (
    <div
      className={`folder-card${isDragging ? ' dnd-dragging' : ''}${isShaking ? ' dnd-shake' : ''}`}
      data-drag-row="folder"
      data-drag-id={folder.id}
    >
      <div className="folder-card-header">
        <DragHandle kind="folder" id={folder.id} label={`フォルダ「${folder.title}」`} />
        <button
          type="button"
          className="expand-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? '折りたたむ' : '展開する'}
        >
          <span className={`chevron${expanded ? ' chevron--open' : ''}`}>›</span>
        </button>
        <div className="folder-card-title-row">
          <span className="folder-icon" aria-hidden="true">📁</span>
          <InlineText value={folder.title} onChange={(t) => renameFolder(folder.id, t)} className="folder-title" />
        </div>
        <ConfirmDeleteButton onDelete={() => removeFolder(folder.id)} label="フォルダを削除" />
      </div>

      <div className="folder-progress-row">
        <ProgressBar percent={percent} />
        <span className="goal-progress-percent">{percent}%</span>
      </div>

      {expanded && (
        <div className="folder-card-body">
          {goals.length === 0 && <p className="muted-text folder-empty">ゴールがありません</p>}
          {goals.map((goal) => {
            const goalSteps = steps.filter((s) => s.goalId === goal.id).sort((a, b) => a.sortOrder - b.sortOrder);
            const stepIds = new Set(goalSteps.map((s) => s.id));
            const goalTodos = todos.filter((t) => stepIds.has(t.stepId));
            return <GoalCard key={goal.id} goal={goal} steps={goalSteps} todos={goalTodos} />;
          })}
        </div>
      )}
    </div>
  );
}
