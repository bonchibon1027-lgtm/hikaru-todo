interface Props {
  percent: number;
  glow?: boolean;
}

export default function ProgressBar({ percent, glow = true }: Props) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress-track" role="progressbar" aria-valuenow={clamped} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`progress-fill${glow && clamped > 0 ? ' progress-fill--glow' : ''}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
