import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { routes } from '../routes';

function renderComplete(state?: unknown) {
  const router = createMemoryRouter(routes, {
    initialEntries: [{ pathname: '/lesson/standard-form/complete', state }],
  });
  render(<RouterProvider router={router} />);
}

describe('Lesson complete screen', () => {
  it('celebrates with the XP earned and the score', async () => {
    renderComplete({ xpEarned: 30, correct: 3, total: 3 });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lesson complete!' }),
    ).toBeInTheDocument();
    expect(screen.getByText('+30 XP')).toBeInTheDocument();
    expect(screen.getByText('3 of 3 correct')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pip cheering' })).toBeInTheDocument();
  });

  it('leads back to the learning path', async () => {
    renderComplete({ xpEarned: 10, correct: 1, total: 3 });
    expect(await screen.findByRole('link', { name: /continue/i })).toHaveAttribute(
      'href',
      '/learn',
    );
  });

  it('still makes sense when opened without results', async () => {
    renderComplete();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Lesson complete!' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/XP$/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /continue/i })).toBeInTheDocument();
  });
});
