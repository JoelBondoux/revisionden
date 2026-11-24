import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { ReminderToggle } from './ReminderToggle';
import type { NotificationsApi } from './notificationsApi';
import type { PushEnvironment } from './push';

function setup(
  overrides: Partial<PushEnvironment> = {},
  apiOverrides: Partial<NotificationsApi> = {},
) {
  let permission: NotificationPermission = 'default';
  let current: {
    endpoint: string;
    toJSON: () => unknown;
    unsubscribe: () => Promise<boolean>;
  } | null = null;
  const env: PushEnvironment = {
    supported: true,
    standalone: true,
    permission: () => permission,
    requestPermission: vi.fn(async (): Promise<NotificationPermission> => (permission = 'granted')),
    pushManager: async () => ({
      subscribe: async () =>
        (current = {
          endpoint: 'https://push.example.com/1',
          toJSON: () => ({
            endpoint: 'https://push.example.com/1',
            keys: { p256dh: 'p', auth: 'a' },
          }),
          unsubscribe: async () => ((current = null), true),
        }),
      getSubscription: async () => current,
    }),
    rememberApiBase: async () => undefined,
    ...overrides,
  };
  const api: NotificationsApi = {
    baseUrl: '/api/',
    getVapidKey: async () => 'AAAA',
    saveSubscription: vi.fn(async () => undefined),
    deleteSubscription: vi.fn(async () => undefined),
    getReminderSettings: vi.fn(),
    saveReminderSettings: vi.fn(),
    ...apiOverrides,
  };
  render(
    <MemoryRouter>
      <ReminderToggle env={env} api={api} />
    </MemoryRouter>,
  );
  return { env, api };
}

describe('ReminderToggle', () => {
  it('explains reminders and does not ask for permission until the button is pressed', async () => {
    const { env } = setup();
    expect(await screen.findByRole('button', { name: /turn on reminders/i })).toBeInTheDocument();
    expect(screen.getByText(/at most 2 a day/i)).toBeInTheDocument();
    expect(env.requestPermission).not.toHaveBeenCalled();
  });

  it('turns reminders on, then off again', async () => {
    const user = userEvent.setup();
    const { api } = setup();
    await user.click(await screen.findByRole('button', { name: /turn on reminders/i }));
    expect(await screen.findByText(/reminders are on/i)).toBeInTheDocument();
    expect(api.saveSubscription).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: /turn off/i }));
    expect(await screen.findByRole('button', { name: /turn on reminders/i })).toBeInTheDocument();
    expect(api.deleteSubscription).toHaveBeenCalledWith('https://push.example.com/1');
  });

  it('says how to unblock when notifications are blocked', async () => {
    setup({ permission: () => 'denied' });
    expect(await screen.findByText(/blocked/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /turn on/i })).not.toBeInTheDocument();
  });

  it('points iPhone and iPad users to Add to Home Screen first', async () => {
    setup({ supported: false, standalone: false, ios: true });
    expect(await screen.findByRole('link', { name: /add to home screen/i })).toHaveAttribute(
      'href',
      '/install',
    );
  });

  it('says so when the browser cannot show reminders', async () => {
    setup({ supported: false });
    expect(await screen.findByText(/can't show reminders/i)).toBeInTheDocument();
  });

  it('shows a friendly error when switching on fails', async () => {
    const user = userEvent.setup();
    setup({}, { getVapidKey: async () => Promise.reject(new Error('503')) });
    await user.click(await screen.findByRole('button', { name: /turn on reminders/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't turn on reminders/i);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /turn on reminders/i })).toBeEnabled(),
    );
  });
});
