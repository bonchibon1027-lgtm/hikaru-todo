import { useEffect, useState } from 'react';
import type { Step, Todo } from '../types';
import { useData } from '../context/DataContext';
import { getRepository, isSupabaseConfigured } from '../repository';
import { readLocalSnapshot, hasLocalData } from '../repository/localRepository';

// クラウド移行バナー(v2追加)。
// 初回ログイン後、クラウド側が空 かつ ローカルに hikaru-todo-data がある場合に表示し、
// 実行するとローカル全データを順序を保ったままSupabaseへ投入する。失敗時はローカルを消さない。
export default function MigrationBanner() {
  const { folders, goals, steps, todos, loading, reload } = useData();
  const [checked, setChecked] = useState(false);
  const [visible, setVisible] = useState(false);
  const [migrating, setMigrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || loading || checked) return;
    const cloudEmpty = folders.length === 0 && goals.length === 0 && steps.length === 0 && todos.length === 0;
    if (cloudEmpty && hasLocalData(readLocalSnapshot())) {
      setVisible(true);
    }
    setChecked(true);
  }, [loading, checked, folders.length, goals.length, steps.length, todos.length]);

  if (!isSupabaseConfigured || !visible) return null;

  async function handleMigrate() {
    setMigrating(true);
    setError(null);
    const snapshot = readLocalSnapshot();
    if (!snapshot) {
      setError('ローカルデータの読み込みに失敗しました');
      setMigrating(false);
      return;
    }

    const repo = getRepository();
    try {
      const folderIdMap = new Map<string, string>();
      for (const folder of [...snapshot.folders].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const created = await repo.createFolder({ title: folder.title });
        folderIdMap.set(folder.id, created.id);
      }

      const goalIdMap = new Map<string, string>();
      for (const goal of [...snapshot.goals].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const mappedFolderId = goal.folderId ? (folderIdMap.get(goal.folderId) ?? null) : null;
        const created = await repo.createGoal({ title: goal.title, dueDate: goal.dueDate, folderId: mappedFolderId });
        if (goal.status !== 'active') {
          await repo.updateGoal(created.id, { status: goal.status });
        }
        goalIdMap.set(goal.id, created.id);
      }

      const stepIdMap = new Map<string, string>();
      for (const step of [...snapshot.steps].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const mappedGoalId = goalIdMap.get(step.goalId);
        if (!mappedGoalId) continue;
        const created = await repo.createStep({ goalId: mappedGoalId, title: step.title });
        const stepPatch: Partial<Pick<Step, 'status' | 'dueDate'>> = {};
        if (step.status !== 'active') stepPatch.status = step.status;
        if (step.dueDate != null) stepPatch.dueDate = step.dueDate;
        if (Object.keys(stepPatch).length > 0) {
          await repo.updateStep(created.id, stepPatch);
        }
        stepIdMap.set(step.id, created.id);
      }

      for (const todo of [...snapshot.todos].sort((a, b) => a.sortOrder - b.sortOrder)) {
        const mappedStepId = stepIdMap.get(todo.stepId);
        if (!mappedStepId) continue;
        const created = await repo.createTodo({ stepId: mappedStepId, title: todo.title });
        const todoPatch: Partial<Pick<Todo, 'done' | 'completedAt' | 'dueDate'>> = {};
        if (todo.done) {
          todoPatch.done = true;
          todoPatch.completedAt = todo.completedAt ?? new Date().toISOString();
        }
        if (todo.dueDate != null) todoPatch.dueDate = todo.dueDate;
        if (Object.keys(todoPatch).length > 0) {
          await repo.updateTodo(created.id, todoPatch);
        }
      }

      await reload();
      setVisible(false);
    } catch (e) {
      // 失敗してもローカルデータ(localStorage)には一切触れていないので消えない
      setError(e instanceof Error ? e.message : '移行に失敗しました。もう一度お試しください');
    } finally {
      setMigrating(false);
    }
  }

  return (
    <div className="migration-banner">
      <p className="migration-banner-text">この端末に保存されたデータが見つかりました。クラウドへ移行しますか?</p>
      {error && <p className="error-text">{error}</p>}
      <div className="migration-banner-actions">
        <button
          type="button"
          className="primary-button primary-button--small"
          onClick={handleMigrate}
          disabled={migrating}
        >
          {migrating ? '移行中…' : 'この端末のデータをクラウドへ移行'}
        </button>
        <button type="button" className="link-button" onClick={() => setVisible(false)} disabled={migrating}>
          あとで
        </button>
      </div>
    </div>
  );
}
