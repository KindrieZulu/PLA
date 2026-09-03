export default function ProgressBar({ value, max = 100, color = 'green', height = 8, showLabel = false }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="progress-bar" style={{ height, flex: 1 }}>
        <div className={`progress-fill ${color}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span style={{ fontSize: '0.85rem', fontWeight: 600, minWidth: 40, textAlign: 'right' }}>{Math.round(pct)}%</span>}
    </div>
  );
}
