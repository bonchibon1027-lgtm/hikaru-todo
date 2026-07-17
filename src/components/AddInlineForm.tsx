import { useState, type FormEvent } from 'react';

interface Props {
  placeholder: string;
  onAdd: (title: string) => void;
  className?: string;
}

export default function AddInlineForm({ placeholder, onAdd, className }: Props) {
  const [value, setValue] = useState('');

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setValue('');
  }

  return (
    <form className={`add-inline-form${className ? ` ${className}` : ''}`} onSubmit={handleSubmit}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="add-inline-input"
      />
      <button type="submit" className="add-inline-button" aria-label="追加" disabled={!value.trim()}>
        +
      </button>
    </form>
  );
}
