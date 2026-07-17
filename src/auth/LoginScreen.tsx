import { useState, type FormEvent } from 'react';
import { supabase } from '../repository/supabaseClient';

// Supabase Authのエラーメッセージ(英語)を日本語に翻訳する(v2追加)。
// 未知のメッセージはそのまま表示する(フォールバック)。
const ERROR_MESSAGE_MAP: Record<string, string> = {
  'Invalid login credentials': 'メールアドレスまたはパスワードが正しくありません',
  'User already registered': 'このメールアドレスは既に登録されています',
  'Email not confirmed': 'メールアドレスの確認が完了していません',
  'Password should be at least 6 characters': 'パスワードは6文字以上にしてください',
  'Unable to validate email address: invalid format': 'メールアドレスの形式が正しくありません',
  'Email rate limit exceeded': 'しばらく時間をおいてから再度お試しください',
};

function translateAuthError(message: string): string {
  return ERROR_MESSAGE_MAP[message] ?? message;
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setError(null);
    setBusy(true);
    try {
      const result =
        mode === 'signin'
          ? await supabase.auth.signInWithPassword({ email, password })
          : await supabase.auth.signUp({ email, password });
      if (result.error) {
        setError(translateAuthError(result.error.message));
      }
    } catch {
      setError('通信に失敗しました。しばらくしてから再度お試しください');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fullscreen-center">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-icon" aria-hidden="true">
          <img src={`${import.meta.env.BASE_URL}icons/icon.svg`} alt="" width="56" height="56" />
        </div>
        <h1 className="login-title">ひかるのやることリスト</h1>
        <p className="muted-text">{mode === 'signin' ? 'ログイン' : '新規登録'}</p>
        <input
          type="email"
          placeholder="メールアドレス"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <input
          type="password"
          placeholder="パスワード"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
        />
        {error && <p className="error-text">{error}</p>}
        <button type="submit" className="primary-button" disabled={busy}>
          {busy ? '処理中…' : mode === 'signin' ? 'ログイン' : '登録する'}
        </button>
        <button
          type="button"
          className="link-button"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'アカウントを新規作成' : 'ログイン画面に戻る'}
        </button>
      </form>
    </div>
  );
}
