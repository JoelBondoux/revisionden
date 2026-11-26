import { Button } from '../../components/Button';
import { useId, useState, type CSSProperties } from 'react';
import { COUNT_UP_MS, staggerDelay } from '@revisionden/core';
import { useEnterOnce, type EnterPhase } from './countUp';

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

const ENTER_CLASS: Partial<Record<EnterPhase, string>> = {
  waiting: 'bar-chart--waiting',
  running: 'bar-chart--growing',
};

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
 * The bars grow up from the baseline once, the first time the chart comes into view (K5);
 * never with reduced motion, and never again on a re-render or a new period.
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
  const count = buckets.length;
  const { ref, phase } = useEnterOnce<HTMLDivElement>(COUNT_UP_MS + staggerDelay(count - 1, count));

  return (
    <div ref={ref} className={ENTER_CLASS[phase] ? `bar-chart ${ENTER_CLASS[phase]}` : 'bar-chart'}>
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
                  style={{ '--stats-delay': `${staggerDelay(i, count)}ms` } as CSSProperties}
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
      <Button variant="secondary" className="no-print" onClick={() => setShowTable((s) => !s)}>
        {showTable ? 'Show chart' : 'Show table'}
      </Button>
    </div>
  );
}
