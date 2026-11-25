import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authAccounts, authUsers, feedback, flashcards, topics } from '@revisionden/db';
import { eq } from 'drizzle-orm';
import { AVATAR, createTestContext, jsonRequest, type TestContext } from './test/helpers';

let t: TestContext;

beforeAll(async () => {
  t = await createTestContext();
  await t.db
    .insert(topics)
    .values({ id: 'export-topic', subjectId: 'gcse-maths', board: 'AQA', title: 'Export topic' });
});

afterAll(async () => {
  await t.close();
});

async function addStudent(headers: Record<string, string>, nickname: string) {
  const res = await t.app.request(
    '/v1/students',
    jsonRequest('POST', { nickname, avatarCode: AVATAR, yearGroup: 10 }, headers),
  );
  return ((await res.json()) as { id: string }).id;
}

describe('family data export', () => {
  it('needs a signed-in parent', async () => {
    expect((await t.app.request('/v1/export')).status).toBe(401);
  });

  it("downloads the parent's account and their own children's data as a JSON file", async () => {
    const mine = await t.signInParent();
    const otherFamily = await t.signInParent();
    const myKid = await addStudent(mine.headers, 'export_kid');
    const otherKid = await addStudent(otherFamily.headers, 'other_kid');
    for (const studentId of [myKid, otherKid]) {
      await t.db.insert(flashcards).values({
        studentId,
        topicId: 'export-topic',
        origin: 'own',
        front: `front for ${studentId}`,
        back: 'back',
      });
    }
    await t.db.insert(authAccounts).values({
      id: 'export-acct',
      accountId: 'provider-id-1',
      providerId: 'google',
      userId: mine.userId,
    });

    const res = await t.app.request('/v1/export', { headers: mine.headers });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(res.headers.get('content-disposition')).toBe(
      'attachment; filename="revisionden-family-data-2026-11-24.json"',
    );
    expect(res.headers.get('cache-control')).toBe('no-store');
    const text = await res.text();
    const data = JSON.parse(text) as {
      exportedAt: string;
      parent: { email: string; signIns: { providerId: string; accountId: string }[] };
      students: { profile: { id: string; nickname: string }; flashcards: { front: string }[] }[];
    };

    expect(data.exportedAt).toBe('2026-11-24T10:00:00.000Z');
    expect(data.parent.email).toMatch(/@example\.com$/);
    expect(data.parent.signIns).toEqual([
      expect.objectContaining({ providerId: 'google', accountId: 'provider-id-1' }),
    ]);
    expect(data.students.map((s) => s.profile.nickname)).toEqual(['export_kid']);
    expect(data.students[0]!.flashcards.map((f) => f.front)).toEqual([`front for ${myKid}`]);
    // Nothing from the other family.
    expect(text).not.toContain(otherKid);
    expect(text).not.toContain('other_kid');
  });

  it('leaves out secrets: session tokens, hashes and passkey keys', async () => {
    const { parent } = await t.familyStudent('secret_kid');
    const res = await t.app.request('/v1/export', { headers: parent.headers });
    const text = await res.text();
    for (const secret of [
      'tokenHash',
      'token_hash',
      'publicKey',
      'credentialId',
      'p256dh',
      'accessToken',
      'idToken',
      'refreshToken',
      'password',
    ]) {
      expect(text).not.toContain(secret);
    }
    const data = JSON.parse(text) as { students: { devices: { linkedAt: string }[] }[] };
    expect(data.students[0]!.devices).toHaveLength(1);
    expect(data.students[0]!.devices[0]!.linkedAt).toEqual(expect.any(String));
  });

  it("includes the family's feedback but not another parent's sign-in", async () => {
    const { parent, studentId } = await t.familyStudent('fb_kid');
    const [user] = await t.db.select().from(authUsers).where(eq(authUsers.id, parent.userId));
    const me = (await (await t.app.request('/v1/me', { headers: parent.headers })).json()) as {
      familyId: string;
    };
    await t.db.insert(feedback).values({
      familyId: me.familyId,
      senderRole: 'student',
      studentId,
      kind: 'idea',
      text: 'more cards please',
    });
    const res = await t.app.request('/v1/export', { headers: parent.headers });
    const data = (await res.json()) as {
      parent: { email: string };
      feedback: { text: string; senderRole: string }[];
    };
    expect(data.parent.email).toBe(user!.email);
    expect(data.feedback).toEqual([
      expect.objectContaining({ text: 'more cards please', senderRole: 'student' }),
    ]);
  });
});
