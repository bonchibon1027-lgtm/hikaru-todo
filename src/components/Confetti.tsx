import { useEffect, useRef } from 'react';

// 達成演出(v2追加): ゴール進捗100%到達時の自作canvas紙吹雪。ライブラリ不使用。
// prefers-reduced-motion時は演出を無効にする。

const COLORS = ['#BB86FC', '#03DAC6', '#FF0266'];
const DURATION_MS = 1500;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
}

interface Props {
  onDone: () => void;
}

export default function Confetti({ onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      onDoneRef.current();
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) {
      onDoneRef.current();
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const count = 90;
    const originX = window.innerWidth / 2;
    const originY = window.innerHeight * 0.35;
    const particles: Particle[] = Array.from({ length: count }, () => ({
      x: originX + (Math.random() - 0.5) * 140,
      y: originY,
      vx: (Math.random() - 0.5) * 9,
      vy: -(Math.random() * 7 + 4),
      size: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
    }));

    const gravity = 0.28;
    const start = performance.now();
    let raf = 0;
    let finished = false;

    // タブが非表示になっているとrequestAnimationFrameが極端にスロットリングされ、
    // 通常のelapsed判定だけでは終了しない(=紙吹雪が残り続ける)ことがあるため、
    // setTimeoutによる保険で必ずDURATION_MS+余裕分の後にはonDoneを呼ぶ。
    function finish() {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
      onDoneRef.current();
    }

    function frame(t: number) {
      const elapsed = t - start;
      const life = Math.max(0, 1 - elapsed / DURATION_MS);
      ctx!.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;

        ctx!.save();
        ctx!.globalAlpha = life;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;
        ctx!.shadowColor = p.color;
        ctx!.shadowBlur = 6;
        ctx!.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx!.restore();
      }

      if (elapsed < DURATION_MS) {
        raf = requestAnimationFrame(frame);
      } else {
        finish();
      }
    }
    raf = requestAnimationFrame(frame);
    const timeoutId = window.setTimeout(finish, DURATION_MS + 500);

    return () => {
      finished = true;
      cancelAnimationFrame(raf);
      window.clearTimeout(timeoutId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />;
}
