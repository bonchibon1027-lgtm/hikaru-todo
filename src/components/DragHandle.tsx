import { useDragHandle } from '../dnd/DragContext';
import type { DragKind } from '../dnd/types';

interface Props {
  kind: DragKind;
  id: string;
  label: string;
}

/** ツリービュー各行の左端に置くドラッグ用グリップ(v2.1追加)。ここからのみドラッグを開始する。 */
export default function DragHandle({ kind, id, label }: Props) {
  const { onPointerDown } = useDragHandle(kind, id);

  return (
    <button
      type="button"
      className="drag-handle"
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      aria-label={`${label}をドラッグして並び替え`}
    >
      <svg viewBox="0 0 10 16" width="10" height="16" aria-hidden="true">
        <circle cx="2.5" cy="2.5" r="1.4" />
        <circle cx="7.5" cy="2.5" r="1.4" />
        <circle cx="2.5" cy="8" r="1.4" />
        <circle cx="7.5" cy="8" r="1.4" />
        <circle cx="2.5" cy="13.5" r="1.4" />
        <circle cx="7.5" cy="13.5" r="1.4" />
      </svg>
    </button>
  );
}
