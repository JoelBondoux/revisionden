interface ProgressBarProps {
  label: string;
  value: number;
  max: number;
  valueText?: string;
  tone?: 'primary' | 'success' | 'gold';
}

export function ProgressBar({ label, value, max, valueText, tone = 'primary' }: ProgressBarProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const percent = max > 0 ? (clamped / max) * 100 : 0;
  return (
    <div
      className={`progress progress--${tone}`}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={clamped}
      aria-valuetext={valueText}
    >
      <div className="progress__fill" style={{ width: `${percent}%` }} />
    </div>
  );
}
