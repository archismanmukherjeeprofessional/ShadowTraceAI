interface ConfidenceBadgeProps {
  score: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

function getBand(score: number) {
  if (score <= 29) return { label: 'Very Weak', color: '#6B7280', bg: 'rgba(107,114,128,0.15)', border: 'rgba(107,114,128,0.3)' };
  if (score <= 49) return { label: 'Low', color: '#3BB2F6', bg: 'rgba(59,178,246,0.12)', border: 'rgba(59,178,246,0.3)' };
  if (score <= 69) return { label: 'Moderate', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.3)' };
  if (score <= 84) return { label: 'High', color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' };
  return { label: 'Very High', color: '#EF4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.3)' };
}

export default function ConfidenceBadge({ score, showLabel = false, size = 'md' }: ConfidenceBadgeProps) {
  const band = getBand(score);
  const sizes = {
    sm: { fontSize: '11px', padding: '2px 6px', numSize: '11px' },
    md: { fontSize: '12px', padding: '3px 8px', numSize: '12px' },
    lg: { fontSize: '13px', padding: '4px 10px', numSize: '14px' },
  };
  const s = sizes[size];

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        background: band.bg,
        border: `1px solid ${band.border}`,
        borderRadius: '4px',
        padding: s.padding,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: s.fontSize,
        fontWeight: 500,
        color: band.color,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: s.numSize, fontWeight: 600 }}>{score}</span>
      {showLabel && <span style={{ opacity: 0.8 }}>{band.label}</span>}
    </span>
  );
}
