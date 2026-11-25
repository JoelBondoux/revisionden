import { useMemo } from 'react';
import { defaultBaseUrl } from '../../api/ApiContext';
import { createNotificationsApi, createParentPushApi } from './notificationsApi';
import { ReminderSettingsForm } from './ReminderSettingsForm';
import { browserPushEnvironment } from './push';
import { ReminderToggle } from './ReminderToggle';

export { ReminderSettingsForm } from './ReminderSettingsForm';
export { ReminderToggle } from './ReminderToggle';
export { createNotificationsApi, createParentPushApi } from './notificationsApi';

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

const apiBase = () => defaultBaseUrl(import.meta.env, window.location.origin);

/** Reward news on the parent's own device (workstream H2), using the real browser and API. */
export function ParentRewardNews() {
  const env = useMemo(() => browserPushEnvironment(), []);
  const api = useMemo(() => createParentPushApi({ baseUrl: apiBase() }), []);
  return <ReminderToggle env={env} api={api} audience="parent" />;
}

/** The parent's reminder settings for one child, using the real API. */
export function ChildReminderSettings({ studentId }: { studentId: string }) {
  const api = useMemo(() => createNotificationsApi({ baseUrl: apiBase() }), []);
  return <ReminderSettingsForm api={api} studentId={studentId} />;
}
