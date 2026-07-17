// UI状態(データではなく見た目の好み)の永続化。hikaru-todo-data とは別キーで保存する。

const UI_STORAGE_KEY = 'hikaru-todo-ui';

export interface UiPrefs {
  showAllTodos: boolean;
  /** チェック時のクリック音・振動をミュートするか。デフォルトはOFF(=音あり)。v2追加 */
  soundMuted: boolean;
}

const DEFAULT_PREFS: UiPrefs = { showAllTodos: false, soundMuted: false };

export function loadUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(UI_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      showAllTodos: parsed.showAllTodos === true,
      soundMuted: parsed.soundMuted === true,
    };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

/** 既存の保存内容とマージして保存する(片方の設定だけを更新しても他方を消さない)。 */
export function saveUiPrefs(patch: Partial<UiPrefs>): void {
  try {
    const current = loadUiPrefs();
    const next: UiPrefs = { ...current, ...patch };
    localStorage.setItem(UI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // UI状態の保存に失敗しても致命的ではないため無視する
  }
}
