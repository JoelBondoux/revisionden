import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { feedback } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { deleteExpiredFeedback } from './retention';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorEmails: ['operator@example.com'] } });
});

afterEach(async () => {
  await t.close();
});

const DEVICE = {
  appVersion: '00.01.002',
  route: '/cards',
  browserFamily: 'Safari',
  screenSize: '1024x768',
  online: true,
};

async function sendAsStudent(headers: Record<string, string>, body: unknown) {
  return t.app.request('/v1/student/feedback', jsonRequest('POST', body, headers));
}

async function sendAsParent(headers: Record<string, string>, body: unknown) {
  return t.app.request('/v1/feedback', jsonRequest('POST', body, headers));
}

describe('sending feedback', () => {
  it('a student can send a bug report with device details, and sees it with its status', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const res = await sendAsStudent(headers, {
      kind: 'bug',
      text: 'The card did not flip',
      device: DEVICE,
    });
    expect(res.status).toBe(201);
    const list = await t.app.request('/v1/student/feedback', { headers });
    const body = (await list.json()) as { feedback: unknown[] };
    expect(body.feedback).toEqual([
      expect.objectContaining({ kind: 'bug', text: 'The card did not flip', status: 'new' }),
    ]);
  });

  it('a parent can send an idea without any text or device details', async () => {
    const parent = await t.signInParent();
    const res = await sendAsParent(parent.headers, { kind: 'idea' });
    expect(res.status).toBe(201);
    const [row] = await t.db.select().from(feedback);
    expect(row).toMatchObject({ senderRole: 'parent', kind: 'idea', text: null, device: null });
  });

  it('refuses an unknown kind, text over 500 characters and unknown device fields', async () => {
    const parent = await t.signInParent();
    expect((await sendAsParent(parent.headers, { kind: 'rant' })).status).toBe(400);
    expect(
      (await sendAsParent(parent.headers, { kind: 'bug', text: 'a'.repeat(501) })).status,
    ).toBe(400);
    const withIp = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, ipAddress: '192.0.2.1' },
    });
    expect(withIp.status).toBe(400);
    expect(await t.db.select().from(feedback)).toHaveLength(0);
  });

  it("keeps the last problem's short code from a bug report, and refuses free text there", async () => {
    const parent = await t.signInParent();
    const ok = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, lastProblem: 'passkey:NotAllowedError:RD-7K2M9Q' },
    });
    expect(ok.status).toBe(201);
    const text = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, lastProblem: 'Sam pressed cancel' },
    });
    expect(text.status).toBe(400);
  });

  it('keeps the content id of the question or card on screen, and refuses text there (F16)', async () => {
    const parent = await t.signInParent();
    const ok = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, contentId: 'gcse-maths-h-n4-0001' },
    });
    expect(ok.status).toBe(201);
    const text = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, contentId: 'What is 2 + 2?' },
    });
    expect(text.status).toBe(400);
  });

  it('keeps how the screen looked, and refuses free text or odd values there (F16)', async () => {
    const parent = await t.signInParent();
    const display = {
      look: 'doodle-diary',
      theme: 'dark',
      palette: 'colourblind',
      pattern: 'off',
      readingFont: 'dyslexic',
      readingSize: 'large',
      readingSpacing: 'wide',
      readingTint: 'cream',
      pixelRatio: 2.63,
      zoom: 1.25,
      textScale: 1.25,
      reducedMotion: true,
    };
    const ok = await sendAsParent(parent.headers, {
      kind: 'bug',
      device: { ...DEVICE, ...display },
    });
    expect(ok.status).toBe(201);
    for (const bad of [{ look: 'Sam likes this' }, { zoom: 900 }, { theme: 'x'.repeat(41) }]) {
      const res = await sendAsParent(parent.headers, {
        kind: 'bug',
        device: { ...DEVICE, ...bad },
      });
      expect(res.status).toBe(400);
    }
  });

  it('needs a signed-in student or parent', async () => {
    expect((await sendAsStudent({}, { kind: 'bug' })).status).toBe(401);
    expect((await sendAsParent({}, { kind: 'bug' })).status).toBe(401);
  });
});

describe('personal details in feedback text', () => {
  const refusals = [
    ['an email address', 'Write to me at someone@example.com'],
    ['a phone number', 'Call 07700 900123 please'],
    ["the student's nickname", 'test_kid cannot see the map'],
  ];

  for (const [what, text] of refusals) {
    it(`refuses ${what} from a student, without echoing the text`, async () => {
      const { headers } = await t.familyStudent('test_kid');
      const res = await sendAsStudent(headers, { kind: 'bug', text });
      expect(res.status).toBe(400);
      const body = await res.text();
      expect(body).toContain('personal_details');
      expect(body).toContain('Please leave out personal details');
      expect(body).not.toContain(text);
      expect(await t.db.select().from(feedback)).toHaveLength(0);
    });
  }

  it("refuses a parent's text that names one of their children", async () => {
    const { parent } = await t.familyStudent('test_kid');
    const res = await sendAsParent(parent.headers, { kind: 'other', text: 'TEST_KID loves it' });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain('personal_details');
  });

  it('refuses an email address from a parent with no children yet', async () => {
    const parent = await t.signInParent();
    const res = await sendAsParent(parent.headers, { kind: 'other', text: 'me@example.com' });
    expect(res.status).toBe(400);
  });

  it('accepts ordinary text with numbers in it', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const res = await sendAsStudent(headers, {
      kind: 'confusing',
      text: 'Question 12 says 3x + 4',
    });
    expect(res.status).toBe(201);
  });
});

describe('daily limit', () => {
  it('lets a student send 5 a day, refuses the 6th, and allows more the next day', async () => {
    const { headers, studentId } = await t.familyStudent('test_kid');
    for (let i = 0; i < 5; i += 1) {
      expect((await sendAsStudent(headers, { kind: 'idea' })).status).toBe(201);
    }
    const sixth = await sendAsStudent(headers, { kind: 'idea' });
    expect(sixth.status).toBe(429);
    expect(await sixth.json()).toMatchObject({ error: { code: 'feedback_limit' } });
    t.clock.advance(24 * 60 * 60 * 1000);
    // The 12-hour device session has ended by then, so the student unlocks again.
    const unlocked = await t.signInStudent(studentId);
    expect((await sendAsStudent(unlocked, { kind: 'idea' })).status).toBe(201);
  });

  it('counts each account separately', async () => {
    const { headers, parent } = await t.familyStudent('test_kid');
    for (let i = 0; i < 5; i += 1) await sendAsStudent(headers, { kind: 'idea' });
    expect((await sendAsParent(parent.headers, { kind: 'idea' })).status).toBe(201);
    for (let i = 0; i < 4; i += 1) await sendAsParent(parent.headers, { kind: 'idea' });
    expect((await sendAsParent(parent.headers, { kind: 'idea' })).status).toBe(429);
  });
});

describe("a parent's view of feedback", () => {
  it("shows the family's feedback, newest first, with the student's nickname", async () => {
    const { headers, parent } = await t.familyStudent('test_kid');
    await sendAsStudent(headers, { kind: 'bug', text: 'first' });
    t.clock.advance(1000);
    await sendAsParent(parent.headers, { kind: 'idea', text: 'second' });
    const res = await t.app.request('/v1/feedback', { headers: parent.headers });
    const body = (await res.json()) as { feedback: Record<string, unknown>[] };
    expect(body.feedback.map((f) => f.text)).toEqual(['second', 'first']);
    expect(body.feedback[1]).toMatchObject({ senderRole: 'student', studentNickname: 'test_kid' });
    expect(body.feedback[0]).toMatchObject({ senderRole: 'parent', studentNickname: null });
  });

  it("never shows another family's feedback", async () => {
    const one = await t.familyStudent('test_kid');
    const other = await t.familyStudent('other_kid');
    await sendAsStudent(one.headers, { kind: 'bug', text: 'family one' });
    const res = await t.app.request('/v1/feedback', { headers: other.parent.headers });
    expect(((await res.json()) as { feedback: unknown[] }).feedback).toEqual([]);
  });

  it("a student sees only their own feedback, not their parent's", async () => {
    const { headers, parent } = await t.familyStudent('test_kid');
    await sendAsParent(parent.headers, { kind: 'idea', text: 'from the parent' });
    const res = await t.app.request('/v1/student/feedback', { headers });
    expect(((await res.json()) as { feedback: unknown[] }).feedback).toEqual([]);
  });
});

describe('operator triage', () => {
  async function signInOperator() {
    const op = await t.signInParent();
    const { authUsers } = await import('@revisionden/db');
    const { eq } = await import('drizzle-orm');
    await t.db
      .update(authUsers)
      .set({ email: 'OPERATOR@example.com' })
      .where(eq(authUsers.id, op.userId));
    return op;
  }

  it('is hidden (404) from parents without the operator role', async () => {
    const parent = await t.signInParent();
    expect((await t.app.request('/v1/admin/feedback', { headers: parent.headers })).status).toBe(
      404,
    );
    const patch = await t.app.request(
      '/v1/admin/feedback/00000000-0000-4000-8000-000000000000',
      jsonRequest('PATCH', { status: 'fixed' }, parent.headers),
    );
    expect(patch.status).toBe(404);
  });

  it('needs a signed-in parent', async () => {
    expect((await t.app.request('/v1/admin/feedback')).status).toBe(401);
  });

  it('lists every family’s feedback without family ids or emails', async () => {
    const { headers } = await t.familyStudent('test_kid');
    await sendAsStudent(headers, { kind: 'bug', text: 'broken', device: DEVICE });
    const op = await signInOperator();
    const res = await t.app.request('/v1/admin/feedback', { headers: op.headers });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain('familyId');
    expect(text).not.toContain('@example.com');
    expect(text).not.toContain('test_kid');
    const body = JSON.parse(text) as { feedback: Record<string, unknown>[] };
    expect(body.feedback).toEqual([
      expect.objectContaining({ kind: 'bug', text: 'broken', device: DEVICE, status: 'new' }),
    ]);
  });

  it('changes the status, which the sender then sees, and closes and reopens it', async () => {
    const { headers } = await t.familyStudent('test_kid');
    await sendAsStudent(headers, { kind: 'bug' });
    const op = await signInOperator();
    const [row] = await t.db.select().from(feedback);
    const patch = (status: string) =>
      t.app.request(`/v1/admin/feedback/${row!.id}`, jsonRequest('PATCH', { status }, op.headers));

    expect((await patch('fixed')).status).toBe(200);
    let [stored] = await t.db.select().from(feedback);
    expect(stored!.closedAt).toEqual(t.clock.now());
    const seen = await t.app.request('/v1/student/feedback', { headers });
    expect(await seen.json()).toMatchObject({ feedback: [{ status: 'fixed' }] });

    expect((await patch('looking_into_it')).status).toBe(200);
    [stored] = await t.db.select().from(feedback);
    expect(stored!.closedAt).toBeNull();

    expect((await patch('done')).status).toBe(400);
    const missing = await t.app.request(
      '/v1/admin/feedback/00000000-0000-4000-8000-000000000000',
      jsonRequest('PATCH', { status: 'fixed' }, op.headers),
    );
    expect(missing.status).toBe(404);
    const badId = await t.app.request(
      '/v1/admin/feedback/not-an-id',
      jsonRequest('PATCH', { status: 'fixed' }, op.headers),
    );
    expect(badId.status).toBe(404);
  });
});

describe('retention', () => {
  it('deletes feedback 12 months after it was closed, and keeps open feedback', async () => {
    const { headers } = await t.familyStudent('test_kid');
    await sendAsStudent(headers, { kind: 'bug', text: 'old and closed' });
    await sendAsStudent(headers, { kind: 'bug', text: 'still open' });
    await sendAsStudent(headers, { kind: 'bug', text: 'recently closed' });
    const rows = await t.db.select().from(feedback);
    const { eq } = await import('drizzle-orm');
    const byText = (text: string) => rows.find((r) => r.text === text)!.id;
    const now = new Date('2027-12-01T00:00:00Z');
    await t.db
      .update(feedback)
      .set({ status: 'fixed', closedAt: new Date('2026-11-30T00:00:00Z') })
      .where(eq(feedback.id, byText('old and closed')));
    await t.db
      .update(feedback)
      .set({ status: 'will_not_fix', closedAt: new Date('2027-06-01T00:00:00Z') })
      .where(eq(feedback.id, byText('recently closed')));

    expect(await deleteExpiredFeedback(t.db, now)).toBe(1);
    const left = (await t.db.select().from(feedback)).map((r) => r.text).sort();
    expect(left).toEqual(['recently closed', 'still open']);
  });
});
