import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { ReminderSettingsForm } from './ReminderSettingsForm';
import type { NotificationsApi, ReminderSettings } from './notificationsApi';

const defaults: ReminderSettings = {
  enabled: true,
  streakReminders: true,
  sessionReminders: true,
  quietStart: '21:00',
  quietEnd: '07:30',
  weekdayQuietStart: '08:30',
  weekdayQuietEnd: '15:30',
  sessionReminderTime: '16:30',
  streakReminderTime: '19:00',
  timeZone: 'Europe/London',
  maxPerDay: 2,
};

function setup(load: () => Promise<ReminderSettings> = async () => defaults) {
  const save = vi.fn(async (_id: string, update: Partial<ReminderSettings>) => ({
    ...defaults,
    ...update,
  }));
  const api = {
    baseUrl: '/api/',
    getVapidKey: vi.fn(),
    saveSubscription: vi.fn(),
    deleteSubscription: vi.fn(),
    getReminderSettings: vi.fn(load),
    saveReminderSettings: save,
  } as unknown as NotificationsApi;
  render(<ReminderSettingsForm api={api} studentId="student-1" />);
  return { api, save };
}

describe('ReminderSettingsForm', () => {
  it('shows the current quiet hours and school hours', async () => {
    setup();
    expect(await screen.findByLabelText(/quiet from/i)).toHaveValue('21:00');
    expect(screen.getByLabelText(/quiet until/i)).toHaveValue('07:30');
    expect(screen.getByLabelText(/school day starts/i)).toHaveValue('08:30');
    expect(screen.getByLabelText(/school day ends/i)).toHaveValue('15:30');
    expect(screen.getByText(/at most 2 reminders a day/i)).toBeInTheDocument();
  });

  it('saves changed settings for this student', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    const from = await screen.findByLabelText(/quiet from/i);
    await user.clear(from);
    await user.type(from, '20:30');
    await user.click(screen.getByLabelText(/streak reminders/i));
    await user.click(screen.getByRole('button', { name: /save/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/saved/i);
    expect(save).toHaveBeenCalledWith(
      'student-1',
      expect.objectContaining({ quietStart: '20:30', streakReminders: false }),
    );
  });

  it('hides the detail when reminders are switched off', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByLabelText(/send reminders/i));
    expect(screen.queryByLabelText(/quiet from/i)).not.toBeInTheDocument();
  });

  it('shows an error when the settings cannot load', async () => {
    setup(() => Promise.reject(new Error('down')));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't load/i);
  });

  it('shows an error when saving fails', async () => {
    const user = userEvent.setup();
    const { save } = setup();
    save.mockRejectedValueOnce(new Error('down'));
    await user.click(await screen.findByRole('button', { name: /save/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn't save/i);
  });
});
