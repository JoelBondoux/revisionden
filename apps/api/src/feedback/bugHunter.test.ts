import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authUsers, feedback } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { confirmedBugCount } from './bugHunter';

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

async function report(
  headers: Record<string, string>,
  kind = 'bug',
  path = '/v1/student/feedback',
) {
  const res = await t.app.request(path, jsonRequest('POST', { kind, text: 'It broke' }, headers));
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

async function confirm(op: Record<string, string>, id: string, body: object = {}) {
  return t.app.request(`/v1/admin/feedback/${id}/confirm`, jsonRequest('POST', body, op));
}

describe('confirming bug reports (Bug Hunter)', () => {
  it('gives the student +50 XP, a track step and a thank-you they see once', async () => {
    const { studentId, headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    const op = await operator();

    const res = await confirm(op, id);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { item: Record<string, unknown>; message: string };
    expect(body.message).toBe('Your bug report helped! +50 XP');
    expect(body.item).toMatchObject({ outcome: 'confirmed', rewardXp: 50, duplicateOf: null });
    expect(await confirmedBugCount(t.db, studentId)).toBe(1);

    const rewards = await t.app.request('/v1/student/feedback/rewards', { headers });
    const list = (await rewards.json()) as { rewards: { id: string; message: string }[] };
    expect(list.rewards).toEqual([
      expect.objectContaining({ id, outcome: 'confirmed', rewardXp: 50, message: body.message }),
    ]);
    const seen = await t.app.request(
      '/v1/student/feedback/rewards/seen',
      jsonRequest('POST', { ids: [id] }, headers),
    );
    expect(seen.status).toBe(204);
    const again = await t.app.request('/v1/student/feedback/rewards', { headers });
    expect(((await again.json()) as { rewards: unknown[] }).rewards).toEqual([]);

    const progress = await t.app.request('/v1/student/learn/progress', { headers });
    expect(((await progress.json()) as { totalXp: number }).totalXp).toBe(50);
  });

  it('gives +10 XP and no track step for a duplicate of an earlier confirmed bug', async () => {
    const first = await t.familyStudent('first_kid');
    const second = await t.familyStudent('second_kid');
    const a = await report(first.headers);
    const b = await report(second.headers);
    const op = await operator();
    await confirm(op, a);

    const res = await confirm(op, b, { duplicateOf: a });
    const body = (await res.json()) as { item: Record<string, unknown>; message: string };
    expect(body.message).toBe('Thanks for confirming that bug! +10 XP');
    expect(body.item).toMatchObject({ outcome: 'duplicate', rewardXp: 10, duplicateOf: a });
    expect(await confirmedBugCount(t.db, second.studentId)).toBe(0);
  });

  it('refuses a duplicate of a report that is not an earlier confirmed bug', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const a = await report(headers);
    const b = await report(headers);
    const op = await operator();
    const res = await confirm(op, a, { duplicateOf: b });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      'invalid_duplicate',
    );
  });

  it('allows at most 3 confirmed-bug rewards a week, then thanks without a reward', async () => {
    const { studentId, headers } = await t.familyStudent('test_kid');
    const ids = [
      await report(headers),
      await report(headers),
      await report(headers),
      await report(headers),
    ];
    const op = await operator();
    for (const id of ids.slice(0, 3)) expect((await confirm(op, id)).status).toBe(200);
    const fourth = (await (await confirm(op, ids[3]!)).json()) as {
      message: string;
      item: { rewardXp: number };
    };
    expect(fourth.item.rewardXp).toBe(0);
    expect(fourth.message).toBe('Your bug report helped! Thank you.');
    expect(await confirmedBugCount(t.db, studentId)).toBe(3);

    t.clock.advance(7 * 24 * 60 * 60 * 1000);
    const next = await report(await t.signInStudent(studentId));
    expect(
      ((await (await confirm(op, next)).json()) as { item: { rewardXp: number } }).item.rewardXp,
    ).toBe(50);
  });

  it('thanks a parent without any reward', async () => {
    const parent = await t.signInParent();
    const id = await report(parent.headers, 'bug', '/v1/feedback');
    const op = await operator();
    const body = (await (await confirm(op, id)).json()) as {
      message: string;
      item: { rewardXp: number };
    };
    expect(body).toMatchObject({
      message: 'Thank you for reporting this bug.',
      item: { rewardXp: 0 },
    });
    const [row] = await t.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row!.trackStep).toBe(false);
  });

  it('only confirms bug reports, once, and only for the operator', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const idea = await report(headers, 'idea');
    const bug = await report(headers);
    const op = await operator();
    expect(
      ((await (await confirm(op, idea)).json()) as { error: { code: string } }).error.code,
    ).toBe('not_a_bug');
    await confirm(op, bug);
    const twice = await confirm(op, bug);
    expect(twice.status).toBe(409);
    const parent = await t.signInParent();
    expect((await confirm(parent.headers, bug)).status).toBe(404);
  });

  it('shows the confirmed-bug count to the student and to their own parent only', async () => {
    const { studentId, headers, parent } = await t.familyStudent('test_kid');
    const op = await operator();
    await confirm(op, await report(headers));
    const own = await t.app.request('/v1/student/bug-hunter', { headers });
    expect(await own.json()).toEqual({ confirmedBugs: 1, rewardXp: 50 });
    const byParent = await t.app.request(`/v1/students/${studentId}/bug-hunter`, {
      headers: parent.headers,
    });
    expect(await byParent.json()).toEqual({ confirmedBugs: 1, rewardXp: 50 });
    const stranger = await t.signInParent();
    const other = await t.app.request(`/v1/students/${studentId}/bug-hunter`, {
      headers: stranger.headers,
    });
    expect(other.status).toBe(404);
  });

  it('lists outcome and reward on every feedback list', async () => {
    const { headers, parent } = await t.familyStudent('test_kid');
    const id = await report(headers);
    await confirm(await operator(), id);
    const mine = (await (await t.app.request('/v1/student/feedback', { headers })).json()) as {
      feedback: Record<string, unknown>[];
    };
    expect(mine.feedback[0]).toMatchObject({ outcome: 'confirmed', rewardXp: 50 });
    const family = (await (
      await t.app.request('/v1/feedback', { headers: parent.headers })
    ).json()) as {
      feedback: Record<string, unknown>[];
    };
    expect(family.feedback[0]).toMatchObject({ outcome: 'confirmed', rewardXp: 50 });
  });
});
