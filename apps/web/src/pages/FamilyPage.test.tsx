import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';

describe('Family screen', () => {
  it('lists each child from the parent family route with their avatar', async () => {
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('button', { name: /NovaFox/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /PixelOwl/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: "NovaFox's avatar" })).toBeInTheDocument();
    expect(screen.getByText('Year 11')).toBeInTheDocument();
  });

  it("opens the chosen student's learning path", async () => {
    renderRoute('/family', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: /PixelOwl/ }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Topic map' })).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in instead of showing an error', async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json(
          { error: { code: 'unauthorized', message: 'Sign in to continue', ref: 'RD-7K2M9Q' } },
          { status: 401 },
        ),
      ),
    );
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('heading', { name: 'Please sign in' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/');
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('shows a reference code the parent can report when something goes wrong', async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json(
          { error: { code: 'internal_error', message: 'Something went wrong', ref: 'RD-7K2M9Q' } },
          { status: 500 },
        ),
      ),
    );
    renderRoute('/family', { studentId: null });
    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByText('RD-7K2M9Q')).toBeInTheDocument();
  });

  it('offers a retry when the family cannot be loaded', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.error()));
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('points a parent with no children yet to adding one', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.json({ children: [] })));
    renderRoute('/family', { studentId: null });
    expect(await screen.findByText('No children added yet.')).toBeInTheDocument();
  });

  it('lets a parent add or manage children', async () => {
    renderRoute('/family', { studentId: null });
    expect(
      await screen.findByRole('link', { name: 'Parents: add or manage children' }),
    ).toHaveAttribute('href', '/onboarding');
  });
});
