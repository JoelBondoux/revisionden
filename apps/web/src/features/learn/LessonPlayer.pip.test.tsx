import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { StudentProvider } from '../../session/StudentContext';
import { LessonPlayer } from './LessonPlayer';
import { demoItems } from './mocks';

const reactToAnswer = vi.hoisted(() => vi.fn());
vi.mock('../juice/pip/reactions', async (original) => ({
  ...(await original<typeof import('../juice/pip/reactions')>()),
  reactToAnswer,
}));

// J14: every lesson screen (topic lessons, practice, command words, the 5-a-day and recall) uses
// the lesson player, so it sends each marked answer to Pip unless a page passes its own handler.
describe('the lesson player and Pip (J14)', () => {
  it("has one Pip, in the lesson's own header with the progress bar, and his line beside the avatar (J14b)", async () => {
    const storage = new Map([['revisionden.studentId', 'student-1']]);
    const { container } = render(
      <StudentProvider
        storage={{
          getItem: (k) => storage.get(k) ?? null,
          setItem: (k, v) => void storage.set(k, v),
        }}
      >
        <MemoryRouter>
          <LessonPlayer title="Demo lesson" items={[demoItems[1]!]} draftContent={false} />
        </MemoryRouter>
      </StudentProvider>,
    );
    await screen.findByLabelText('Your answer');
    const top = container.querySelector('.lesson__top') as HTMLElement;
    expect(within(top).getByRole('button', { name: 'Home' })).toBeInTheDocument();
    expect(within(top).getByRole('progressbar', { name: 'Lesson progress' })).toBeInTheDocument();
    expect(container.querySelectorAll('.pip-figure')).toHaveLength(1);
    expect(container.querySelector('.pip-says')).toBeNull();
    expect(container.querySelector('.lesson__pip-line')).toHaveTextContent(/\S/);
  });

  it("sends each marked answer to Pip's reactions by default", async () => {
    const storage = new Map([['revisionden.studentId', 'student-1']]);
    render(
      <StudentProvider
        storage={{
          getItem: (k) => storage.get(k) ?? null,
          setItem: (k, v) => void storage.set(k, v),
        }}
      >
        <MemoryRouter>
          <LessonPlayer title="Demo lesson" items={[demoItems[1]!]} draftContent={false} />
        </MemoryRouter>
      </StudentProvider>,
    );
    await userEvent.type(await screen.findByLabelText('Your answer'), 'demo answer');
    await userEvent.click(screen.getByRole('button', { name: 'Check' }));
    await screen.findByRole('status', { name: 'Answer feedback' });
    expect(reactToAnswer).toHaveBeenCalledWith({ kind: 'right', combo: 1 });
  });
});
