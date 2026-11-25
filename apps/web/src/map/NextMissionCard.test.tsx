import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NextMissionCard } from './NextMissionCard';

describe('NextMissionCard', () => {
  it('shows the mission, its length and a GO link to the lesson', () => {
    render(
      <MemoryRouter>
        <NextMissionCard
          mission={{
            kind: 'weak-spot',
            title: 'Fix weak spot: Surds',
            lessonId: 'surds',
            minutes: 8,
          }}
        />
      </MemoryRouter>,
    );
    const card = screen.getByRole('region', { name: 'Next mission' });
    expect(card).toHaveTextContent('Fix weak spot: Surds');
    expect(card).toHaveTextContent('8 min');
    expect(screen.getByRole('link', { name: 'Go: Fix weak spot: Surds' })).toHaveAttribute(
      'href',
      '/learn/topic/surds',
    );
    expect(screen.getByRole('link', { name: /go/i })).toHaveClass('btn--gold');
  });
});
