import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart } from './BarChart';

const buckets = [
  { label: 'Mon', value: 60 },
  { label: 'Tue', value: 35 },
  { label: 'Wed', value: 0 },
];

describe('BarChart', () => {
  it('shows a bar value in a tooltip on hover and on keyboard focus', async () => {
    render(<BarChart title="XP per day" buckets={buckets} unit="XP" />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByRole('img', { name: 'Mon: 60 XP' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Mon: 60 XP');
    await userEvent.tab();
    expect(screen.getByRole('img', { name: 'Mon: 60 XP' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Tue: 35 XP');
  });

  it('draws a dashed reference line for a goal', () => {
    render(
      <BarChart
        title="XP per day"
        buckets={buckets}
        unit="XP"
        reference={{ value: 50, label: 'Daily goal' }}
      />,
    );
    expect(screen.getByTestId('chart-reference')).toHaveAttribute('stroke-dasharray');
    expect(screen.getByText('Daily goal: 50 XP')).toBeInTheDocument();
  });

  it('has a table view with every value, which can be shown on screen', async () => {
    render(<BarChart title="XP per day" buckets={buckets} unit="XP" />);
    const table = screen.getByRole('table', { name: 'XP per day' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(within(table).getByRole('cell', { name: '35 XP' })).toBeInTheDocument();
    expect(table.closest('.visually-hidden')).not.toBeNull();
    const toggle = screen.getByRole('button', { name: 'Show table' });
    // A real button, not plain underlined text (J7).
    expect(toggle).toHaveClass('btn', 'btn--secondary');
    await userEvent.click(toggle);
    expect(table.closest('.visually-hidden')).toBeNull();
    expect(screen.getByRole('button', { name: 'Show chart' })).toBeInTheDocument();
  });

  it('formats values with a custom formatter', () => {
    render(
      <BarChart title="Study time" buckets={buckets} unit="min" format={(v) => `${v / 60} h`} />,
    );
    expect(screen.getByRole('img', { name: 'Mon: 1 h' })).toBeInTheDocument();
  });
});

describe('BarChart animation (K5)', () => {
  it('grows the bars from the baseline once, with a stagger within one second', async () => {
    const { fakeMotionEnv } = await import('./motionTestEnv');
    const { step, show, wrap } = fakeMotionEnv();
    const { container } = render(<BarChart title="XP per day" buckets={buckets} unit="XP" />, {
      wrapper: wrap,
    });
    const plot = () => container.querySelector('.bar-chart')!;
    expect(plot()).toHaveClass('bar-chart--waiting');
    show();
    step(0);
    expect(plot()).toHaveClass('bar-chart--growing');
    const delays = [...container.querySelectorAll<SVGPathElement>('.bar-chart__fill')].map((p) =>
      parseInt(p.style.getPropertyValue('--stats-delay'), 10),
    );
    expect(delays[0]).toBe(0);
    expect(Math.max(...delays) + 700).toBeLessThanOrEqual(1000);
    step(1000);
    expect(plot()).not.toHaveClass('bar-chart--growing');
    // Screen readers and the table always have the final values.
    expect(screen.getByRole('img', { name: 'Mon: 60 XP' })).toBeInTheDocument();
  });

  it('does not animate without IntersectionObserver or with reduced motion', () => {
    const { container } = render(<BarChart title="XP per day" buckets={buckets} unit="XP" />);
    expect(container.querySelector('.bar-chart')!.className).toBe('bar-chart');
  });
});
