import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { familyEvents, parentPushSubscriptions, parents } from '@revisionden/db';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { describeEvent, recordFamilyEvent, runFamilyEventNotifications } from './family-events';
import type { PushResult, PushTarget } from './notifications/web-push';

let t: TestContext;
beforeEach(async () => {
  // The test clock starts at 10:00 in London: outside the nightly quiet hours.
  t = await createTestContext();
});
afterEach(async () => t.close());

function fakeSender(result: PushResult = 'sent') {
  const sent: PushTarget[] = [];
  return { sent, send: async (target: PushTarget) => (sent.push(target), result) };
}

/** Two parents, each with a push device. */
async function family() {
  const first = await t.signInParent();
  const inv = await t.app.request('/v1/family/invites', jsonRequest('POST', {}, first.headers));
  const { code } = (await inv.json()) as { code: string };
  const second = await t.signInParent();
  await t.app.request('/v1/family/join', jsonRequest('POST', { code }, second.headers));
  for (const p of [first, second]) {
    const [row] = await t.db.select().from(parents).where(eq(parents.authUserId, p.userId));
    await t.db.insert(parentPushSubscriptions).values({
      parentId: row!.id,
      endpoint: `https://push.example.com/${row!.position}/${row!.id}`,
      p256dh: 'p',
      auth: 'a',
    });
  }
  const [row] = await t.db.select().from(parents).where(eq(parents.authUserId, first.userId));
  return { first, second, familyId: row!.familyId };
}

describe('telling the other parent about important changes', () => {
  it('pushes once to the other parent only, then the push text names the change', async () => {
    const { first, second, familyId } = await family();
    await t.db.update(familyEvents).set({ pushedAt: t.clock.now() }); // joining is old news here
    await t.app.request(
      '/v1/students',
      jsonRequest(
        'POST',
        { nickname: 'push_kid', avatarCode: AVATAR, yearGroup: 10 },
        second.headers,
      ),
    );
    const sender = fakeSender();
    const summary = await runFamilyEventNotifications({ db: t.db, now: t.clock.now(), sender });
    expect(summary).toEqual({ events: 1, pushes: 1, removed: 0 });
    expect(sender.sent.map((s) => s.endpoint)).toEqual([
      expect.stringContaining('push.example.com/1/'),
    ]);

    const again = await runFamilyEventNotifications({ db: t.db, now: t.clock.now(), sender });
    expect(again.events).toBe(0);

    const latest = await t.app.request('/v1/parent/notifications/latest', {
      headers: first.headers,
    });
    expect(await latest.json()).toEqual({ message: 'Parent 2 added push_kid' });
    // The parent who made the change is not told about it.
    const own = await t.app.request('/v1/parent/notifications/latest', { headers: second.headers });
    expect(await own.json()).toEqual({ message: null });
    void familyId;
  });

  it('does not push changes that are not important', async () => {
    const { familyId } = await family();
    await t.db.update(familyEvents).set({ pushedAt: t.clock.now() });
    await recordFamilyEvent(t.db, {
      familyId,
      actorPosition: 1,
      kind: 'reward_set',
      now: t.clock.now(),
    });
    const summary = await runFamilyEventNotifications({
      db: t.db,
      now: t.clock.now(),
      sender: fakeSender(),
    });
    expect(summary.events).toBe(0);
  });

  it('waits until morning during the nightly quiet hours', async () => {
    const { familyId } = await family();
    const night = new Date('2026-01-15T23:00:00Z');
    await recordFamilyEvent(t.db, {
      familyId,
      actorPosition: 2,
      kind: 'data_exported',
      now: night,
    });
    const summary = await runFamilyEventNotifications({
      db: t.db,
      now: night,
      sender: fakeSender(),
    });
    expect(summary.events).toBe(0);
  });

  it('removes push addresses the push service says are gone', async () => {
    const { familyId } = await family();
    await recordFamilyEvent(t.db, {
      familyId,
      actorPosition: 2,
      kind: 'data_exported',
      now: t.clock.now(),
    });
    const summary = await runFamilyEventNotifications({
      db: t.db,
      now: t.clock.now(),
      sender: fakeSender('gone'),
    });
    expect(summary.removed).toBeGreaterThan(0);
  });
});

describe('describing a change', () => {
  it('names the child when there is one, and never a parent', () => {
    expect(describeEvent('reward_given', 'nova')).toBe('gave nova a reward');
    expect(describeEvent('reward_given', null)).toBe('gave a child a reward');
    expect(describeEvent('something_new', null)).toBe('made a change');
  });
});
