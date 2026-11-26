import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../../mocks/server';
import { routes } from '../../routes';
import { StudentProvider } from '../../session/StudentContext';
import { demoItems } from '../learn/mocks';
import { soundBank } from './bank';
import { SOUND_EVENTS, type SoundEvent } from './events';
import { createFakeAudioContext, type FakeAudioContext } from './fakeAudio';
import { rewardSound } from './rewardBank';
import { FEEDBACK_EVENTS, type FeedbackEvent } from './feedback/events';
import { DEFAULT_STYLE, stylePacks } from './feedback/styles';
import { SoundProvider } from './SoundProvider';

/** Renders the whole app with sound on, recording which sounds actually play. */
function renderWithSound(path: string) {
  // Sound events from the main bank, and feedback events from the default style pack.
  const played: (SoundEvent | FeedbackEvent)[] = [];
  const contexts: FakeAudioContext[] = [];
  for (const event of SOUND_EVENTS) {
    const original = soundBank[event];
    vi.spyOn(soundBank, event).mockImplementation((...args) => {
      played.push(event);
      return original(...args);
    });
  }
  const pack = stylePacks[DEFAULT_STYLE];
  for (const event of FEEDBACK_EVENTS) {
    const original = pack[event];
    vi.spyOn(pack, event).mockImplementation((...args) => {
      played.push(event);
      return original(...args);
    });
  }
  const student = new Map([['revisionden.studentId', 'student-1']]);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(
    <SoundProvider
      storage={null}
      random={() => 0}
      createContext={() => {
        const ctx = createFakeAudioContext();
        contexts.push(ctx);
        return ctx;
      }}
    >
      <StudentProvider
        storage={{
          getItem: (k) => student.get(k) ?? null,
          setItem: (k, v) => void student.set(k, v),
        }}
      >
        <RouterProvider router={router} />
      </StudentProvider>
    </SoundProvider>,
  );
  return { played, router, contexts };
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));
const lessonOf = (...indexes: number[]) =>
  server.use(
    http.get('*/v1/student/learn/lesson', () =>
      HttpResponse.json({ items: indexes.map((i) => demoItems[i]), draftContent: true }),
    ),
  );

afterEach(() => vi.restoreAllMocks());

describe('sounds in the app', () => {
  it('puts a quick mute in the header and a Sound section in Settings', async () => {
    renderWithSound('/settings/look-and-sound');
    expect(screen.getByRole('button', { name: 'Mute sounds' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sound' })).toBeInTheDocument();
  });

  it('Learn mode: right answer, daily goal met, then a celebration at the end', async () => {
    lessonOf(0, 2);
    const { played } = renderWithSound('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    await screen.findByRole('status', { name: 'Answer feedback' });
    expect(played).toEqual(['correct']);
    await click('Continue');
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Check');
    await screen.findByRole('status', { name: 'Answer feedback' });
    // The second right answer in a row is a combo (U5/U6).
    expect(played).toEqual(['correct', 'combo', 'streakDay']);
    await click('Finish');
    expect(played.at(-1)).toBe('setComplete');
  });

  it('Learn mode: a gentle sound for a wrong answer', async () => {
    lessonOf(1);
    const { played } = renderWithSound('/learn/topic/demo-topic-a');
    await userEvent.type(await screen.findByLabelText('Your answer'), 'nope');
    await click('Check');
    await screen.findByRole('status', { name: 'Answer feedback' });
    expect(played).toEqual(['wrong']);
  });

  it('Test mode: no right or wrong sounds before submit, and the reveal plays once', async () => {
    const { played } = renderWithSound('/learn/subject/gcse-maths/start');
    await click('Start');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Next');
    await click('Skip');
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Finish');
    await screen.findByRole('heading', { name: 'Your starting point' });
    expect(played).toEqual(['submit', 'submit', 'reveal']);
  });

  it('Test mode: one timer warning at one minute left, with a visual warning too', async () => {
    server.use(
      http.post('*/v1/student/learn/starting-tests', () =>
        HttpResponse.json(
          {
            id: '00000000-0000-4000-8000-000000000900',
            subjectId: 'gcse-maths',
            timeLimitSeconds: 61,
            items: demoItems.slice(0, 1),
            draftContent: false,
          },
          { status: 201 },
        ),
      ),
    );
    const { played } = renderWithSound('/learn/subject/gcse-maths/start');
    await click('Start');
    expect(await screen.findByText('1:01 left')).not.toHaveClass('timer--warning');
    await waitFor(() => expect(played).toEqual(['timerWarning']), { timeout: 3000 });
    expect(screen.getByText(/^1:00 left|^0:59 left/)).toHaveClass('timer--warning');
  });

  it('flashcards: a swish on flip and a pluck on each rating', async () => {
    const { played } = renderWithSound('/cards');
    await screen.findByRole('tab', { name: 'Due today (2)' });
    await click('Show answer');
    expect(played).toEqual(['cardFlip']);
    await click(/^Good/);
    await screen.findByText('Demo front 2');
    expect(played).toEqual(['cardFlip', 'cardRated']);
  });
});

describe('reward sounds in the app', () => {
  it('the rewards screen plays one sound for new rewards: the biggest', async () => {
    const { sampleRewards } = await import('../rewards/fixtures');
    const card = (id: string, rarity: 'common' | 'epic') => ({
      id,
      name: id,
      rarity,
      items: [],
      earned: true,
      current: 1,
      target: 1,
    });
    server.use(
      http.get('*/v1/student/rewards', () =>
        HttpResponse.json(
          sampleRewards({ newlyEarned: [card('level-5', 'common'), card('streak-100', 'epic')] }),
        ),
      ),
    );
    const { played, contexts, router } = renderWithSound('/settings');
    // The student taps something first (sound waits for a tap), then opens Rewards.
    await userEvent.click(screen.getByRole('heading', { level: 1, name: 'Me' }));
    await act(() => router.navigate('/rewards'));
    await screen.findByText('New: streak-100');
    await waitFor(() => expect(contexts[0]?.oscillators.length).toBeGreaterThan(0));
    expect(played).toEqual([]);
    // Exactly one sound: the epic streak-100 (ladder step 3), first variation (random is 0).
    const expected = createFakeAudioContext('running');
    rewardSound({ tier: 'epic', step: 3, voice: 'standard', fanfare: null }, 0)(
      expected,
      expected.createGain(),
      0,
    );
    expect(contexts[0]!.oscillators.length).toBe(expected.oscillators.length);
  });
});

describe('combo chime in lessons', () => {
  it('rises a step for each right answer in a row', async () => {
    lessonOf(0, 2);
    const { played, contexts } = renderWithSound('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('radio', { name: 'Option B' }));
    await click('Check');
    await screen.findByRole('status', { name: 'Answer feedback' });
    const firstChime = contexts[0]!.oscillators[0]!.frequencies[0]!;
    const after = contexts[0]!.oscillators.length;
    await click('Continue');
    await userEvent.type(await screen.findByLabelText('Your answer'), '4');
    await click('Check');
    await screen.findByRole('status', { name: 'Answer feedback' });
    expect(played.slice(0, 2)).toEqual(['correct', 'combo']);
    const secondChime = contexts[0]!.oscillators[after]!.frequencies[0]!;
    expect(secondChime).toBeGreaterThan(firstChime);
  });
});
