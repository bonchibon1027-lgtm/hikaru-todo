// JSONエクスポート(v2追加)。現在の全active(非アーカイブ)データを、
// jsonImport.ts が受理するインポート互換フォーマットに整形する。
// 進捗情報として todo に "done": true(完了のみ)、step に "status": "done"(完了のみ)を含める。

import type { Folder, Goal, Step, Todo } from '../types';

interface ExportTodo {
  title: string;
  done?: true;
}

interface ExportStep {
  title: string;
  todos: ExportTodo[];
  status?: 'done';
}

interface ExportGoal {
  title: string;
  dueDate: string | null;
  steps: ExportStep[];
}

interface ExportFolder {
  title: string;
  goals: ExportGoal[];
}

export interface ExportData {
  folders: ExportFolder[];
  goals: ExportGoal[];
}

function buildGoalExport(goal: Goal, steps: Step[], todos: Todo[]): ExportGoal {
  const goalSteps = steps.filter((s) => s.goalId === goal.id).sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    title: goal.title,
    dueDate: goal.dueDate,
    steps: goalSteps.map((step) => {
      const stepTodos = todos.filter((t) => t.stepId === step.id).sort((a, b) => a.sortOrder - b.sortOrder);
      const exportedStep: ExportStep = {
        title: step.title,
        todos: stepTodos.map((t) => (t.done ? { title: t.title, done: true } : { title: t.title })),
      };
      if (step.status === 'done') {
        exportedStep.status = 'done';
      }
      return exportedStep;
    }),
  };
}

/**
 * 全active(非アーカイブ)データをインポート互換形式に整形する。
 * フォルダは、対象ゴールを1件も含まない場合はエクスポートに含めない(空フォルダを増やさないため)。
 */
export function buildExportData(folders: Folder[], goals: Goal[], steps: Step[], todos: Todo[]): ExportData {
  const activeGoals = goals.filter((g) => g.status !== 'archived');
  const sortedFolders = [...folders].sort((a, b) => a.sortOrder - b.sortOrder);

  const exportFolders: ExportFolder[] = [];
  for (const folder of sortedFolders) {
    const goalsInFolder = activeGoals
      .filter((g) => g.folderId === folder.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    if (goalsInFolder.length === 0) continue;
    exportFolders.push({
      title: folder.title,
      goals: goalsInFolder.map((g) => buildGoalExport(g, steps, todos)),
    });
  }

  const topLevelGoals = activeGoals
    .filter((g) => g.folderId === null)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    folders: exportFolders,
    goals: topLevelGoals.map((g) => buildGoalExport(g, steps, todos)),
  };
}

export function formatExportJson(folders: Folder[], goals: Goal[], steps: Step[], todos: Todo[]): string {
  return JSON.stringify(buildExportData(folders, goals, steps, todos), null, 2);
}
