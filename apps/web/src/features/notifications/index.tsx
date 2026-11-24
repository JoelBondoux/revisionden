import { useMemo } from 'react';
import { defaultBaseUrl } from '../../api/ApiContext';
import { createNotificationsApi } from './notificationsApi';
import { browserPushEnvironment } from './push';
import { ReminderToggle } from './ReminderToggle';

export { ReminderSettingsForm } from './ReminderSettingsForm';
export { ReminderToggle } from './ReminderToggle';
export { createNotificationsApi } from './notificationsApi';

/** The reminders card for this device, using the real browser and API. */
export function DeviceReminders() {
  const env = useMemo(() => browserPushEnvironment(), []);
  const api = useMemo(
    () =>
      createNotificationsApi({ baseUrl: defaultBaseUrl(import.meta.env, window.location.origin) }),
    [],
  );
  return <ReminderToggle env={env} api={api} />;
}
