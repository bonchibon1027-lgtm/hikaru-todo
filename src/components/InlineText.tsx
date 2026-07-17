import { useEffect, useRef, useState } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  as?: 'span' | 'div';
}

/**
 * クリックでインライン編集できるテキスト。
 * Enterまたはフォーカスアウトで確定、Escapeでキャンセル。
 */
export default function InlineText({ value, onChange, className, placeholder, as = 'span' }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) {
      onChange(trimmed);
    }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`inline-edit-input${className ? ` ${className}` : ''}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  const Tag = as;
  return (
    <Tag
      className={`inline-edit-text${className ? ` ${className}` : ''}`}
      onClick={() => setEditing(true)}
      title="クリックして編集"
    >
      {value || placeholder}
    </Tag>
  );
}
