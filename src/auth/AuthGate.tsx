import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../repository/supabaseClient';
import LoginScreen from './LoginScreen';

interface Props {
  children: ReactNode;
}

/**
 * Supabaseモード時のみログイン画面をゲートする。
 * ローカルモード(.env未設定)ではそのまま子要素を表示する。
 */
export default function AuthGate({ children }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isSupabaseConfigured) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="fullscreen-center">
        <p className="muted-text">読み込み中…</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  return <>{children}</>;
}
