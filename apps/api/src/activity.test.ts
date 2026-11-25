import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { families } from '@revisionden/db';
import { createTestContext, type TestContext } from './test/helpers';

let t: TestContext;
const HOUR = 60 * 60 * 1000;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

async function familyIdFor(headers: Record<string, string>) {
  const me = await t.app.request('/v1/me', { headers });
  return ((await me.json()) as { familyId: string }).familyId;
}

async function setLastActive(familyId: string, lastActiveAt: Date) {
  await t.db
    .update(families)
    .set({ lastActiveAt, previousActiveAt: null })
    .where(eq(families.id, familyId));
}

async function lastActive(familyId: string) {
  const [row] = await t.db.select().from(families).where(eq(families.id, familyId));
  return row!;
}

interface Activity {
  lastUsedAt: string;
  deletedIfUnusedAfter: string;
  warning: { unusedSince: string; wouldHaveBeenDeletedOn: string } | null;
}

async function activity(headers: Record<string, string>): Promise<Activity> {
  const res = await t.app.request('/v1/family/activity', { headers });
  expect(res.status).toBe(200);
  return (await res.json()) as Activity;
}

describe('account activity and the inactive-account warning', () => {
  it('needs a signed-in parent', async () => {
    expect((await t.app.request('/v1/family/activity')).status).toBe(401);
  });

  it('records parent use and says when an unused account would be deleted', async () => {
    const { headers } = await t.signInParent();
    const familyId = await familyIdFor(headers);
    await setLastActive(familyId, new Date('2026-09-01T00:00:00Z'));
    const result = await activity(headers);
    expect(result).toEqual({
      lastUsedAt: '2026-11-24T10:00:00.000Z',
      deletedIfUnusedAfter: '2027-11-24T10:00:00.000Z',
      warning: null,
    });
  });

  it('warns a parent who comes back after 11 months or more without use', async () => {
    const { headers } = await t.signInParent();
    const familyId = await familyIdFor(headers);
    await setLastActive(familyId, new Date('2025-12-20T00:00:00Z'));
    const result = await activity(headers);
    expect(result.warning).toEqual({
      unusedSince: '2025-12-20T00:00:00.000Z',
      wouldHaveBeenDeletedOn: '2026-12-20T00:00:00.000Z',
    });
    expect(result.lastUsedAt).toBe('2026-11-24T10:00:00.000Z');
  });

  it('does not warn after a gap of just under 11 months', async () => {
    const { headers } = await t.signInParent();
    const familyId = await familyIdFor(headers);
    await setLastActive(familyId, new Date('2025-12-24T10:00:01Z'));
    expect((await activity(headers)).warning).toBeNull();
  });

  it('records student use for the family', async () => {
    const { studentId, parent, headers } = await t.familyStudent('active_kid');
    void studentId;
    const familyId = await familyIdFor(parent.headers);
    await setLastActive(familyId, new Date('2026-01-01T00:00:00Z'));
    expect((await t.app.request('/v1/student/me', { headers })).status).toBe(200);
    expect((await lastActive(familyId)).lastActiveAt).toEqual(t.clock.now());
  });

  it('writes at most once an hour', async () => {
    const { headers } = await t.signInParent();
    const familyId = await familyIdFor(headers);
    await setLastActive(familyId, new Date(t.clock.now().getTime() - 2 * HOUR));
    await t.app.request('/v1/me', { headers });
    const first = (await lastActive(familyId)).lastActiveAt;
    expect(first).toEqual(t.clock.now());
    t.clock.advance(30 * 60 * 1000);
    await t.app.request('/v1/me', { headers });
    expect((await lastActive(familyId)).lastActiveAt).toEqual(first);
  });
});
