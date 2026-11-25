import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { eq } from 'drizzle-orm';
import {
  parentPushSubscriptions,
  parentRewards,
  parents,
  pushSubscriptions,
  reminderLog,
} from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { makeStudentWithDevice, studentCookie } from '../test/fixtures';

let ctx: TestContext;
afterEach(async () => ctx.close());

const sub = {
  endpoint: 'https://push.example.com/send/device-1',
  keys: { p256dh: 'BPublicKeyFromBrowser', auth: 'authSecretFromBrowser' },
};

describe('push key', () => {
  it('answers 503 while web push is not configured', async () => {
    ctx = await createTestContext();
    const res = await ctx.app.request('/v1/notifications/vapid-key');
    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe('push_unavailable');
  });

  it('gives the public VAPID key to anyone (it is public)', async () => {
    ctx = await createTestContext({
      config: { push: { keys: { publicKey: 'BPUB', privateKey: 'secret' } } },
    });
    const res = await ctx.app.request('/v1/notifications/vapid-key');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ publicKey: 'BPUB' });
  });
});

describe('student push subscriptions', () => {
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('needs an unlocked student device', async () => {
    const res = await ctx.app.request('/v1/student/push-subscriptions', jsonRequest('POST', sub));
    expect(res.status).toBe(401);
  });

  it('saves the subscription for this device, and replaces it if sent again', async () => {
    const s = await makeStudentWithDevice(ctx.db);
    const headers = await studentCookie(ctx.db, s.student.id, s.device.id);
    const first = await ctx.app.request(
      '/v1/student/push-subscriptions',
      jsonRequest('POST', sub, headers),
    );
    expect(first.status).toBe(201);
    const again = await ctx.app.request(
      '/v1/student/push-subscriptions',
      jsonRequest('POST', { ...sub, keys: { p256dh: 'BNewKey', auth: 'newAuth' } }, headers),
    );
    expect(again.status).toBe(201);
    const rows = await ctx.db.select().from(pushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      studentId: s.student.id,
      deviceId: s.device.id,
      endpoint: sub.endpoint,
      p256dh: 'BNewKey',
    });
  });

  it('rejects an endpoint that is not https', async () => {
    const s = await makeStudentWithDevice(ctx.db);
    const headers = await studentCookie(ctx.db, s.student.id, s.device.id);
    const res = await ctx.app.request(
      '/v1/student/push-subscriptions',
      jsonRequest('POST', { ...sub, endpoint: 'http://push.example.com/x' }, headers),
    );
    expect(res.status).toBe(400);
  });

  it('unsubscribes, and only removes its own subscription', async () => {
    const a = await makeStudentWithDevice(ctx.db);
    const b = await makeStudentWithDevice(ctx.db);
    const aHeaders = await studentCookie(ctx.db, a.student.id, a.device.id);
    const bHeaders = await studentCookie(ctx.db, b.student.id, b.device.id);
    await ctx.app.request('/v1/student/push-subscriptions', jsonRequest('POST', sub, aHeaders));

    const wrong = await ctx.app.request(
      '/v1/student/push-subscriptions',
      jsonRequest('DELETE', { endpoint: sub.endpoint }, bHeaders),
    );
    expect(wrong.status).toBe(204);
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(1);

    const res = await ctx.app.request(
      '/v1/student/push-subscriptions',
      jsonRequest('DELETE', { endpoint: sub.endpoint }, aHeaders),
    );
    expect(res.status).toBe(204);
    expect(await ctx.db.select().from(pushSubscriptions)).toHaveLength(0);
  });

  it('gives the service worker the latest reminder text from the last day', async () => {
    const s = await makeStudentWithDevice(ctx.db);
    const headers = await studentCookie(ctx.db, s.student.id, s.device.id);
    const none = await ctx.app.request('/v1/student/reminders/latest', { headers });
    expect(await none.json()).toEqual({ message: null });

    await ctx.db.insert(reminderLog).values([
      {
        studentId: s.student.id,
        kind: 'session',
        localDate: '2026-11-24',
        message: 'Older one',
        sentAt: new Date(ctx.clock.now().getTime() - 60_000 * 5),
      },
      {
        studentId: s.student.id,
        kind: 'streak',
        localDate: '2026-11-24',
        message: 'Newest one',
        sentAt: new Date(ctx.clock.now().getTime() - 60_000),
      },
    ]);
    const res = await ctx.app.request('/v1/student/reminders/latest', { headers });
    expect(await res.json()).toEqual({ message: 'Newest one' });

    ctx.clock.advance(25 * 60 * 60 * 1000);
    const stale = await ctx.app.request('/v1/student/reminders/latest', {
      headers: await studentCookie(ctx.db, s.student.id, s.device.id),
    });
    expect(await stale.json()).toEqual({ message: null });
  });
});

describe('parent reminder settings', () => {
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  async function parentWithStudent() {
    const parent = await ctx.signInParent();
    const res = await ctx.app.request(
      '/v1/students',
      jsonRequest(
        'POST',
        {
          nickname: 'test_kid',
          avatarCode: (await import('../test/helpers')).AVATAR,
          yearGroup: 10,
        },
        parent.headers,
      ),
    );
    const student = (await res.json()) as { id: string };
    return { headers: parent.headers, studentId: student.id };
  }

  it('shows the defaults before the parent changes anything', async () => {
    const { headers, studentId } = await parentWithStudent();
    const res = await ctx.app.request(`/v1/students/${studentId}/reminder-settings`, { headers });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
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
    });
  });

  it('saves changed quiet hours and keeps the rest', async () => {
    const { headers, studentId } = await parentWithStudent();
    const put = await ctx.app.request(
      `/v1/students/${studentId}/reminder-settings`,
      jsonRequest(
        'PUT',
        { quietStart: '20:30', weekdayQuietEnd: '16:00', streakReminders: false },
        headers,
      ),
    );
    expect(put.status).toBe(200);
    const res = await ctx.app.request(`/v1/students/${studentId}/reminder-settings`, { headers });
    expect(await res.json()).toMatchObject({
      quietStart: '20:30',
      quietEnd: '07:30',
      weekdayQuietEnd: '16:00',
      streakReminders: false,
      sessionReminders: true,
    });
  });

  it('rejects bad times, unknown time zones and unknown fields', async () => {
    const { headers, studentId } = await parentWithStudent();
    for (const body of [{ quietStart: '9pm' }, { timeZone: 'Mars/Olympus' }, { maxPerDay: 5 }]) {
      const res = await ctx.app.request(
        `/v1/students/${studentId}/reminder-settings`,
        jsonRequest('PUT', body, headers),
      );
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
  });

  it("never shows or changes another family's student", async () => {
    const { studentId } = await parentWithStudent();
    const other = await ctx.signInParent();
    const res = await ctx.app.request(`/v1/students/${studentId}/reminder-settings`, {
      headers: other.headers,
    });
    expect(res.status).toBe(404);
    const put = await ctx.app.request(
      `/v1/students/${studentId}/reminder-settings`,
      jsonRequest('PUT', { enabled: false }, other.headers),
    );
    expect(put.status).toBe(404);
  });
});

describe('parent push subscriptions and reward news', () => {
  beforeEach(async () => {
    ctx = await createTestContext();
  });

  it('needs a signed-in parent', async () => {
    const post = await ctx.app.request('/v1/parent/push-subscriptions', jsonRequest('POST', sub));
    expect(post.status).toBe(401);
    expect((await ctx.app.request('/v1/parent/notifications/latest')).status).toBe(401);
  });

  it("saves this parent device's subscription, replaces it if sent again and removes it", async () => {
    const parent = await ctx.signInParent();
    const post = () =>
      ctx.app.request('/v1/parent/push-subscriptions', jsonRequest('POST', sub, parent.headers));
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    const [me] = await ctx.db.select().from(parents).where(eq(parents.authUserId, parent.userId));
    const rows = await ctx.db.select().from(parentPushSubscriptions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ parentId: me!.id, endpoint: sub.endpoint });

    const other = await ctx.signInParent();
    await ctx.app.request(
      '/v1/parent/push-subscriptions',
      jsonRequest('DELETE', { endpoint: sub.endpoint }, other.headers),
    );
    expect(await ctx.db.select().from(parentPushSubscriptions)).toHaveLength(1);
    const del = await ctx.app.request(
      '/v1/parent/push-subscriptions',
      jsonRequest('DELETE', { endpoint: sub.endpoint }, parent.headers),
    );
    expect(del.status).toBe(204);
    expect(await ctx.db.select().from(parentPushSubscriptions)).toHaveLength(0);
  });

  it('rejects a push endpoint that is not https', async () => {
    const parent = await ctx.signInParent();
    const res = await ctx.app.request(
      '/v1/parent/push-subscriptions',
      jsonRequest('POST', { ...sub, endpoint: 'http://push.example.com/x' }, parent.headers),
    );
    expect(res.status).toBe(400);
  });

  it('gives the latest reward news for this family only, from the last day', async () => {
    const { studentId, parent } = await ctx.familyStudent('test_kid');
    const latest = async (headers: Record<string, string>) =>
      (await (await ctx.app.request('/v1/parent/notifications/latest', { headers })).json()) as {
        message: string | null;
      };
    expect(await latest(parent.headers)).toEqual({ message: null });

    const now = ctx.clock.now();
    await ctx.db.insert(parentRewards).values([
      {
        studentId,
        title: 'Old news',
        targetKind: 'stat',
        stat: 'level',
        atLeast: 1,
        reachedNotifiedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
      {
        studentId,
        title: 'Cinema trip',
        targetKind: 'stat',
        stat: 'level',
        atLeast: 1,
        reachedNotifiedAt: new Date(now.getTime() - 60 * 1000),
      },
    ]);
    expect(await latest(parent.headers)).toEqual({
      message: 'test_kid reached a reward target: Cinema trip',
    });
    const other = await ctx.signInParent();
    expect(await latest(other.headers)).toEqual({ message: null });
  });
});
