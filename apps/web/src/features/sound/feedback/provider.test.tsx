import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { createFakeAudioContext, type FakeAudioContext } from '../fakeAudio';
import { SOUND_KEY } from '../settings';
import { SoundProvider, useFeedbackStyle, useSound } from '../SoundProvider';
import { SoundSettingsCard } from '../SoundSettingsCard';
import { hapticPattern } from './haptics';
import { stylePacks } from './styles';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function setup(ui: React.ReactNode, { vibrate = true, storage = memoryStorage() } = {}) {
  const contexts: FakeAudioContext[] = [];
  const vibrations: number[][] = [];
  render(
    <SoundProvider
      storage={storage}
      createContext={() => {
        const ctx = createFakeAudioContext();
        contexts.push(ctx);
        return ctx;
      }}
      haptics={{ supported: vibrate, vibrate: (p) => void vibrations.push(p) }}
      reducedMotion={() => false}
    >
      {ui}
    </SoundProvider>,
  );
  return { contexts, vibrations, storage };
}

function Emit({ event = 'rewardWobble' as const }) {
  const { emit } = useSound();
  return (
    <button type="button" onClick={() => emit(event)}>
      Animate
    </button>
  );
}

describe('feedback through the provider', () => {
  it('emit() plays the style sound and vibrates', async () => {
    const spy = vi.spyOn(stylePacks['sticker-book'], 'rewardWobble');
    const t = setup(<Emit />);
    await userEvent.click(screen.getByRole('button', { name: 'Animate' }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(t.vibrations.length).toBeGreaterThan(0);
    spy.mockRestore();
  });

  it("follows the style J's style system sets", async () => {
    const spy = vi.spyOn(stylePacks.starlight, 'rewardWobble');
    function Styled() {
      useFeedbackStyle('starlight');
      return <Emit />;
    }
    setup(<Styled />);
    await userEvent.click(screen.getByRole('button', { name: 'Animate' }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('older play() calls follow the style too (correct, wrong, flip, celebration, level up)', async () => {
    const spy = vi.spyOn(stylePacks['pop-burst'], 'correct');
    function Lesson() {
      const { play } = useSound();
      useFeedbackStyle('pop-burst');
      return (
        <button type="button" onClick={() => play('correct')}>
          Check
        </button>
      );
    }
    setup(<Lesson />);
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a right answer in a combo plays the combo sound', async () => {
    const spy = vi.spyOn(stylePacks['sticker-book'], 'combo');
    function Lesson() {
      const { play } = useSound();
      return (
        <button type="button" onClick={() => play('correct', { step: 2 })}>
          Check
        </button>
      );
    }
    setup(<Lesson />);
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    expect(spy).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('a reward sound comes with its vibration', async () => {
    function Reward() {
      const { playReward } = useSound();
      return (
        <button type="button" onClick={() => playReward([{ id: 'streak-7', rarity: 'common' }])}>
          Earn
        </button>
      );
    }
    const t = setup(<Reward />);
    await userEvent.click(screen.getByRole('button', { name: 'Earn' }));
    expect(t.vibrations.length).toBeGreaterThan(0);
  });

  it('works without a provider: emit does nothing', () => {
    function Bare() {
      const { emit } = useSound();
      useFeedbackStyle('starlight');
      useEffect(() => void emit('levelUp'), [emit]);
      return <p>ok</p>;
    }
    render(<Bare />);
    expect(screen.getByText('ok')).toBeInTheDocument();
  });
});

describe('Vibration in Settings', () => {
  it('is on by default, next to Sound, and saved on this device', async () => {
    const t = setup(
      <>
        <SoundSettingsCard />
        <Emit />
      </>,
    );
    const box = screen.getByRole('checkbox', { name: 'Vibration' });
    expect(box).toBeChecked();
    await userEvent.click(box);
    expect(JSON.parse(t.storage.data.get(SOUND_KEY)!)).toMatchObject({ vibration: false });
    await userEvent.click(screen.getByRole('button', { name: 'Animate' }));
    expect(t.vibrations).toHaveLength(0);
  });

  it('works even with sound muted', async () => {
    const t = setup(
      <>
        <SoundSettingsCard />
        <Emit />
      </>,
      { storage: memoryStorage({ [SOUND_KEY]: '{"enabled":false}' }) },
    );
    expect(screen.getByRole('checkbox', { name: 'Vibration' })).toBeEnabled();
    await userEvent.click(screen.getByRole('button', { name: 'Animate' }));
    expect(t.vibrations.length).toBeGreaterThan(0);
  });

  it.each([
    ['vibrates with sound muted', [{ id: 'streak-7', rarity: 'common' as const }], 'learn', true],
    ['stays still in Test mode', [{ id: 'streak-7', rarity: 'common' as const }], 'test', false],
    ['stays still with nothing earned', [], 'learn', false],
  ] as const)('a reward %s', async (_name, rewards, mode, buzzes) => {
    function Reward() {
      const { playReward } = useSound();
      return (
        <button type="button" onClick={() => playReward(rewards, { mode })}>
          Earn
        </button>
      );
    }
    const t = setup(<Reward />, { storage: memoryStorage({ [SOUND_KEY]: '{"enabled":false}' }) });
    await userEvent.click(screen.getByRole('button', { name: 'Earn' }));
    const rewardBuzz = hapticPattern('sticker-book', 'rewardOpen');
    if (buzzes) expect(t.vibrations).toContainEqual(rewardBuzz);
    else expect(t.vibrations).not.toContainEqual(rewardBuzz);
  });

  it('says honestly when this device cannot vibrate', () => {
    setup(<SoundSettingsCard />, { vibrate: false });
    expect(screen.getByRole('checkbox', { name: 'Vibration' })).toBeDisabled();
    expect(screen.getByText(/can't vibrate/)).toBeInTheDocument();
  });
});
