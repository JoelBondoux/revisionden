import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HOME_PATH, PipHomeButton } from './PipHomeButton';

function renderAt(ui: React.ReactNode, path = '/somewhere') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={HOME_PATH} element={<h1>Home page</h1>} />
        <Route path="*" element={ui} />
      </Routes>
    </MemoryRouter>,
  );
}

const env = { reducedMotion: () => false, hour: () => 15, random: () => 0 };

// J15b (owner, 2026-11-26): Pip sits top left on every screen as a round "Home" button. In a
// lesson, tapping him first asks "Leave this lesson?". He idles about every 8 seconds, stops after
// a minute, and holds still with reduced motion or in a lesson.
describe('the Pip Home button', () => {
  it('is a button named Home, with Pip decorative inside it', () => {
    renderAt(<PipHomeButton env={env} />);
    const button = screen.getByRole('button', { name: 'Home' });
    expect(button.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('takes you Home', async () => {
    renderAt(<PipHomeButton env={env} />);
    await userEvent.click(screen.getByRole('button', { name: 'Home' }));
    expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
  });

  it('dresses for the subject', () => {
    const { container } = renderAt(<PipHomeButton env={env} subjectId="gcse-history" />);
    expect(container.querySelector('[data-item="explorer-hat"]')).not.toBeNull();
  });

  describe('in a lesson', () => {
    it('asks first, and Keep going stays put', async () => {
      renderAt(<PipHomeButton env={env} inLesson />);
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      const dialog = screen.getByRole('dialog', { name: 'Leave this lesson?' });
      expect(screen.getByRole('button', { name: 'Keep going' })).toHaveFocus();
      await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
      expect(dialog).not.toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Home page' })).not.toBeInTheDocument();
    });

    it('goes Home when you choose Leave', async () => {
      renderAt(<PipHomeButton env={env} inLesson />);
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
      expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    });

    it('keeps still: no idle actions', () => {
      vi.useFakeTimers();
      try {
        const { container } = renderAt(<PipHomeButton env={env} inLesson />);
        act(() => void vi.advanceTimersByTime(20_000));
        expect(container.querySelector('svg')).toHaveClass('pip-figure--rest');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  it('acts about every 8 seconds, then returns to rest', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderAt(<PipHomeButton env={env} />);
      const svg = () => container.querySelector('svg')!;
      expect(svg()).toHaveClass('pip-figure--rest');
      act(() => void vi.advanceTimersByTime(9000));
      expect(svg().getAttribute('class')).toMatch(/pip-figure--(blink|wave|stretch|read|timer)/);
      act(() => void vi.advanceTimersByTime(3500));
      expect(svg()).toHaveClass('pip-figure--rest');
    } finally {
      vi.useRealTimers();
    }
  });

  it('holds a still pose with reduced motion', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderAt(<PipHomeButton env={{ ...env, reducedMotion: () => true }} />);
      act(() => void vi.advanceTimersByTime(30_000));
      expect(container.querySelector('svg')).toHaveClass('pip-figure--rest');
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops after a minute without input', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderAt(<PipHomeButton env={env} />);
      act(() => void vi.advanceTimersByTime(75_000));
      const poses = new Set<string>();
      for (let i = 0; i < 6; i++) {
        act(() => void vi.advanceTimersByTime(9000));
        poses.add(container.querySelector('svg')!.getAttribute('class')!);
      }
      expect([...poses]).toEqual(['pip-figure pip-figure--rest']);
    } finally {
      vi.useRealTimers();
    }
  });
});
