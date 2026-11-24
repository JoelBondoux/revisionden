import { useId, useState } from 'react';

export interface ChartBar {
  label: string;
  value: number;
}

interface BarChartProps {
  /** Names the chart and its table. */
  title: string;
  buckets: readonly ChartBar[];
  unit: string;
  /** A goal or plan, drawn as a dashed line. */
  reference?: { value: number; label: string } | null;
  format?: (value: number) => string;
}

const WIDTH = 320;
const HEIGHT = 140;
const AXIS = 18;
const GAP = 2;
const RADIUS = 4;

/** A bar with a 4px rounded top, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number): string {
  if (h <= 0) return '';
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * The one chart style for the stats dashboards: a single violet series on one axis, a dashed
 * reference line for a goal or plan, the value of a bar in a tooltip on hover or keyboard
 * focus, and a table view (always there for screen readers, and on screen with "Show table").
 * There is no animation at all, so reduced motion is respected.
 */
export function BarChart({ title, buckets, unit, reference, format }: BarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tooltipId = useId();
  const show = format ?? ((v: number) => `${v} ${unit}`);
  const plotHeight = HEIGHT - AXIS;
  const max = Math.max(1, reference?.value ?? 0, ...buckets.map((b) => b.value));
  const slot = WIDTH / Math.max(1, buckets.length);
  const y = (value: number) => plotHeight - (value / max) * (plotHeight - 8);
  const describe = (b: ChartBar) => `${b.label}: ${show(b.value)}`;
  const activeBar = active === null ? undefined : buckets[active];

  return (
    <div className="bar-chart">
      {!showTable && (
        <div className="bar-chart__plot">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="bar-chart__svg">
            <line x1={0} x2={WIDTH} y1={plotHeight} y2={plotHeight} className="bar-chart__axis" />
            {buckets.map((b, i) => (
              <g
                key={`${b.label}-${i}`}
                role="img"
                aria-label={describe(b)}
                tabIndex={0}
                className="bar-chart__bar"
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
              >
                {/* The hit target is the whole column, bigger than the bar itself. */}
                <rect x={i * slot} y={0} width={slot} height={plotHeight} fill="transparent" />
                <path
                  d={barPath(i * slot + GAP, y(b.value), slot - 2 * GAP, plotHeight - y(b.value))}
                  className="bar-chart__fill"
                />
                <text x={i * slot + slot / 2} y={HEIGHT - 4} className="bar-chart__label">
                  {b.label}
                </text>
              </g>
            ))}
            {reference && (
              <line
                data-testid="chart-reference"
                x1={0}
                x2={WIDTH}
                y1={y(reference.value)}
                y2={y(reference.value)}
                strokeDasharray="6 4"
                className="bar-chart__reference"
              />
            )}
          </svg>
          {activeBar && (
            <div role="tooltip" id={tooltipId} className="bar-chart__tooltip">
              {describe(activeBar)}
            </div>
          )}
        </div>
      )}
      {reference && (
        <p className="bar-chart__legend secondary-text">
          <span className="bar-chart__dash" aria-hidden="true" />
          {`${reference.label}: ${show(reference.value)}`}
        </p>
      )}
      <div className={showTable ? 'bar-chart__table' : 'visually-hidden'}>
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            {buckets.map((b, i) => (
              <tr key={`${b.label}-${i}`}>
                <th scope="row">{b.label}</th>
                <td>{show(b.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="link-button" onClick={() => setShowTable((s) => !s)}>
        {showTable ? 'Show chart' : 'Show table'}
      </button>
    </div>
  );
}
