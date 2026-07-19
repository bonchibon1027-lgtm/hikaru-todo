import { useState } from 'react';

interface Props {
  value: string | null;
  onSave: (value: string | null) => void;
  onCancel: () => void;
}

/**
 * 期限インラインエディタ(ゴールの期限UIで確立した流儀を共通化。v3.1でステップ・Todoにも流用)。
 * 「無期限」チェックボックス+日付inputのシンプルな組み合わせ。
 * クリックが親のクリック可能な行(例: ステップヘッダーの展開トグル)に伝播しないよう、
 * ルート要素でstopPropagationしておく(呼び出し側で個別に対応しなくてよいようにするため)。
 */
export default function DueDateEditor({ value, onSave, onCancel }: Props) {
  const [noDue, setNoDue] = useState(value === null);
  const [date, setDate] = useState(value ?? '');

  return (
    <div className="due-editor" onClick={(e) => e.stopPropagation()}>
      <label className="due-editor-option">
        <input type="checkbox" checked={noDue} onChange={(e) => setNoDue(e.target.checked)} />
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
