import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { server } from '../../mocks/server';
import { routes } from '../../routes';
import { StudentProvider } from '../../session/StudentContext';
import { demoItems } from '../learn/mocks';
import { fakeSpeech, makeUtterance } from './fakeSpeech';
import { ReadAloudProvider } from './ReadAloudProvider';

function renderWithSpeech(path: string) {
  const speech = fakeSpeech([{ name: 'Device UK', lang: 'en-GB', localService: true }]);
  const storage = new Map<string, string>([['revisionden.studentId', 'student-1']]);
  const store = { getItem: (k: string) => storage.get(k) ?? null, setItem: () => undefined };
  render(
    <ReadAloudProvider synth={speech.synth} makeUtterance={makeUtterance} storage={store}>
      <StudentProvider storage={store}>
        <RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />
      </StudentProvider>
    </ReadAloudProvider>,
  );
  return speech;
}

const click = (name: string | RegExp) => userEvent.click(screen.getByRole('button', { name }));

describe('read aloud wiring', () => {
  it('reads a lesson question aloud, then the answer and explanation', async () => {
    server.use(
      http.get('*/v1/student/learn/lesson', () =>
        HttpResponse.json({ items: [demoItems[1]], draftContent: true }),
      ),
    );
    const speech = renderWithSpeech('/learn/topic/demo-topic-a');
    await userEvent.click(await screen.findByRole('button', { name: 'Read the question aloud' }));
    expect(speech.spoken.at(-1)?.text).toContain(
      (demoItems[1] as { prompt: string }).prompt.replace(/\s+$/, ''),
    );
    await userEvent.type(screen.getByLabelText('Your answer'), 'nope');
    await click('Check');
    await userEvent.click(await screen.findByRole('button', { name: 'Read the feedback aloud' }));
    expect(speech.spoken.at(-1)?.text).toMatch(
      /Not quite\. Answer: demo answer\. .*Demo explanation/,
    );
  });

  it('reads the front of a flashcard, then the back once it is turned over', async () => {
    const speech = renderWithSpeech('/cards');
    await userEvent.click(await screen.findByRole('button', { name: 'Read the card aloud' }));
    expect(speech.spoken.at(-1)?.text).toBe('Demo front 1');
    await click('Show answer');
    await click('Read the card aloud');
    expect(speech.spoken.at(-1)?.text).toMatch(/^Demo back 1/);
  });

  it('shows the Read aloud section in Settings', async () => {
    renderWithSpeech('/settings/look-and-sound');
    expect(await screen.findByRole('heading', { name: 'Read aloud' })).toBeInTheDocument();
  });
});
