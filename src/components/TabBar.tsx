export type ViewKey = 'todo' | 'tree';

interface Props {
  active: ViewKey;
  onChange: (view: ViewKey) => void;
}

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar">
      <button
        type="button"
        className={`tab-button${active === 'todo' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('todo')}
      >
        Todo
      </button>
      <button
        type="button"
        className={`tab-button${active === 'tree' ? ' tab-button--active' : ''}`}
        onClick={() => onChange('tree')}
      >
        ツリー
      </button>
    </nav>
  );
}
