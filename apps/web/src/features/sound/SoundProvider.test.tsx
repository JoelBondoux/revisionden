import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { createFakeAudioContext, type FakeAudioContext } from './fakeAudio';
import { SOUND_KEY } from './settings';
import { SoundProvider, useSound } from './SoundProvider';
import { MuteButton } from './MuteButton';
import { SoundSettingsCard } from './SoundSettingsCard';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function Player({ event = 'correct' as const, mode }: { event?: 'correct'; mode?: 'test' }) {
  const { play } = useSound();
  return (
    <button type="button" onClick={() => play(event, { mode })}>
      Play
    </button>
  );
}

function setup(ui: React.ReactNode, storage = memoryStorage()) {
  const contexts: FakeAudioContext[] = [];
  const view = render(
    <SoundProvider
      storage={storage}
      createContext={() => {
        const ctx = createFakeAudioContext();
        contexts.push(ctx);
        return ctx;
      }}
    >
      {ui}
    </SoundProvider>,
  );
  const sounds = () => contexts.flatMap((c) => c.oscillators).length;
  return { ...view, contexts, storage, sounds };
}

describe('SoundProvider', () => {
  it('plays nothing before the first interaction, then plays after a tap', async () => {
    function PlayOnMount() {
      const { play } = useSound();
      useEffect(() => {
        play('celebration');
      }, [play]);
      return null;
    }
    const { contexts, sounds } = setup(
      <>
        <PlayOnMount />
        <Player />
      </>,
    );
    expect(contexts).toHaveLength(0);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(contexts).toHaveLength(1);
    expect(sounds()).toBeGreaterThan(0);
  });

  it('suspends audio when the app goes into the background', async () => {
    const { contexts } = setup(<Player />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    const hidden = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(contexts[0]!.suspendCalls).toBe(1);
    const before = contexts[0]!.oscillators.length;
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(contexts[0]!.oscillators.length).toBe(before);
    hidden.mockRestore();
  });

  it('keeps the Test mode rule for features that pass the mode', async () => {
    const { sounds } = setup(<Player mode="test" />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(sounds()).toBe(0);
  });

  it('plays tap sounds on buttons only when tap sounds are on', async () => {
    const { sounds } = setup(<button type="button">Plain</button>);
    await userEvent.click(screen.getByRole('button', { name: 'Plain' }));
    expect(sounds()).toBe(0);

    const on = setup(
      <button type="button">Tappy</button>,
      memoryStorage({ [SOUND_KEY]: '{"enabled":true,"volume":"medium","taps":true}' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Tappy' }));
    expect(on.sounds()).toBeGreaterThan(0);
  });

  it('works without a provider: sound calls do nothing', async () => {
    render(<Player />);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument();
  });
});

describe('MuteButton', () => {
  it('mutes and unmutes, shows its state and saves it on this device', async () => {
    const { storage, sounds } = setup(
      <>
        <MuteButton />
        <Player />
      </>,
    );
    const mute = screen.getByRole('button', { name: 'Mute sounds' });
    expect(mute).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(mute);
    const unmute = screen.getByRole('button', { name: 'Turn sounds on' });
    expect(unmute).toHaveAttribute('aria-pressed', 'true');
    expect(JSON.parse(storage.data.get(SOUND_KEY)!)).toMatchObject({ enabled: false });

    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(sounds()).toBe(0);

    await userEvent.click(unmute);
    await userEvent.click(screen.getByRole('button', { name: 'Play' }));
    expect(sounds()).toBeGreaterThan(0);
  });
});

describe('SoundSettingsCard', () => {
  it('shows the defaults: sound on, medium volume, tap sounds off', () => {
    setup(<SoundSettingsCard />);
    expect(screen.getByRole('heading', { name: 'Sound' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Sound effects' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Medium' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tap sounds' })).not.toBeChecked();
  });

  it('saves changes on this device and plays a sample at the new volume', async () => {
    const { storage, contexts } = setup(<SoundSettingsCard />);
    await userEvent.click(screen.getByRole('radio', { name: 'High' }));
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tap sounds' }));
    expect(JSON.parse(storage.data.get(SOUND_KEY)!)).toEqual({
      enabled: true,
      volume: 'high',
      taps: true,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Play a sample' }));
    expect(contexts[0]!.gains[0]!.value).toBeGreaterThan(0.3);
  });

  it('turning sound off disables the volume and tap choices and the sample', async () => {
    setup(<SoundSettingsCard />);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Sound effects' }));
    expect(screen.getByRole('radio', { name: 'Low' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Tap sounds' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Play a sample' })).toBeDisabled();
  });

  it('still works when this device cannot save settings', async () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    render(
      <SoundProvider storage={broken} createContext={() => createFakeAudioContext()}>
        <SoundSettingsCard />
      </SoundProvider>,
    );
    await userEvent.click(screen.getByRole('radio', { name: 'Low' }));
    expect(screen.getByRole('radio', { name: 'Low' })).toBeChecked();
  });
});
