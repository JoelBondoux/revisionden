import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { navigation } from '../api/signIn';
import { renderRoute } from '../test/render';

describe('Family screen', () => {
  it('lists each child from the parent family route with their avatar', async () => {
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('link', { name: /^NovaFox/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^PixelOwl/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: "NovaFox's avatar" })).toBeInTheDocument();
    expect(screen.getByText('Year 11')).toBeInTheDocument();
  });

  it('opens the parent home for the chosen child, never the student screens', async () => {
    const { router } = renderRoute('/family', { studentId: null });
    const nova = await screen.findByRole('link', { name: /^NovaFox/ });
    expect(nova).toHaveAttribute('href', '/parent?student=00000000-0000-4000-8000-0000000000a1');
    await userEvent.click(nova);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Parent home' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/parent');
    expect(router.state.location.search).toBe('?student=00000000-0000-4000-8000-0000000000a1');
    expect(screen.queryByRole('heading', { name: 'Topic map' })).not.toBeInTheDocument();
  });

  it('shows each child the rewards their parent set and a way to link a device', async () => {
    renderRoute('/family', { studentId: null });
    expect(
      await screen.findByRole('link', { name: 'Rewards you set for NovaFox' }),
    ).toHaveAttribute('href', '/family/00000000-0000-4000-8000-0000000000a1/rewards');
    expect(screen.getByRole('link', { name: 'Link a device for NovaFox' })).toHaveAttribute(
      'href',
      '/onboarding?link=00000000-0000-4000-8000-0000000000a1',
    );
  });

  it('links to the family feedback list', async () => {
    renderRoute('/family', { studentId: null });
    expect(await screen.findByRole('link', { name: 'Family feedback' })).toHaveAttribute(
      'href',
      '/feedback/family',
    );
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
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
  });

  it('signs in from the prompt and comes back to the same page', async () => {
    server.use(
      http.get('*/v1/onboarding/family', () =>
        HttpResponse.json({ error: { code: 'unauthorized', message: 'x' } }, { status: 401 }),
      ),
    );
    let body: unknown;
    server.use(
      http.post('*/api/auth/sign-in/social', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ url: 'https://accounts.example/consent', redirect: true });
      }),
    );
    const leave = vi.spyOn(navigation, 'leaveTo').mockImplementation(() => undefined);
    renderRoute('/family', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue with Google' }));
    await waitFor(() => expect(leave).toHaveBeenCalledWith('https://accounts.example/consent'));
    expect(body).toMatchObject({
      provider: 'google',
      callbackURL: `${window.location.origin}/family`,
    });
    leave.mockRestore();
  });

  it('signs the parent out and goes back to the welcome page', async () => {
    let signedOut = false;
    server.use(
      http.post('*/api/auth/sign-out', () => {
        signedOut = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const { router } = renderRoute('/family', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));
    expect(signedOut).toBe(true);
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

  it('sends a parent with no children yet straight to onboarding', async () => {
    server.use(http.get('*/v1/onboarding/family', () => HttpResponse.json({ children: [] })));
    const { router } = renderRoute('/family', { studentId: null });
    await waitFor(() => expect(router.state.location.pathname).toBe('/onboarding'));
  });

  it('lets a parent add or manage children', async () => {
    renderRoute('/family', { studentId: null });
    expect(
      await screen.findByRole('link', { name: 'Parents: add or manage children' }),
    ).toHaveAttribute('href', '/onboarding');
  });
});
