import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authUsers, families, parentInvites } from '@revisionden/db';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

type H = Record<string, string>;
let t: TestContext;
const DAY = 24 * 60 * 60 * 1000;

beforeAll(async () => {
  t = await createTestContext();
});

afterAll(async () => {
  await t.close();
});

const post = (path: string, body: unknown, headers: H) =>
  t.app.request(path, jsonRequest('POST', body, headers));

async function invite(headers: H) {
  const res = await post('/v1/family/invites', {}, headers);
  expect(res.status).toBe(201);
  return (await res.json()) as { code: string; link: string; expiresAt: string };
}

async function familyId(headers: H) {
  const res = await t.app.request('/v1/me', { headers });
  return ((await res.json()) as { familyId: string }).familyId;
}

/** A family with Parent 1 (with one child) and Parent 2 joined by invite. */
async function twoParentFamily(nickname = 'shared_kid') {
  const first = await t.signInParent();
  const kid = await post(
    '/v1/students',
    { nickname, avatarCode: AVATAR, yearGroup: 10 },
    first.headers,
  );
  const studentId = ((await kid.json()) as { id: string }).id;
  const { code } = await invite(first.headers);
  const second = await t.signInParent();
  const joined = await post('/v1/family/join', { code }, second.headers);
  expect(joined.status).toBe(200);
  return { first, second, studentId, familyId: await familyId(first.headers) };
}

describe('inviting a second parent', () => {
  it('needs a signed-in parent', async () => {
    expect((await t.app.request('/v1/family/invites', { method: 'POST' })).status).toBe(401);
  });

  it('gives a one-time code and link valid for 7 days, stored only as a hash', async () => {
    const { headers } = await t.signInParent();
    const res = await invite(headers);
    expect(res.code).toMatch(/^[A-HJ-NP-Z2-9]{12}$/);
    expect(res.link).toBe(`https://dev.revisionden.test/join?code=${res.code}`);
    expect(new Date(res.expiresAt).getTime() - t.clock.now().getTime()).toBe(7 * DAY);
    const rows = await t.db.select().from(parentInvites);
    expect(JSON.stringify(rows)).not.toContain(res.code);
  });

  it('allows at most 5 invites a day per family', async () => {
    const { headers } = await t.signInParent();
    for (let i = 0; i < 5; i += 1) await invite(headers);
    const res = await post('/v1/family/invites', {}, headers);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: 'invite_limit' } });
  });

  it('lets the second parent join with the code; they become Parent 2', async () => {
    const { first, second, familyId: fam } = await twoParentFamily();
    expect(await familyId(second.headers)).toBe(fam);
    const res = await t.app.request('/v1/family/parents', { headers: second.headers });
    expect(await res.json()).toMatchObject({
      parents: [
        { position: 1, you: false },
        { position: 2, you: true },
      ],
      canInvite: false,
      deletionRequest: null,
    });
    // The first parent sees the same, from their side.
    const mine = await t.app.request('/v1/family/parents', { headers: first.headers });
    expect(await mine.json()).toMatchObject({ parents: [{ you: true }, { you: false }] });
  });

  it('keeps only the second parent’s sign-in email, no other profile', async () => {
    const { second } = await twoParentFamily('email_kid');
    const [user] = await t.db.select().from(authUsers).where(eq(authUsers.id, second.userId));
    expect(user).toMatchObject({ name: '', image: null });
  });

  it('uses a code only once', async () => {
    const first = await t.signInParent();
    const { code } = await invite(first.headers);
    const a = await t.signInParent();
    expect((await post('/v1/family/join', { code }, a.headers)).status).toBe(200);
    const b = await t.signInParent();
    const again = await post('/v1/family/join', { code }, b.headers);
    expect(again.status).toBe(404);
    expect(await again.json()).toMatchObject({ error: { code: 'invite_not_found' } });
  });

  it('refuses an expired code', async () => {
    const first = await t.signInParent();
    const { code } = await invite(first.headers);
    t.clock.advance(7 * DAY + 1);
    const late = await t.signInParent();
    expect((await post('/v1/family/join', { code }, late.headers)).status).toBe(404);
  });

  it('refuses a third parent', async () => {
    const { first } = await twoParentFamily('full_kid');
    const res = await post('/v1/family/invites', {}, first.headers);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'family_full' } });
  });

  it('refuses to join while the joining parent already has children of their own', async () => {
    const first = await t.signInParent();
    const { code } = await invite(first.headers);
    const other = await t.signInParent();
    await post(
      '/v1/students',
      { nickname: 'own_kid', avatarCode: AVATAR, yearGroup: 9 },
      other.headers,
    );
    const res = await post('/v1/family/join', { code }, other.headers);
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'already_in_family' } });
  });

  it('refuses a parent’s own code', async () => {
    const first = await t.signInParent();
    const { code } = await invite(first.headers);
    expect((await post('/v1/family/join', { code }, first.headers)).status).toBe(409);
  });
});

describe('both parents have equal control', () => {
  it('lets Parent 2 use every parent route for the family', async () => {
    const { second, studentId } = await twoParentFamily('equal_kid');
    const h = second.headers;
    const id = studentId;
    const reads = [
      '/v1/me',
      '/v1/students',
      `/v1/students/${id}`,
      `/v1/students/${id}/enrolments`,
      `/v1/students/${id}/devices`,
      `/v1/students/${id}/avatar`,
      `/v1/students/${id}/rewards`,
      `/v1/students/${id}/parent-rewards`,
      `/v1/students/${id}/reminder-settings`,
      `/v1/students/${id}/ai-usage`,
      `/v1/students/${id}/stats?period=week`,
      `/v1/students/${id}/dashboard`,
      '/v1/onboarding/family',
      '/v1/feedback',
      '/v1/policy-acceptances',
      '/v1/family/activity',
      '/v1/family/events',
      '/v1/export',
      '/v1/parent/notifications/latest',
    ];
    for (const path of reads) {
      const res = await t.app.request(path, { headers: h });
      expect({ path, status: res.status }).toEqual({ path, status: 200 });
    }
    const export_ = await t.app.request('/v1/export', { headers: h });
    expect(await export_.text()).toContain('equal_kid');

    const writes: [string, string, unknown, number][] = [
      ['PATCH', `/v1/students/${id}`, { yearGroup: 11 }, 200],
      ['POST', `/v1/students/${id}/link-tokens`, {}, 201],
      ['PUT', `/v1/students/${id}/reminder-settings`, { streakReminders: false }, 200],
      [
        'POST',
        `/v1/students/${id}/parent-rewards`,
        { title: 'Cinema trip', target: { kind: 'stat', stat: 'level', atLeast: 2 } },
        201,
      ],
      ['POST', '/v1/feedback', { kind: 'idea', text: 'two parents is great' }, 201],
      [
        'PUT',
        '/v1/policy-acceptances',
        { acceptances: [{ policy: 'terms-of-use', version: '1.0' }] },
        200,
      ],
      ['POST', '/v1/students', { nickname: 'second_kid', avatarCode: AVATAR, yearGroup: 12 }, 201],
    ];
    for (const [method, path, body, status] of writes) {
      const res = await t.app.request(path, jsonRequest(method, body, h));
      expect({ path, status: res.status }).toEqual({ path, status });
    }
  });

  it('still keeps families apart: Parent 2 cannot see another family', async () => {
    const { second } = await twoParentFamily('apart_kid');
    const stranger = await t.signInParent();
    const theirs = await post(
      '/v1/students',
      { nickname: 'stranger_kid', avatarCode: AVATAR, yearGroup: 10 },
      stranger.headers,
    );
    const { id } = (await theirs.json()) as { id: string };
    expect((await t.app.request(`/v1/students/${id}`, { headers: second.headers })).status).toBe(
      404,
    );
  });
});

describe('removing the other parent', () => {
  it('ends their access at once and shows them a notice next time', async () => {
    const { first, second } = await twoParentFamily('remove_kid');
    const res = await t.app.request('/v1/family/parents/2', {
      method: 'DELETE',
      headers: first.headers,
    });
    expect(res.status).toBe(204);

    const blocked = await t.app.request('/v1/students', { headers: second.headers });
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ error: { code: 'removed_from_family' } });

    const notice = await t.app.request('/v1/removal-notice', { headers: second.headers });
    expect(await notice.json()).toMatchObject({ removed: true });
    const seen = await post('/v1/removal-notice/seen', {}, second.headers);
    expect(seen.status).toBe(204);
    // After the notice, they start again with an empty family of their own.
    const fresh = await t.app.request('/v1/students', { headers: second.headers });
    expect(await fresh.json()).toEqual({ students: [] });

    const parents = await t.app.request('/v1/family/parents', { headers: first.headers });
    expect(await parents.json()).toMatchObject({
      parents: [{ position: 1, you: true }],
      canInvite: true,
    });
  });

  it('lets Parent 2 remove Parent 1 too, but nobody removes themselves', async () => {
    const { first, second } = await twoParentFamily('remove_first_kid');
    const self = await t.app.request('/v1/family/parents/2', {
      method: 'DELETE',
      headers: second.headers,
    });
    expect(self.status).toBe(400);
    const res = await t.app.request('/v1/family/parents/1', {
      method: 'DELETE',
      headers: second.headers,
    });
    expect(res.status).toBe(204);
    expect((await t.app.request('/v1/me', { headers: first.headers })).status).toBe(403);
  });

  it('says when there is no such parent', async () => {
    const { headers } = await t.signInParent();
    const res = await t.app.request('/v1/family/parents/2', { method: 'DELETE', headers });
    expect(res.status).toBe(404);
  });
});

describe('deleting the whole family', () => {
  it('deletes at once when there is only one parent', async () => {
    const first = await t.signInParent();
    const fam = await familyId(first.headers);
    const res = await post('/v1/family/deletion', {}, first.headers);
    expect(await res.json()).toEqual({ deleted: true });
    expect(await t.db.select().from(families).where(eq(families.id, fam))).toEqual([]);
    expect(await t.db.select().from(authUsers).where(eq(authUsers.id, first.userId))).toEqual([]);
  });

  it('needs both parents to confirm when there are two', async () => {
    const { first, second, familyId: fam } = await twoParentFamily('delete_kid');
    const asked = await post('/v1/family/deletion', {}, first.headers);
    expect(asked.status).toBe(202);
    expect(await asked.json()).toEqual({ deleted: false, waitingFor: 'Parent 2' });
    // Asking again from the same parent changes nothing.
    expect((await post('/v1/family/deletion', {}, first.headers)).status).toBe(202);
    expect(await t.db.select().from(families).where(eq(families.id, fam))).toHaveLength(1);

    const parents = await t.app.request('/v1/family/parents', { headers: second.headers });
    expect(await parents.json()).toMatchObject({ deletionRequest: { by: 'Parent 1' } });

    const confirmed = await post('/v1/family/deletion', {}, second.headers);
    expect(await confirmed.json()).toEqual({ deleted: true });
    expect(await t.db.select().from(families).where(eq(families.id, fam))).toEqual([]);
    for (const id of [first.userId, second.userId]) {
      expect(await t.db.select().from(authUsers).where(eq(authUsers.id, id))).toEqual([]);
    }
  });

  it('can be cancelled by either parent', async () => {
    const { first, second, familyId: fam } = await twoParentFamily('cancel_kid');
    await post('/v1/family/deletion', {}, first.headers);
    const res = await t.app.request('/v1/family/deletion', {
      method: 'DELETE',
      headers: second.headers,
    });
    expect(res.status).toBe(204);
    const [row] = await t.db.select().from(families).where(eq(families.id, fam));
    expect(row!.deletionRequestedBy).toBeNull();
  });

  it('lets one parent delete after the other is removed', async () => {
    const { first } = await twoParentFamily('after_remove_kid');
    await post('/v1/family/deletion', {}, first.headers);
    await t.app.request('/v1/family/parents/2', { method: 'DELETE', headers: first.headers });
    const res = await post('/v1/family/deletion', {}, first.headers);
    expect(await res.json()).toEqual({ deleted: true });
  });
});

interface Events {
  events: { kind: string; by: string | null; you: boolean; what: string; important: boolean }[];
  newFromOtherParent: number;
}

describe('family activity log', () => {
  it('records who changed what as Parent 1 or Parent 2, without names', async () => {
    const { first, second, studentId } = await twoParentFamily('log_kid');
    await post(
      `/v1/students/${studentId}/parent-rewards`,
      { title: 'Pizza night', target: { kind: 'stat', stat: 'level', atLeast: 3 } },
      second.headers,
    );
    await t.app.request(`/v1/students/${studentId}`, { method: 'DELETE', headers: second.headers });
    const res = await t.app.request('/v1/family/events', { headers: first.headers });
    const body = (await res.json()) as Events;
    const kinds = body.events.map((e) => `${e.by}:${e.kind}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        'Parent 1:parent_invited',
        'Parent 2:parent_joined',
        'Parent 2:child_removed',
      ]),
    );
    // The reward Parent 2 set for the child went with the child.
    expect(kinds).not.toContain('Parent 2:reward_set');
    const removed = body.events.find((e) => e.kind === 'child_removed')!;
    expect(removed).toMatchObject({ what: 'removed a child', important: true, you: false });
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/@example\.com/);
    // The removed child's earlier rows go with the child, so the log no longer names them.
    expect(text).not.toContain('log_kid');
  });

  it('counts important changes by the other parent until they are seen', async () => {
    const { first, second } = await twoParentFamily('seen_kid');
    await post(
      '/v1/students',
      { nickname: 'new_kid', avatarCode: AVATAR, yearGroup: 9 },
      second.headers,
    );
    const before = (await (
      await t.app.request('/v1/family/events', { headers: first.headers })
    ).json()) as Events;
    expect(before.newFromOtherParent).toBe(2); // joined, added a child
    expect(before.events[0]).toMatchObject({
      kind: 'child_added',
      what: 'added new_kid',
      by: 'Parent 2',
    });
    expect((await post('/v1/family/events/seen', {}, first.headers)).status).toBe(204);
    const after = (await (
      await t.app.request('/v1/family/events', { headers: first.headers })
    ).json()) as Events;
    expect(after.newFromOtherParent).toBe(0);
    // Your own changes never count as new for you.
    const mine = (await (
      await t.app.request('/v1/family/events', { headers: second.headers })
    ).json()) as Events;
    // Parent 1's invite came before Parent 2 joined, so it is not new for them.
    expect(mine.newFromOtherParent).toBe(0);
  });

  it('logs an export as important', async () => {
    const { first, second } = await twoParentFamily('export_log_kid');
    await t.app.request('/v1/export', { headers: second.headers });
    const body = (await (
      await t.app.request('/v1/family/events', { headers: first.headers })
    ).json()) as Events;
    expect(body.events[0]).toMatchObject({
      kind: 'data_exported',
      by: 'Parent 2',
      important: true,
    });
  });
});
