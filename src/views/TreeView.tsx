import { useData } from '../context/DataContext';
import type { Goal } from '../types';
import GoalCard from '../components/GoalCard';
import FolderCard from '../components/FolderCard';
import AddFolderButton from '../components/AddFolderButton';
import AddGoalForm from '../components/AddGoalForm';
import JsonImportPanel from '../components/JsonImportPanel';
import JsonExportPanel from '../components/JsonExportPanel';

const STATUS_ORDER = { active: 0, done: 1, archived: 2 } as const;

function sortGoals(goals: Goal[]): Goal[] {
  return [...goals].sort((a, b) => {
    const statusDiff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (statusDiff !== 0) return statusDiff;
    return a.sortOrder - b.sortOrder;
  });
}

export default function TreeView() {
  const { folders, goals, steps, todos, loading } = useData();

  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);
  const topLevelGoals = sortGoals(goals.filter((g) => g.folderId === null));
  const isEmpty = !loading && folders.length === 0 && goals.length === 0;

  return (
    <div className="view-container tree-view">
      {loading && <p className="muted-text center-text">読み込み中…</p>}
      {isEmpty && (
        <div className="empty-state">
          <p className="empty-state-emoji">✨</p>
          <p>ゴールを追加してはじめよう</p>
        </div>
      )}
      <AddFolderButton />
      <div className="goal-list">
        {sortedFolders.map((folder) => {
          const folderGoals = sortGoals(goals.filter((g) => g.folderId === folder.id));
          return <FolderCard key={folder.id} folder={folder} goals={folderGoals} steps={steps} todos={todos} />;
        })}
        {topLevelGoals.map((goal) => {
          const goalSteps = steps.filter((s) => s.goalId === goal.id).sort((a, b) => a.sortOrder - b.sortOrder);
          const stepIds = new Set(goalSteps.map((s) => s.id));
          const goalTodos = todos.filter((t) => stepIds.has(t.stepId));
          return <GoalCard key={goal.id} goal={goal} steps={goalSteps} todos={goalTodos} />;
        })}
      </div>
      <AddGoalForm />
      <div className="json-actions-row">
        <JsonImportPanel />
        <JsonExportPanel />
      </div>
    </div>
  );
}
