import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { AskParentPage } from './AskParentPage';
import { ComplaintsApiError } from './complaintsApi';

const show = (send = vi.fn(async () => {})) => {
  render(
    <MemoryRouter>
      <AskParentPage send={send} />
    </MemoryRouter>,
  );
  return send;
};

describe('Ask a parent to raise something (student)', () => {
  it('explains that only parents make complaints and links to Get help', () => {
    show();
    expect(
      screen.getByRole('heading', { name: 'Ask a parent to raise something' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Get help' })).toHaveAttribute('href', '/help');
  });

  it('sends a topic and an optional note to the parents', async () => {
    const send = show();
    await userEvent.click(screen.getByLabelText('A mark or a question seemed wrong'));
    await userEvent.type(screen.getByLabelText(/Anything to add/), 'Question 3');
    await userEvent.click(screen.getByRole('button', { name: 'Send to my parents' }));
    expect(send).toHaveBeenCalledWith({ topic: 'marking', note: 'Question 3' });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Sent. Your parents will see it in their parent area.',
    );
  });

  it('leaves the note out when it is empty, and shows a refusal', async () => {
    const send = show(
      vi.fn(async () => {
        throw new ComplaintsApiError(429, 'limit_reached', 'You can ask 3 times a day.');
      }),
    );
    await userEvent.click(screen.getByLabelText('Something felt unfair'));
    await userEvent.click(screen.getByRole('button', { name: 'Send to my parents' }));
    expect(send).toHaveBeenCalledWith({ topic: 'unfair' });
    expect(await screen.findByRole('alert')).toHaveTextContent('You can ask 3 times a day.');
  });
});
