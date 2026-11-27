import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authUsers, feedback, students } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';

const DAY = 24 * 60 * 60 * 1000;
let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorEmails: ['operator@example.com'] } });
});

afterEach(async () => {
  await t.close();
});

async function operator() {
  const op = await t.signInParent();
  await t.db
    .update(authUsers)
    .set({ email: 'operator@example.com' })
    .where(eq(authUsers.id, op.userId));
  return op.headers;
}

const send = (headers: Record<string, string>, kind = 'bug') =>
  t.app.request('/v1/student/feedback', jsonRequest('POST', { kind, text: 'It broke' }, headers));

async function report(headers: Record<string, string>, kind = 'bug') {
  const res = await send(headers, kind);
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const notABug = (op: Record<string, string>, id: string) =>
  t.app.request(`/v1/admin/feedback/${id}/not-a-bug`, jsonRequest('POST', {}, op));

async function buttonState(headers: Record<string, string>) {
  const res = await t.app.request('/v1/student/bug-button', { headers });
  expect(res.status).toBe(200);
  return res.json();
}

/** A fresh device session (student sessions last 12 hours on the test clock). */
const kid = (studentId: string) => t.signInStudent(studentId);

/** Sends a bug report and has the operator mark it Not a bug, a day apart each time. */
async function strikes(studentId: string, op: Record<string, string>, n: number) {
  for (let i = 0; i < n; i++) {
    const id = await report(await kid(studentId));
    expect((await notABug(op, id)).status).toBe(200);
    t.clock.advance(DAY);
  }
}

describe('marking a bug report Not a bug (L13)', () => {
  it('closes the report as will not fix, with no reward and no thank-you', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    const op = await operator();

    const res = await notABug(op, id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      item: { id, outcome: 'not_a_bug', status: 'will_not_fix', rewardXp: 0 },
    });
    const [row] = await t.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row!.notABugAt).toEqual(t.clock.now());
    expect(row!.closedAt).toEqual(t.clock.now());

    const rewards = await t.app.request('/v1/student/feedback/rewards', { headers });
    expect(((await rewards.json()) as { rewards: unknown[] }).rewards).toEqual([]);
  });

  it('only applies to bug reports that have no outcome yet', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const idea = await report(headers, 'idea');
    const bug = await report(headers);
    const op = await operator();
    expect(await (await notABug(op, idea)).json()).toMatchObject({ error: { code: 'not_a_bug' } });
    expect((await notABug(op, bug)).status).toBe(200);
    const again = await notABug(op, bug);
    expect(again.status).toBe(409);
    const confirm = await t.app.request(
      `/v1/admin/feedback/${bug}/confirm`,
      jsonRequest('POST', {}, op),
    );
    expect(confirm.status).toBe(409);
  });

  it('is hidden from anyone who is not the operator', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    const parent = await t.signInParent();
    expect((await notABug(parent.headers, id)).status).toBe(404);
  });
});

describe('the bug button rest (L13)', () => {
  it('is on to begin with', async () => {
    const { headers } = await t.familyStudent('test_kid');
    expect(await buttonState(headers)).toEqual({ state: 'on' });
  });

  it('rests for 7 days after 3 Not-a-bug reports in 14 days, and refuses bug reports meanwhile', async () => {
    const { studentId } = await t.familyStudent('test_kid');
    const op = await operator();
    await strikes(studentId, op, 3);
    const headers = await kid(studentId);
    // The third was marked a day ago, so the rest ends in 6 days.
    const until = new Date(t.clock.now().getTime() + 6 * DAY).toISOString();
    expect(await buttonState(headers)).toEqual({ state: 'paused', until });

    const refused = await send(headers, 'bug');
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ error: { code: 'bug_button_resting' } });
    // Ideas and other feedback are never blocked.
    expect((await send(headers, 'idea')).status).toBe(201);

    t.clock.advance(6 * DAY);
    const later = await kid(studentId);
    expect(await buttonState(later)).toEqual({ state: 'on' });
    expect((await send(later, 'bug')).status).toBe(201);
  });

  it('is removed at the third rest within 90 days, and a parent can switch it back on', async () => {
    const { studentId, parent } = await t.familyStudent('test_kid');
    const op = await operator();
    await strikes(studentId, op, 3);
    t.clock.advance(7 * DAY);
    await strikes(studentId, op, 3);
    t.clock.advance(7 * DAY);
    await strikes(studentId, op, 3);
    const headers = await kid(studentId);
    expect(await buttonState(headers)).toEqual({ state: 'removed' });
    expect((await send(headers, 'bug')).status).toBe(403);

    const seen = await t.app.request(`/v1/students/${studentId}/bug-button`, {
      headers: parent.headers,
    });
    expect(await seen.json()).toEqual({ state: 'removed' });
    const on = await t.app.request(
      `/v1/students/${studentId}/bug-button/on`,
      jsonRequest('POST', {}, parent.headers),
    );
    expect(on.status).toBe(200);
    expect(await on.json()).toEqual({ state: 'on' });
    expect(await buttonState(headers)).toEqual({ state: 'on' });
  });

  it("does not let another family's parent see or change a child's bug button", async () => {
    const { studentId } = await t.familyStudent('test_kid');
    const other = await t.signInParent();
    const res = await t.app.request(`/v1/students/${studentId}/bug-button`, {
      headers: other.headers,
    });
    expect(res.status).toBe(404);
    const on = await t.app.request(
      `/v1/students/${studentId}/bug-button/on`,
      jsonRequest('POST', {}, other.headers),
    );
    expect(on.status).toBe(404);
  });
});

describe('tester accounts (L13)', () => {
  const makeTester = (studentId: string) =>
    t.db.update(students).set({ tester: true }).where(eq(students.id, studentId));

  it('confirms a tester report as normal, with no XP and no Bug Hunter step', async () => {
    const { studentId } = await t.familyStudent('test_kid');
    await makeTester(studentId);
    const id = await report(await kid(studentId));
    const op = await operator();
    const res = await t.app.request(
      `/v1/admin/feedback/${id}/confirm`,
      jsonRequest('POST', {}, op),
    );
    expect(await res.json()).toMatchObject({
      item: { outcome: 'confirmed', rewardXp: 0, tester: true },
      message: 'Thanks, tester! This bug is confirmed (tester accounts earn no rewards).',
    });
    const [row] = await t.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row!.trackStep).toBe(false);
  });

  it('never rests a tester bug button, however many reports are not bugs', async () => {
    const { studentId } = await t.familyStudent('test_kid');
    await makeTester(studentId);
    await strikes(studentId, await operator(), 3);
    const headers = await kid(studentId);
    expect(await buttonState(headers)).toEqual({ state: 'on' });
    expect((await send(headers, 'bug')).status).toBe(201);
  });

  it('shows the operator which reports came from a tester account', async () => {
    const tester = await t.familyStudent('test_kid');
    await makeTester(tester.studentId);
    const other = await t.familyStudent('other_kid');
    await report(await kid(tester.studentId));
    await report(await kid(other.studentId));
    const res = await t.app.request('/v1/admin/feedback', { headers: await operator() });
    const list = ((await res.json()) as { feedback: { tester: boolean }[] }).feedback;
    expect(list.map((f) => f.tester).sort()).toEqual([false, true]);
  });
});
