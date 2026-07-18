import { useConfirmDelete } from '../hooks/useConfirmDelete';

interface Props {
  onDelete: () => void;
  /** アイドル時のaria-label(例: 「Todoを削除」) */
  label: string;
  className?: string;
}

/** 全×ボタン共通のインライン2段階削除確認ボタン(v3追加)。1回目「削除?」→2.5秒以内に2回目で確定。 */
export default function ConfirmDeleteButton({ onDelete, label, className }: Props) {
  const { armed, trigger, onPointerDown } = useConfirmDelete(onDelete);

  return (
    <button
      type="button"
      className={`row-delete-button${armed ? ' row-delete-button--confirm' : ''}${className ? ` ${className}` : ''}`}
      onClick={trigger}
      onPointerDown={onPointerDown}
      aria-label={armed ? `${label}: もう一度押すと削除します` : label}
    >
      {armed ? '削除?' : '×'}
    </button>
  );
}
