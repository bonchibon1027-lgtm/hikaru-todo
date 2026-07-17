import { useState } from 'react';
import type { Folder, Goal, Step, Todo } from '../types';
import { calcFolderProgressPercent } from '../utils/progress';
import ProgressBar from './ProgressBar';
import InlineText from './InlineText';
import GoalCard from './GoalCard';
import { useData } from '../context/DataContext';

interface Props {
  folder: Folder;
  goals: Goal[];
  steps: Step[];
  todos: Todo[];
}

export default function FolderCard({ folder, goals, steps, todos }: Props) {
  const { renameFolder, removeFolder } = useData();
  const [expanded, setExpanded] = useState(true);

  const percent = calcFolderProgressPercent(goals, steps, todos);

  function handleDelete() {
    const ok = window.confirm(
      `フォルダ「${folder.title}」を削除しますか?\n中のゴールは削除されず、トップレベルに戻ります。`
    );
    if (!ok) return;
    removeFolder(folder.id);
  }

  return (
    <div className="folder-card">
      <div className="folder-card-header">
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
        <button type="button" className="row-delete-button" onClick={handleDelete} aria-label="フォルダを削除">
          ×
        </button>
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
