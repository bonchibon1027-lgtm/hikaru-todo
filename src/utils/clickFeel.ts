// チェックの手触り(v2追加)。WebAudioで合成した「コトッ」という低い二重音 + 振動を鳴らす。
// AudioContextはユーザー操作(クリック)時に遅延生成し、以後は使い回す(ブラウザの自動再生制限を回避)。

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) {
    audioCtx = new Ctor();
  }
  if (audioCtx.state === 'suspended') {
    // ユーザー操作(クリックイベント)経由の呼び出しなので resume() が許可される
    void audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * 高級キーボードの「コトッ」を狙った短いクリック音。
 * 低音(sine, ~180Hz, 60ms, 急減衰) + 高域のtick(triangle, ~1800Hz, 15ms) を
 * lowpassフィルタに通してまとめる。
 */
export function playClickSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.value = 0.2;
    master.connect(ctx.destination);

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 3200;
    lowpass.connect(master);

    // 低音の「コ」
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(180, now);
    thud.frequency.exponentialRampToValueAtTime(120, now + 0.06);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.9, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    thud.connect(thudGain);
    thudGain.connect(lowpass);
    thud.start(now);
    thud.stop(now + 0.07);

    // 高域の「ッ」(tick)
    const tick = ctx.createOscillator();
    tick.type = 'triangle';
    tick.frequency.setValueAtTime(1800, now);
    const tickGain = ctx.createGain();
    tickGain.gain.setValueAtTime(0.45, now + 0.01);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    tick.connect(tickGain);
    tickGain.connect(lowpass);
    tick.start(now + 0.01);
    tick.stop(now + 0.03);
  } catch {
    // 音の合成に失敗しても操作自体は継続させる
  }
}

/** サウンド+振動(Android)をまとめて発火する。muted時は何もしない。 */
export function triggerClickFeel(muted: boolean): void {
  if (muted) return;
  playClickSound();
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate(12);
  }
}
