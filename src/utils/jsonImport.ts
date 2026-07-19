// JSONインポート(v1.1で追加、v1.2でフォルダ対応)の パース & バリデーション

export interface ImportTodoInput {
  title: string;
  /** v2追加。エクスポートJSONの再インポート用。省略時はfalse扱い */
  done: boolean;
  /** v3.1追加。省略時はnull(無期限)扱い */
  dueDate: string | null;
}

export interface ImportStepInput {
  title: string;
  todos: ImportTodoInput[];
  /** v2追加。エクスポートJSONの再インポート用。省略時は'active'扱い */
  status: 'active' | 'done';
  /** v3.1追加。省略時はnull(無期限)扱い */
  dueDate: string | null;
}

export interface ImportGoalInput {
  title: string;
  dueDate: string | null;
  steps: ImportStepInput[];
}

export interface ImportFolderInput {
  title: string;
  goals: ImportGoalInput[];
}

export interface ImportData {
  folders: ImportFolderInput[];
  goals: ImportGoalInput[];
}

export interface ImportSummary {
  folderCount: number;
  goalCount: number;
  stepCount: number;
  todoCount: number;
}

export type ImportParseResult =
  | { ok: true; data: ImportData; summary: ImportSummary }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * dueDate が有効な "YYYY-MM-DD" 文字列かどうか(暦上実在する日付かも含めてチェック)
 */
function isValidDateString(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/**
 * dueDateフィールドの共通パース&バリデーション(v3.1追加)。
 * ゴール・ステップ・Todo(オブジェクト形式)いずれの `dueDate` フィールドにも使う。
 * 省略またはnullは無期限(null)扱い。
 */
function parseDueDateField(
  raw: Record<string, unknown>,
  label: string
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw.dueDate === undefined || raw.dueDate === null) {
    return { ok: true, value: null };
  }
  if (typeof raw.dueDate !== 'string' || !isValidDateString(raw.dueDate)) {
    return { ok: false, error: `${label}のdueDateの形式が正しくありません(YYYY-MM-DD)` };
  }
  return { ok: true, value: raw.dueDate };
}

type GoalParseResult =
  | { ok: true; goal: ImportGoalInput; stepCount: number; todoCount: number }
  | { ok: false; error: string };

/** 1件のゴール(トップレベル・フォルダ内どちらでも共通)をパース&バリデーションする */
function parseGoalInput(raw: unknown, label: string): GoalParseResult {
  if (!isPlainObject(raw)) {
    return { ok: false, error: `${label}の形式が正しくありません` };
  }
  if (typeof raw.title !== 'string' || !raw.title.trim()) {
    return { ok: false, error: `${label}にtitleがありません` };
  }

  const goalDueDateResult = parseDueDateField(raw, label);
  if (!goalDueDateResult.ok) return goalDueDateResult;
  const dueDate = goalDueDateResult.value;

  const stepsRaw = raw.steps === undefined ? [] : raw.steps;
  if (!Array.isArray(stepsRaw)) {
    return { ok: false, error: `${label}のstepsが配列ではありません` };
  }

  const steps: ImportStepInput[] = [];
  let todoCount = 0;
  for (let si = 0; si < stepsRaw.length; si++) {
    const s = stepsRaw[si];
    const sLabel = `${label}の${si + 1}番目のステップ`;
    if (!isPlainObject(s)) {
      return { ok: false, error: `${sLabel}の形式が正しくありません` };
    }
    if (typeof s.title !== 'string' || !s.title.trim()) {
      return { ok: false, error: `${sLabel}にtitleがありません` };
    }

    // status(v2追加): エクスポートJSONの再インポート用。省略時は'active'
    let status: 'active' | 'done' = 'active';
    if (s.status !== undefined) {
      if (s.status !== 'active' && s.status !== 'done') {
        return { ok: false, error: `${sLabel}のstatusの形式が正しくありません` };
      }
      status = s.status;
    }

    // dueDate(v3.1追加): 省略時はnull(無期限)
    const stepDueDateResult = parseDueDateField(s, sLabel);
    if (!stepDueDateResult.ok) return stepDueDateResult;
    const stepDueDate = stepDueDateResult.value;

    const todosRaw = s.todos === undefined ? [] : s.todos;
    if (!Array.isArray(todosRaw)) {
      return { ok: false, error: `${sLabel}のtodosが配列ではありません` };
    }

    const todos: ImportTodoInput[] = [];
    for (let ti = 0; ti < todosRaw.length; ti++) {
      const t = todosRaw[ti];
      const tLabel = `${sLabel}の${ti + 1}番目のTodo`;
      if (typeof t === 'string') {
        if (!t.trim()) {
          return { ok: false, error: `${tLabel}の形式が正しくありません` };
        }
        todos.push({ title: t.trim(), done: false, dueDate: null });
        continue;
      }
      // オブジェクト形式(v2追加): { title, done, dueDate } 。エクスポートJSONの再インポート用
      if (isPlainObject(t)) {
        if (typeof t.title !== 'string' || !t.title.trim()) {
          return { ok: false, error: `${tLabel}の形式が正しくありません` };
        }
        let done = false;
        if (t.done !== undefined) {
          if (typeof t.done !== 'boolean') {
            return { ok: false, error: `${tLabel}のdoneの形式が正しくありません` };
          }
          done = t.done;
        }
        // dueDate(v3.1追加): 省略時はnull(無期限)
        const todoDueDateResult = parseDueDateField(t, tLabel);
        if (!todoDueDateResult.ok) return todoDueDateResult;
        todos.push({ title: t.title.trim(), done, dueDate: todoDueDateResult.value });
        continue;
      }
      return { ok: false, error: `${tLabel}の形式が正しくありません` };
    }

    steps.push({ title: s.title.trim(), todos, status, dueDate: stepDueDate });
    todoCount += todos.length;
  }

  return { ok: true, goal: { title: raw.title.trim(), dueDate, steps }, stepCount: steps.length, todoCount };
}

export function parseImportJson(raw: string): ImportParseResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: 'テキストが入力されていません' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, error: 'JSONの形式が正しくありません' };
  }

  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'JSONの形式が正しくありません' };
  }

  const hasFolders = parsed.folders !== undefined;
  const hasGoals = parsed.goals !== undefined;
  if (!hasFolders && !hasGoals) {
    return { ok: false, error: 'goals配列がありません' };
  }

  const foldersRaw = hasFolders ? parsed.folders : [];
  if (!Array.isArray(foldersRaw)) {
    return { ok: false, error: 'folders配列の形式が正しくありません' };
  }

  const goalsRaw = hasGoals ? parsed.goals : [];
  if (!Array.isArray(goalsRaw)) {
    return { ok: false, error: 'goals配列の形式が正しくありません' };
  }

  if (foldersRaw.length === 0 && goalsRaw.length === 0) {
    return { ok: false, error: 'ゴールが1件もありません' };
  }

  const folders: ImportFolderInput[] = [];
  const goals: ImportGoalInput[] = [];
  let goalCount = 0;
  let stepCount = 0;
  let todoCount = 0;

  for (let fi = 0; fi < foldersRaw.length; fi++) {
    const f = foldersRaw[fi];
    const fLabel = `${fi + 1}番目のフォルダ`;
    if (!isPlainObject(f)) {
      return { ok: false, error: `${fLabel}の形式が正しくありません` };
    }
    if (typeof f.title !== 'string' || !f.title.trim()) {
      return { ok: false, error: `${fLabel}にtitleがありません` };
    }

    const goalsInFolderRaw = f.goals === undefined ? [] : f.goals;
    if (!Array.isArray(goalsInFolderRaw)) {
      return { ok: false, error: `${fLabel}のgoalsが配列ではありません` };
    }

    const goalsInFolder: ImportGoalInput[] = [];
    for (let gi = 0; gi < goalsInFolderRaw.length; gi++) {
      const gLabel = `${fLabel}の${gi + 1}番目のゴール`;
      const result = parseGoalInput(goalsInFolderRaw[gi], gLabel);
      if (!result.ok) return result;
      goalsInFolder.push(result.goal);
      stepCount += result.stepCount;
      todoCount += result.todoCount;
    }

    folders.push({ title: f.title.trim(), goals: goalsInFolder });
    goalCount += goalsInFolder.length;
  }

  for (let gi = 0; gi < goalsRaw.length; gi++) {
    const gLabel = `${gi + 1}番目のゴール`;
    const result = parseGoalInput(goalsRaw[gi], gLabel);
    if (!result.ok) return result;
    goals.push(result.goal);
    stepCount += result.stepCount;
    todoCount += result.todoCount;
    goalCount += 1;
  }

  return {
    ok: true,
    data: { folders, goals },
    summary: { folderCount: folders.length, goalCount, stepCount, todoCount },
  };
}
