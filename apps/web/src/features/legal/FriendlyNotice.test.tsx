import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { FriendlyNotice } from './FriendlyNotice';
import type { FriendlyNoticeContent } from './friendlyNotice';

const content: FriendlyNoticeContent = {
  intro: 'This is for you.',
  shortVersion: [
    { icon: 'mask', text: "We don't know your real name." },
    { icon: 'robot', text: "AI never knows it's you." },
  ],
  sections: [
    {
      id: 'what-we-keep',
      title: 'What we keep',
      icon: 'folder',
      keyPoints: ['Your nickname.', 'Your scores.'],
      details: 'The long explanation.',
    },
    {
      id: 'your-rights',
      title: 'Your rights',
      icon: 'hand',
      keyPoints: ['You can ask to see it.'],
      details: 'Rights in detail.',
    },
  ],
};

function show() {
  render(
    <MemoryRouter>
      <FriendlyNotice content={content} />
    </MemoryRouter>,
  );
}

describe('FriendlyNotice', () => {
  it('shows the short version as cards', () => {
    show();
    const cards = screen.getByRole('list', { name: 'The short version' });
    expect(within(cards).getAllByRole('listitem')).toHaveLength(2);
    expect(within(cards).getByText("We don't know your real name.")).toBeInTheDocument();
  });

  it('always shows the key points and hides the long text until Read more', async () => {
    show();
    expect(screen.getByRole('heading', { level: 2, name: 'What we keep' })).toBeInTheDocument();
    expect(screen.getByText('Your nickname.')).toBeVisible();
    expect(screen.getByText('The long explanation.')).not.toBeVisible();

    const button = screen.getByRole('button', { name: 'Read more about What we keep' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('The long explanation.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Show less about What we keep' })).toBe(button);
  });

  it('opens and closes every section with Expand all', async () => {
    show();
    await userEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('The long explanation.')).toBeVisible();
    expect(screen.getByText('Rights in detail.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.getByText('Rights in detail.')).not.toBeVisible();
  });

  it('links each button to the text it controls', () => {
    show();
    const button = screen.getByRole('button', { name: 'Read more about Your rights' });
    const panel = document.getElementById(button.getAttribute('aria-controls')!);
    expect(panel).toHaveTextContent('Rights in detail.');
  });
});
