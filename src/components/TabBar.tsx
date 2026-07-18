export type ViewKey = 'todo' | 'tree' | 'records';

interface Props {
  active: ViewKey;
  onChange: (view: ViewKey) => void;
}

const TABS: { key: ViewKey; label: string }[] = [
  { key: 'todo', label: 'Todo' },
  { key: 'tree', label: 'ツリー' },
  { key: 'records', label: '記録' },
];

export default function TabBar({ active, onChange }: Props) {
  return (
    <nav className="tab-bar">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className={`tab-button${active === tab.key ? ' tab-button--active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
