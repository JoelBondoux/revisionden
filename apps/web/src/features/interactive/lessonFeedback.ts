import { defaultBaseUrl } from '../../api/ApiContext';

/**
 * Sends the one-tap "Did this help?" after an interactive lesson (W8): only the tap and the item.
 * Never any text. Stored like other student feedback (POST /v1/student/feedback).
 */
export async function sendLessonTap(itemId: string, helped: boolean): Promise<void> {
  const root = defaultBaseUrl(import.meta.env, window.location.origin).replace(/\/?$/, '/');
  const res = await fetch(new URL('v1/student/feedback', root), {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: helped ? 'lesson_helped' : 'lesson_not_helped', itemId }),
  });
  if (!res.ok) throw new Error(`Feedback not saved (${res.status})`);
}
