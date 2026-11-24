import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';

describe('Family screen', () => {
  it('lists each student with their avatar', async () => {
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('button', { name: /NovaFox/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PixelOwl/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: "NovaFox's avatar" })).toBeInTheDocument();
    expect(screen.getByText('Year 11')).toBeInTheDocument();
  });

  it("opens the chosen student's learning path", async () => {
    renderRoute('/family', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: /PixelOwl/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Your path' })).toBeInTheDocument();
  });

  it('offers a retry when the family cannot be loaded', async () => {
    server.use(http.get('*/api/family', () => HttpResponse.error()));
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('lets a parent add or manage children', async () => {
    renderRoute('/family', { studentId: null });
    expect(
      await screen.findByRole('link', { name: 'Parents: add or manage children' }),
    ).toHaveAttribute('href', '/onboarding');
  });
});
