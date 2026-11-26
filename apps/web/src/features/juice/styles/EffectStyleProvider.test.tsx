import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EffectStyleProvider, useEffectStyle } from './EffectStyleProvider';
import { StudentProvider } from '../../../session/StudentContext';
import { EFFECT_STYLE_KEY } from './registry';

const feedbackStyle = vi.hoisted(() => vi.fn());
vi.mock('../../sound/SoundProvider', () => ({ useFeedbackStyle: feedbackStyle }));

const childOnDevice = {
  getItem: (k: string) => (k === 'revisionden.studentId' ? 'student-1' : null),
  setItem: () => undefined,
};

function Probe() {
  const { style, styleId, choose } = useEffectStyle();
  return (
    <>
      <p>
        {style.name} ({styleId})
      </p>
      <button type="button" onClick={() => choose('doodle-diary')}>
        Choose Doodle Diary
      </button>
    </>
  );
}

describe('effect style provider', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.effectStyle;
  });

  it('pauses the living progress bars while the tab is hidden', () => {
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { unmount } = render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(document.documentElement).toHaveClass('tab-hidden');
    hidden.mockReturnValue(false);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(document.documentElement).not.toHaveClass('tab-hidden');
    unmount();
    hidden.mockRestore();
  });

  it('applies Doodle Diary to the page by default', () => {
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    expect(screen.getByText('Doodle Diary (doodle-diary)')).toBeInTheDocument();
    expect(document.documentElement.dataset.effectStyle).toBe('doodle-diary');
  });

  it('falls back to Doodle Diary when the saved style is not available', () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'neon-disco');
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    expect(document.documentElement.dataset.effectStyle).toBe('doodle-diary');
  });

  it('remembers a choice on this device', async () => {
    render(
      <EffectStyleProvider>
        <Probe />
      </EffectStyleProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Choose Doodle Diary' }));
    expect(localStorage.getItem(EFFECT_STYLE_KEY)).toBe('doodle-diary');
  });

  it('loads the styles a signed-in child has unlocked and applies their pick', async () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'pop-burst');
    const load = vi.fn(async () => ['pop-burst', 'not-a-style']);
    render(
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={load}>
          <Probe />
        </EffectStyleProvider>
      </StudentProvider>,
    );
    expect(await screen.findByText('Pop Burst (pop-burst)')).toBeInTheDocument();
    expect(document.documentElement.dataset.effectStyle).toBe('pop-burst');
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps Doodle Diary when nobody is signed in or loading fails', async () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'pop-burst');
    const load = vi.fn(async () => {
      throw new Error('offline');
    });
    const { unmount } = render(
      <EffectStyleProvider loadUnlocked={load}>
        <Probe />
      </EffectStyleProvider>,
    );
    expect(load).not.toHaveBeenCalled();
    expect(document.documentElement.dataset.effectStyle).toBe('doodle-diary');
    unmount();
    render(
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={load}>
          <Probe />
        </EffectStyleProvider>
      </StudentProvider>,
    );
    await waitFor(() => expect(load).toHaveBeenCalled());
    expect(document.documentElement.dataset.effectStyle).toBe('doodle-diary');
  });

  it('keeps sounds and vibration in the chosen style', async () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'pop-burst');
    render(
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={async () => ['pop-burst']}>
          <Probe />
        </EffectStyleProvider>
      </StudentProvider>,
    );
    expect(feedbackStyle).toHaveBeenCalledWith('doodle-diary');
    await waitFor(() => expect(feedbackStyle).toHaveBeenLastCalledWith('pop-burst'));
  });

  it('asks for nothing while quiet (Get help), and loads once it is not', async () => {
    const load = vi.fn(async () => ['pop-burst']);
    const view = (quiet: boolean) => (
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={load} quiet={quiet}>
          <Probe />
        </EffectStyleProvider>
      </StudentProvider>
    );
    const { rerender } = render(view(true));
    expect(load).not.toHaveBeenCalled();
    rerender(view(false));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
  });

  it('tries again on the next screen after a failed load (for example before unlocking)', async () => {
    localStorage.setItem(EFFECT_STYLE_KEY, 'pop-burst');
    const load = vi
      .fn<() => Promise<readonly string[]>>()
      .mockRejectedValueOnce(new Error('401'))
      .mockResolvedValue(['pop-burst']);
    const view = (screenKey: string) => (
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={load} revalidateKey={screenKey}>
          <Probe />
        </EffectStyleProvider>
      </StudentProvider>
    );
    const { rerender } = render(view('/unlock'));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    rerender(view('/map'));
    expect(await screen.findByText('Pop Burst (pop-burst)')).toBeInTheDocument();
    rerender(view('/settings'));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('can be asked to check again, for a style earned since the last check', async () => {
    const load = vi
      .fn<() => Promise<readonly string[]>>()
      .mockResolvedValueOnce([])
      .mockResolvedValue(['pop-burst']);
    function Refresh() {
      const { refresh, unlocked } = useEffectStyle();
      return (
        <button type="button" onClick={refresh}>
          Check ({unlocked.length})
        </button>
      );
    }
    render(
      <StudentProvider storage={childOnDevice}>
        <EffectStyleProvider loadUnlocked={load}>
          <Refresh />
        </EffectStyleProvider>
      </StudentProvider>,
    );
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await userEvent.click(screen.getByRole('button', { name: 'Check (1)' }));
    expect(await screen.findByRole('button', { name: 'Check (2)' })).toBeInTheDocument();
  });

  it('still gives the default style outside the provider', () => {
    render(<Probe />);
    expect(screen.getByText('Doodle Diary (doodle-diary)')).toBeInTheDocument();
  });
});
