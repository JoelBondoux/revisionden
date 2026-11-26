import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { CountUp, GrowIn, useEnterOnce } from './countUp';
import { fakeMotionEnv as fakeEnv } from './motionTestEnv';

const percent = (n: number) => `${n}%`;
const digits = () => document.querySelector('.count-up__digits');

describe('count-up numbers', () => {
  it('counts from 0 to the value once it comes into view, ending exactly on it', () => {
    const { step, show, wrap } = fakeEnv();
    render(<CountUp value={80} format={percent} />, { wrapper: wrap });
    expect(digits()).toHaveTextContent('0%');
    show();
    step(0);
    expect(digits()).toHaveTextContent('0%');
    step(350);
    const mid = Number(digits()!.textContent!.replace('%', ''));
    expect(mid).toBeGreaterThan(40);
    expect(mid).toBeLessThan(80);
    step(400);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(digits()).toBeNull();
  });

  it('gives screen readers only the final value, never the moving digits', () => {
    const { step, show, wrap } = fakeEnv();
    render(<CountUp value={1234} format={(n) => n.toLocaleString('en-GB')} />, { wrapper: wrap });
    show();
    step(200);
    const hidden = document.querySelector('.visually-hidden');
    expect(hidden).toHaveTextContent('1,234');
    expect(digits()).toHaveAttribute('aria-hidden', 'true');
    expect(document.querySelector('[aria-live]')).toBeNull();
  });

  it('keeps the formatting right on every frame and reserves the final width', () => {
    const { step, show, wrap } = fakeEnv();
    const minutes = (n: number) => `${Math.floor(n / 60)} h ${n % 60} min`;
    render(<CountUp value={95} format={minutes} />, { wrapper: wrap });
    show();
    for (let t = 0; t < 700; t += 70) {
      step(70);
      const text = digits()?.textContent;
      if (text) expect(text).toMatch(/^\d+ h \d+ min$/);
    }
    render(<CountUp value={95} format={minutes} />, { wrapper: wrap });
    expect(digits()).toHaveStyle({ minWidth: `${'1 h 35 min'.length}ch` });
  });

  it('counts decimals to the right number of places', () => {
    const { step, show, wrap } = fakeEnv();
    render(<CountUp value={2.5} decimals={1} format={(n) => n.toFixed(1)} />, { wrapper: wrap });
    show();
    step(300);
    expect(digits()!.textContent).toMatch(/^\d\.\d$/);
  });

  it('shows the value at once with reduced motion', () => {
    const { wrap } = fakeEnv({ reduced: true });
    render(<CountUp value={80} format={percent} />, { wrapper: wrap });
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(digits()).toBeNull();
  });

  it('runs once: a later change of value shows at once', () => {
    const { step, show, wrap } = fakeEnv();
    const { rerender } = render(<CountUp value={10} format={String} />, { wrapper: wrap });
    show();
    step(1000);
    rerender(<CountUp value={30} format={String} />);
    expect(screen.getByText('30')).toBeInTheDocument();
    expect(digits()).toBeNull();
  });

  it('tells its owner once when it has settled', () => {
    const { step, show, wrap } = fakeEnv();
    const settled = vi.fn();
    const { rerender } = render(<CountUp value={10} format={String} onSettled={settled} />, {
      wrapper: wrap,
    });
    show();
    step(1000);
    step(100);
    rerender(<CountUp value={12} format={String} onSettled={settled} />);
    expect(settled).toHaveBeenCalledTimes(1);
  });

  it('without IntersectionObserver (old browsers, tests) shows the value at once', () => {
    render(<CountUp value={80} format={percent} />);
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(digits()).toBeNull();
  });
});

function Probe({ total }: { total: number }) {
  const { ref, phase } = useEnterOnce<HTMLDivElement>(total);
  return (
    <div ref={ref} data-testid="probe">
      {phase}
    </div>
  );
}

describe('enter once', () => {
  it('waits for view, runs for its time, then stays done', () => {
    const { step, show, wrap } = fakeEnv();
    render(<Probe total={700} />, { wrapper: wrap });
    expect(screen.getByTestId('probe')).toHaveTextContent('waiting');
    show();
    step(0);
    expect(screen.getByTestId('probe')).toHaveTextContent('running');
    step(700);
    expect(screen.getByTestId('probe')).toHaveTextContent('done');
  });
});

describe('grow in (progress bars)', () => {
  it('marks its contents waiting, then growing, then done, once', () => {
    const { step, show, wrap } = fakeEnv();
    render(<GrowIn>bars</GrowIn>, { wrapper: wrap });
    const box = screen.getByText('bars');
    expect(box).toHaveClass('stats-grow--waiting');
    show();
    step(0);
    expect(box).toHaveClass('stats-grow--running');
    step(1000);
    expect(box).not.toHaveClass('stats-grow--running');
    expect(box).not.toHaveClass('stats-grow--waiting');
  });

  it('adds nothing with reduced motion', () => {
    const { wrap } = fakeEnv({ reduced: true });
    render(<GrowIn>bars</GrowIn>, { wrapper: wrap });
    expect(screen.getByText('bars').className).not.toMatch(/stats-grow--/);
  });
});

describe('print (Save as PDF) mid-count', () => {
  it('keeps the final value in its own element while counting', () => {
    const { step, show, wrap } = fakeEnv();
    render(<CountUp value={80} format={percent} />, { wrapper: wrap });
    show();
    step(200);
    expect(document.querySelector('.count-up__final')).toHaveTextContent('80%');
  });

  it('prints the final values: moving digits hidden, final value shown', async () => {
    const css = readFileSync(join(__dirname, 'stats.css'), 'utf8').replace(/\s+/g, ' ');
    const print = css.slice(css.indexOf('@media print'));
    expect(print).toMatch(/\.count-up__digits\s*\{[^}]*display: none/);
    expect(print).toMatch(/\.count-up__final\s*\{[^}]*position: static/);
  });
});
