import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../mocks/server';
import { renderRoute } from '../test/render';

describe('Welcome screen', () => {
  it('shows the app name, the promise and Pip', async () => {
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'RevisionDen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Revision that finds the gaps.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Pip the fox' })).toBeInTheDocument();
  });

  it('offers password-free sign-in only', async () => {
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with microsoft/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('shows only the sign-in providers the server has set up', async () => {
    server.use(http.get('*/v1/auth/providers', () => HttpResponse.json({ providers: ['google'] })));
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue with microsoft/i }),
    ).not.toBeInTheDocument();
  });

  it('offers both providers when it cannot ask the server', async () => {
    server.use(http.get('*/v1/auth/providers', () => HttpResponse.error()));
    renderRoute('/', { studentId: null });
    expect(
      await screen.findByRole('button', { name: /continue with microsoft/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
  });

  it('goes on to choose who is revising after signing in', async () => {
    renderRoute('/', { studentId: null });
    await userEvent.click(await screen.findByRole('button', { name: /continue with google/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: "Who's revising?" }),
    ).toBeInTheDocument();
  });

  it('lets a student link this device with a code from a parent', async () => {
    renderRoute('/', { studentId: null });
    expect(await screen.findByText(/ask a parent to show you the qr code/i)).toBeInTheDocument();
  });
});
