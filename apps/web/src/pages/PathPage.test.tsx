import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';

describe('Learning path screen', () => {
  it('sends you to choose a student when nobody is chosen yet', async () => {
    renderRoute('/learn', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: "Who's revising?" }),
    ).toBeInTheDocument();
  });

  it('shows the subject, streak and daily goal', async () => {
    renderRoute('/learn');
    expect(await screen.findByText('GCSE Higher Maths')).toBeInTheDocument();
    expect(screen.getByText('4 day streak')).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Daily goal' })).toHaveAttribute(
      'aria-valuetext',
      '30 of 50 XP',
    );
  });

  it('groups lessons into units', async () => {
    renderRoute('/learn');
    expect(await screen.findByRole('heading', { level: 2, name: 'Number' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Algebra' })).toBeInTheDocument();
  });

  it('shows locked, done, current and weak-spot nodes', async () => {
    renderRoute('/learn');
    expect(await screen.findByRole('link', { name: 'Fractions, done' })).toHaveAttribute(
      'href',
      '/lesson/fractions',
    );
    expect(screen.getByRole('link', { name: 'Surds, weak spot' })).toHaveAttribute(
      'href',
      '/lesson/surds',
    );
    expect(screen.getByRole('link', { name: 'Standard form, start lesson' })).toHaveAttribute(
      'href',
      '/lesson/standard-form',
    );
    expect(screen.getByRole('button', { name: 'Bounds, locked' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Bounds/ })).not.toBeInTheDocument();
  });

  it('explains how to unlock a locked lesson', async () => {
    renderRoute('/learn');
    await userEvent.click(await screen.findByRole('button', { name: 'Bounds, locked' }));
    const message = await screen.findByText('Finish the lessons before Bounds to unlock it.');
    expect(message.closest('[role="status"]')).not.toBeNull();
  });

  it('offers a retry when the path cannot be loaded', async () => {
    server.use(http.get('*/api/students/:id/path', () => HttpResponse.error()));
    renderRoute('/learn');
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
