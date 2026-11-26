import { render, screen, waitFor } from '@testing-library/react';
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

  it('still gives the default style outside the provider', () => {
    render(<Probe />);
    expect(screen.getByText('Doodle Diary (doodle-diary)')).toBeInTheDocument();
  });
});
