import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { devices, items, reviewerRoles, studentSessions } from '@revisionden/db';
import { syncContent } from './learning/content-sync';
import { STUDENT_COOKIE } from './routes/devices';
import { hashToken } from './tokens';
import { testItems, testTopicTree } from './test/learning-fixtures';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;
const content = { topicTrees: [testTopicTree], items: testItems };

beforeEach(async () => {
  t = await createTestContext();
  await syncContent(t.db, content);
});
afterEach(async () => {
  await t.close();
});

const statusOf = async (contentId: string) =>
  (await t.db.select({ status: items.status }).from(items).where(eq(items.contentId, contentId)))[0]
    ?.status;
const rowOf = async (contentId: string) =>
  (await t.db.select().from(items).where(eq(items.contentId, contentId)))[0]!;

async function student() {
  const parent = await t.signInParent();
  const res = await t.app.request(
    '/v1/students',
    jsonRequest(
      'POST',
      { nickname: 'quiz_fox', avatarCode: AVATAR, yearGroup: 10 },
      parent.headers,
    ),
  );
  const { id } = (await res.json()) as { id: string };
  const [device] = await t.db
    .insert(devices)
    .values({ studentId: id, credentialId: `cred-${id}`, publicKey: 'pk' })
    .returning();
  const token = `student-token-${id}`;
  await t.db.insert(studentSessions).values({
    tokenHash: await hashToken(token),
    studentId: id,
    deviceId: device!.id,
    expiresAt: new Date(t.clock.now().getTime() + 60 * 60 * 1000),
  });
  return { cookie: `${STUDENT_COOKIE}=${token}` };
}

async function reviewer() {
  const user = await t.signInParent();
  await t.db.insert(reviewerRoles).values({ authUserId: user.userId, role: 'content-lead' });
  return user.headers;
}

const report = async (
  headers: Record<string, string>,
  id: string,
  body: object = { reason: 'unclear' },
) => t.app.request(`/v1/student/items/${id}/reports`, jsonRequest('POST', body, headers));

describe('quarantine and the content gate', () => {
  it('a report sets the item status to quarantined, which the learning loop never serves', async () => {
    const headers = await student();
    expect(await statusOf('test-mc-0001')).toBe('verified');
    const res = await report(headers, 'test-mc-0001', { itemVersion: 1, reason: 'unclear' });
    expect(res.status).toBe(201);
    expect(await statusOf('test-mc-0001')).toBe('quarantined');
  });

  it('a student can report by the item id the app was given, and the version comes from the item', async () => {
    const headers = await student();
    const row = await rowOf('test-mc-0001');
    const res = await report(headers, row.id);
    expect(res.status).toBe(201);
    expect(await statusOf('test-mc-0001')).toBe('quarantined');
    const reviewerHeaders = await reviewer();
    const listed = (await (
      await t.app.request('/v1/review/reports', { headers: reviewerHeaders })
    ).json()) as {
      reports: { itemId: string; itemVersion: number }[];
    };
    expect(listed.reports[0]).toMatchObject({ itemId: 'test-mc-0001', itemVersion: 1 });
  });

  it('an unknown item id is not found', async () => {
    const headers = await student();
    const res = await report(headers, '00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('a content id needs a version when the item is not in the database', async () => {
    const headers = await student();
    expect((await report(headers, 'not-synced-item')).status).toBe(400);
    expect(
      (await report(headers, 'not-synced-item', { itemVersion: 1, reason: 'typo' })).status,
    ).toBe(201);
  });

  it('a content sync does not lift a quarantine', async () => {
    const headers = await student();
    await report(headers, 'test-mc-0001', { itemVersion: 1, reason: 'unclear' });
    await syncContent(t.db, content);
    expect(await statusOf('test-mc-0001')).toBe('quarantined');
  });

  it('no error puts back the status the item had', async () => {
    const headers = await student();
    const { reportId } = (await (
      await report(headers, 'test-mc-0001', { itemVersion: 1, reason: 'unclear' })
    ).json()) as {
      reportId: string;
    };
    await t.app.request(
      `/v1/review/reports/${reportId}/decision`,
      jsonRequest('POST', { decision: 'no_error' }, await reviewer()),
    );
    expect(await statusOf('test-mc-0001')).toBe('verified');
  });

  it('after a confirmed error, a sync with a newer version of the item lifts the quarantine', async () => {
    const headers = await student();
    const { reportId } = (await (
      await report(headers, 'test-mc-0001', { itemVersion: 1, reason: 'wrong_answer' })
    ).json()) as {
      reportId: string;
    };
    await t.app.request(
      `/v1/review/reports/${reportId}/decision`,
      jsonRequest('POST', { decision: 'confirmed_error', notes: 'Fixture note' }, await reviewer()),
    );
    await syncContent(t.db, content);
    expect(await statusOf('test-mc-0001')).toBe('quarantined');
    const fixed = testItems.map((i) =>
      i.id === 'test-mc-0001' ? { ...i, verification: { ...i.verification, version: 2 } } : i,
    );
    await syncContent(t.db, { topicTrees: [testTopicTree], items: fixed });
    expect(await statusOf('test-mc-0001')).toBe('verified');
  });
});
