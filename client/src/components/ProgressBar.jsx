export default function ProgressBar({ value = 0, max = 100, label, valueLabel, color, small = false }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress">
      {(label || valueLabel) && (
        <div className="progress__label">
          <span>{label}</span>
          <span>{valueLabel ?? `${Math.round(pct)}%`}</span>
        </div>
      )}
      <div
        className={`progress__track${small ? ' progress__track--sm' : ''}`}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
      >
        <div className="progress__fill" style={{ width: `${pct}%`, ...(color ? { background: color } : {}) }} />
      </div>
    </div>
  );
}