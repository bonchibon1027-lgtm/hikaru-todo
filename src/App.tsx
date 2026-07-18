import { useMemo, useState } from 'react';
import './App.css';
import { DataProvider, useData } from './context/DataContext';
import AuthGate from './auth/AuthGate';
import TabBar, { type ViewKey } from './components/TabBar';
import TreeView from './views/TreeView';
import TodoView from './views/TodoView';
import RecordsView from './views/RecordsView';
import WidgetView from './views/WidgetView';
import StreakBadge from './components/StreakBadge';
import SoundToggle from './components/SoundToggle';
import CelebrationLayer from './components/CelebrationLayer';
import MigrationBanner from './components/MigrationBanner';
import { calcStreak } from './utils/streak';

// ウィジェットモード判定(v3追加)。`?widget=1` で起動された場合はWidgetViewのみを描画する。
const isWidgetMode =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('widget') === '1';

function getInitialView(): ViewKey {
  if (typeof window === 'undefined') return 'todo';
  return window.innerWidth >= 768 ? 'tree' : 'todo';
}

function AppShell() {
  const [view, setView] = useState<ViewKey>(getInitialView);
  const { error, todos } = useData();
  const streak = useMemo(() => calcStreak(todos), [todos]);

  // 保存データの読み込みに失敗した場合は、誤って上書き保存してしまわないよう
  // 通常画面(CRUD操作)を出さずエラー表示のみに留める。
  if (error) {
    return (
      <div className="app-shell">
        <header className="app-header">
          <h1 className="app-title">ひかるのやることリスト</h1>
        </header>
        <div className="fullscreen-center">
          <div className="login-card">
            <h2 className="login-title">データの読み込みに失敗しました</h2>
            <p className="error-text">{error}</p>
            <p className="muted-text">
              保存されているデータを壊さないよう、操作を中断しています。ページを再読み込みしても解決しない場合は、開発者にご連絡ください。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-row">
          <div className="app-header-side app-header-side--left">
            <StreakBadge streak={streak} />
          </div>
          <h1 className="app-title">ひかるのやることリスト</h1>
          <div className="app-header-side app-header-side--right">
            <SoundToggle />
          </div>
        </div>
      </header>
      <main className="app-main">
        <MigrationBanner />
        {view === 'tree' ? <TreeView /> : view === 'records' ? <RecordsView /> : <TodoView />}
      </main>
      <TabBar active={view} onChange={setView} />
      <CelebrationLayer />
    </div>
  );
}

function App() {
  // ウィジェットモード(v3追加): タブバー・FAB・インポート・演出なしの超軽量表示。
  // Supabaseモードでは未ログイン時に既存のログイン画面が出る(AuthGateをそのまま通す)。
  if (isWidgetMode) {
    return (
      <AuthGate>
        <DataProvider>
          <WidgetView />
        </DataProvider>
      </AuthGate>
    );
  }

  return (
    <AuthGate>
      <DataProvider>
        <AppShell />
      </DataProvider>
    </AuthGate>
  );
}

export default App;
