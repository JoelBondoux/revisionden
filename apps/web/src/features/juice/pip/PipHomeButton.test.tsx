import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HOME_PATH, PipHomeButton } from './PipHomeButton';
import { reactToAnswer } from './reactions';

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

    it('keeps keyboard focus inside the question until you answer (J15b-2 focus trap)', async () => {
      renderAt(<PipHomeButton env={env} inLesson />);
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      const stay = screen.getByRole('button', { name: 'Keep going' });
      const leave = screen.getByRole('button', { name: 'Leave' });
      expect(stay).toHaveFocus();
      await userEvent.tab();
      expect(leave).toHaveFocus();
      await userEvent.tab();
      expect(stay).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(leave).toHaveFocus();
    });

    it('hides the rest of the page from assistive tech and taps while it asks', async () => {
      renderAt(
        <>
          <PipHomeButton env={env} inLesson />
          <main>
            <button type="button">Check</button>
          </main>
        </>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      expect(
        screen.getByRole('button', { name: 'Check', hidden: true }).closest('[inert]'),
      ).not.toBeNull();
      await userEvent.keyboard('{Escape}');
      expect(screen.getByRole('button', { name: 'Check' }).closest('[inert]')).toBeNull();
    });

    it('closes with Escape and puts focus back on Pip', async () => {
      renderAt(<PipHomeButton env={env} inLesson />);
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Home' })).toHaveFocus();
    });

    it('goes Home when you choose Leave', async () => {
      renderAt(<PipHomeButton env={env} inLesson />);
      await userEvent.click(screen.getByRole('button', { name: 'Home' }));
      await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
      expect(screen.getByRole('heading', { name: 'Home page' })).toBeInTheDocument();
    });

    it('reacts to each marked answer, then goes back to rest (J14)', () => {
      vi.useFakeTimers();
      try {
        const { container } = renderAt(<PipHomeButton env={env} inLesson />);
        const svg = () => container.querySelector('svg')!;
        act(() => reactToAnswer({ kind: 'right', combo: 1 }));
        expect(svg()).toHaveClass('pip-figure--nod');
        act(() => void vi.advanceTimersByTime(1000));
        expect(svg()).toHaveClass('pip-figure--rest');
        act(() => reactToAnswer({ kind: 'wrong', combo: 0 }));
        expect(svg()).toHaveClass('pip-figure--hmm');
        act(() => reactToAnswer({ kind: 'goal', combo: 4 }));
        expect(svg()).toHaveClass('pip-figure--cheer');
        act(() => void vi.advanceTimersByTime(1300));
        expect(svg()).toHaveClass('pip-figure--rest');
      } finally {
        vi.useRealTimers();
      }
    });

    it('ignores an answer from before he appeared, and stays still with reduced motion', () => {
      reactToAnswer({ kind: 'right', combo: 1 });
      const { container, unmount } = renderAt(<PipHomeButton env={env} inLesson />);
      expect(container.querySelector('svg')).toHaveClass('pip-figure--rest');
      unmount();
      const still = renderAt(
        <PipHomeButton env={{ ...env, reducedMotion: () => true }} inLesson />,
      );
      act(() => reactToAnswer({ kind: 'goal', combo: 1 }));
      expect(still.container.querySelector('svg')).toHaveClass('pip-figure--rest');
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
      expect(svg().getAttribute('class')).toMatch(/pip-figure--(blink|tilt|ears|look)/);
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
