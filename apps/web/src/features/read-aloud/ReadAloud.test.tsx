import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { fakeSpeech, makeUtterance } from './fakeSpeech';
import { ReadAloudButton } from './ReadAloudButton';
import { ReadAloudProvider } from './ReadAloudProvider';
import { ReadAloudSettingsCard } from './ReadAloudSettingsCard';
import { READ_ALOUD_KEY } from './settings';
import type { VoiceLike } from './voices';

const DEVICE: VoiceLike = { name: 'Device UK', lang: 'en-GB', localService: true };
const ONLINE: VoiceLike = { name: 'Online UK', lang: 'en-GB', localService: false };

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    data,
  };
}

function setup(voices: VoiceLike[], initial: Record<string, string> = {}, withSpeech = true) {
  const speech = fakeSpeech(voices);
  const storage = memoryStorage(initial);
  render(
    <ReadAloudProvider
      synth={withSpeech ? speech.synth : null}
      makeUtterance={makeUtterance}
      storage={storage}
    >
      <ReadAloudSettingsCard />
      <ReadAloudButton text="Work out x^2 when x = 3." label="Read the question aloud" />
    </ReadAloudProvider>,
  );
  return { speech, storage };
}

describe('Read aloud', () => {
  it('is on by default with an on-device voice and reads maths sensibly', async () => {
    const { speech } = setup([DEVICE]);
    expect(screen.getByRole('checkbox', { name: 'Read aloud' })).toBeChecked();
    await userEvent.click(screen.getByRole('button', { name: 'Read the question aloud' }));
    expect(speech.spoken).toHaveLength(1);
    expect(speech.spoken[0]).toMatchObject({
      text: 'Work out x squared when x equals 3.',
      lang: 'en-GB',
      rate: 1,
      voice: DEVICE,
    });
  });

  it('stops anything already speaking before it starts again', async () => {
    const { speech } = setup([DEVICE]);
    await userEvent.click(screen.getByRole('button', { name: 'Read the question aloud' }));
    await userEvent.click(screen.getByRole('button', { name: 'Read the question aloud' }));
    expect(speech.cancelled()).toBeGreaterThanOrEqual(2);
    expect(speech.spoken).toHaveLength(2);
  });

  it('is off by default with only online voices, and explains why', () => {
    setup([ONLINE]);
    expect(screen.getByRole('checkbox', { name: 'Read aloud' })).not.toBeChecked();
    expect(screen.getByText(/speech service may process the text/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Read the question aloud' }),
    ).not.toBeInTheDocument();
  });

  it('can be turned on with online voices, and the choice is remembered', async () => {
    const { speech, storage } = setup([ONLINE]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Read aloud' }));
    expect(JSON.parse(storage.data.get(READ_ALOUD_KEY) ?? '{}')).toMatchObject({ enabled: true });
    await userEvent.click(screen.getByRole('button', { name: 'Read the question aloud' }));
    expect(speech.spoken[0]?.voice).toBe(ONLINE);
  });

  it('changes the speed', async () => {
    const { speech } = setup([DEVICE]);
    await userEvent.click(screen.getByRole('radio', { name: 'Slower' }));
    await userEvent.click(screen.getByRole('button', { name: 'Read the question aloud' }));
    expect(speech.spoken[0]?.rate).toBe(0.75);
  });

  it('can be turned off, which hides the buttons', async () => {
    setup([DEVICE]);
    await userEvent.click(screen.getByRole('checkbox', { name: 'Read aloud' }));
    expect(
      screen.queryByRole('button', { name: 'Read the question aloud' }),
    ).not.toBeInTheDocument();
  });

  it('picks up voices that arrive after the page loads', () => {
    const { speech } = setup([]);
    expect(
      screen.queryByRole('button', { name: 'Read the question aloud' }),
    ).not.toBeInTheDocument();
    act(() => speech.setVoices([DEVICE]));
    expect(screen.getByRole('button', { name: 'Read the question aloud' })).toBeInTheDocument();
  });

  it('says when this device cannot read aloud', () => {
    setup([], {}, false);
    expect(screen.getByText(/can't read aloud/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Read aloud' })).toBeDisabled();
  });
});
