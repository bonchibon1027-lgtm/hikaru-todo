// ストリーク表示(v2追加)。n>=1のときだけ表示する。
interface Props {
  streak: number;
}

export default function StreakBadge({ streak }: Props) {
  if (streak <= 0) return null;
  return (
    <span className="streak-badge" aria-label={`${streak}日連続達成中`}>
      🔥 {streak}日
    </span>
  );
}
