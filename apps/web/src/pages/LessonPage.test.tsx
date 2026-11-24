import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderRoute } from '../test/render';

async function openLesson() {
  const view = renderRoute('/lesson/standard-form');
  await screen.findByRole('heading', { level: 1, name: 'Standard form' });
  return view;
}

const check = () => userEvent.click(screen.getByRole('button', { name: 'Check' }));
const next = (name: RegExp) => userEvent.click(screen.getByRole('button', { name }));

describe('Lesson screen', () => {
  it('shows the lesson title, progress and the first question', async () => {
    await openLesson();
    expect(screen.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute(
      'aria-valuenow',
      '0',
    );
    expect(
      screen.getByRole('group', { name: 'Write 45 000 in standard form.' }),
    ).toBeInTheDocument();
  });

  it('only lets you check once you have chosen an answer', async () => {
    await openLesson();
    expect(screen.getByRole('button', { name: 'Check' })).toBeDisabled();
    await userEvent.click(screen.getByRole('radio', { name: '4.5 × 10⁴' }));
    expect(screen.getByRole('button', { name: 'Check' })).toBeEnabled();
  });

  it('shows positive feedback and XP for a correct answer', async () => {
    await openLesson();
    await userEvent.click(screen.getByRole('radio', { name: '4.5 × 10⁴' }));
    await check();
    const feedback = await screen.findByRole('status', { name: 'Answer feedback' });
    expect(feedback).toHaveTextContent('Correct!');
    expect(feedback).toHaveTextContent('+10 XP');
    expect(screen.getByRole('radio', { name: '4.5 × 10⁴' })).toBeDisabled();
  });

  it('shows the right answer and why for a wrong answer', async () => {
    await openLesson();
    await userEvent.click(screen.getByRole('radio', { name: '45 × 10³' }));
    await check();
    const feedback = await screen.findByRole('status', { name: 'Answer feedback' });
    expect(feedback).toHaveTextContent('Not quite');
    expect(feedback).toHaveTextContent('Answer: 4.5 × 10⁴');
    expect(feedback).toHaveTextContent(/between 1 and 10/);
  });

  it('accepts a typed short answer', async () => {
    await openLesson();
    await userEvent.click(screen.getByRole('radio', { name: '4.5 × 10⁴' }));
    await check();
    await next(/continue/i);
    expect(screen.getByRole('progressbar', { name: 'Lesson progress' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), '0.0032');
    await check();
    expect(await screen.findByRole('status', { name: 'Answer feedback' })).toHaveTextContent(
      'Correct!',
    );
  });

  it('finishes on the lesson complete screen with the score and XP', async () => {
    await openLesson();
    await userEvent.click(screen.getByRole('radio', { name: '4.5 × 10⁴' }));
    await check();
    await next(/continue/i);
    await userEvent.type(screen.getByRole('textbox', { name: 'Your answer' }), '0.32');
    await check();
    await screen.findByText('Not quite');
    await next(/continue/i);
    await userEvent.click(screen.getByRole('radio', { name: '2.1 × 10⁵' }));
    await check();
    await next(/finish/i);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lesson complete!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('+20 XP')).toBeInTheDocument();
    expect(screen.getByText('2 of 3 correct')).toBeInTheDocument();
  });

  it('lets you leave the lesson', async () => {
    await openLesson();
    expect(screen.getByRole('link', { name: 'Leave lesson' })).toHaveAttribute('href', '/map');
  });
});
