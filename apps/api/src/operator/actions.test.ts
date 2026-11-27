import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  OperatorFamilyDetailSchema,
  OperatorTicketDetailSchema,
  OperatorTicketListSchema,
} from '@revisionden/core';
import { feedback, operatorAuditLog, parents } from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
});
afterEach(async () => {
  await t.close();
});

async function call(
  method: string,
  path: string,
  body?: unknown,
  extra: { role?: string; requestId?: string } = {},
) {
  const res = await t.app.request(
    ...(await signedOperatorRequest({
      clock: t.clock,
      method,
      path: `/operator/appdeck${path}`,
      body,
      ...extra,
    })),
  );
  const json = (await res.json()) as {
    success?: boolean;
    data?: unknown;
    error?: { code: string };
  };
  return { status: res.status, data: json.data, code: json.error?.code };
}
const post = (path: string, body: unknown = {}, extra = {}) => call('POST', path, body, extra);
const get = (path: string) => call('GET', path);

async function makeFamily() {
  const { studentId, parent, headers } = await t.familyStudent('test_kid');
  const [row] = await t.db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, parent.userId));
  return { familyId: row!.familyId, studentId, parent, studentHeaders: headers };
}

async function ticket(
  f: Awaited<ReturnType<typeof makeFamily>>,
  values: Partial<typeof feedback.$inferInsert> = {},
) {
  const [row] = await t.db
    .insert(feedback)
    .values({
      familyId: f.familyId,
      senderRole: 'parent',
      senderAuthUserId: f.parent.userId,
      kind: 'bug',
      text: 'The map does not load',
      ...values,
    })
    .returning();
  return row!;
}

const audits = () => t.db.select().from(operatorAuditLog);

describe('operator notes on a family', () => {
  it('lets an Agent add an internal note, shown on the family and audited', async () => {
    const f = await makeFamily();
    const res = await post(`/families/${f.familyId}/notes`, { text: 'Called about sign-in' });
    expect(res).toMatchObject({ status: 200, data: { ok: true } });

    const family = OperatorFamilyDetailSchema.parse((await get(`/families/${f.familyId}`)).data);
    expect(family.notes).toEqual([
      {
        id: expect.any(String),
        text: 'Called about sign-in',
        author: 'agent@example.com',
        createdAt: t.clock.now().toISOString(),
      },
    ]);
    expect(await audits()).toContainEqual(
      expect.objectContaining({ action: 'note.add', targetType: 'family', targetId: f.familyId }),
    );
  });

  it('refuses an empty or too long note, and an unknown family', async () => {
    const f = await makeFamily();
    expect((await post(`/families/${f.familyId}/notes`, { text: '' })).status).toBe(400);
    expect((await post(`/families/${f.familyId}/notes`, { text: 'x'.repeat(2001) })).status).toBe(
      400,
    );
    expect((await post(`/families/${crypto.randomUUID()}/notes`, { text: 'Hi' })).status).toBe(404);
  });
});

describe('operator ticket replies', () => {
  it("shows a reply in AppDeck and in the family's app, without the operator's email", async () => {
    const f = await makeFamily();
    const row = await ticket(f);
    expect(
      (await post(`/tickets/${row.id}/reply`, { text: 'Fixed in the next update' })).data,
    ).toEqual({ ok: true });

    const detail = OperatorTicketDetailSchema.parse((await get(`/tickets/${row.id}`)).data);
    expect(detail.messages).toEqual([
      {
        id: row.id,
        from: 'family',
        body: 'The map does not load',
        createdAt: row.createdAt.toISOString(),
      },
      {
        id: expect.any(String),
        from: 'operator',
        body: 'Fixed in the next update',
        createdAt: expect.any(String),
      },
    ]);

    const parentView = await t.app.request('/v1/feedback', { headers: f.parent.headers });
    const body = (await parentView.json()) as { feedback: { id: string; replies: unknown[] }[] };
    expect(body.feedback.find((x) => x.id === row.id)!.replies).toEqual([
      { body: 'Fixed in the next update', createdAt: expect.any(String) },
    ]);
    expect(JSON.stringify(body)).not.toContain('agent@example.com');
    expect(await audits()).toContainEqual(
      expect.objectContaining({
        action: 'ticket.reply',
        targetType: 'family',
        targetId: f.familyId,
      }),
    );
  });

  it("shows a reply to a student's ticket on the student's device, and never sends AppDeck the child's text", async () => {
    const f = await makeFamily();
    const row = await ticket(f, {
      senderRole: 'student',
      senderAuthUserId: null,
      studentId: f.studentId,
      text: 'words a child typed',
    });
    await post(`/tickets/${row.id}/reply`, { text: 'Thanks, we are on it' });

    const detail = OperatorTicketDetailSchema.parse((await get(`/tickets/${row.id}`)).data);
    expect(detail.messages.map((m) => m.from)).toEqual(['operator']);
    expect(JSON.stringify(detail)).not.toContain('words a child typed');

    const studentView = await t.app.request('/v1/student/feedback', { headers: f.studentHeaders });
    const body = (await studentView.json()) as { feedback: { replies: { body: string }[] }[] };
    expect(body.feedback[0]!.replies.map((r) => r.body)).toEqual(['Thanks, we are on it']);
  });

  it('refuses an empty reply and an unknown ticket', async () => {
    const f = await makeFamily();
    const row = await ticket(f);
    expect((await post(`/tickets/${row.id}/reply`, { text: '' })).status).toBe(400);
    expect((await post(`/tickets/${crypto.randomUUID()}/reply`, { text: 'Hi' })).status).toBe(404);
  });
});

describe('operator ticket status, confirm bug and duplicate', () => {
  it('changes a ticket status and closes it when fixed', async () => {
    const f = await makeFamily();
    const row = await ticket(f);
    expect((await post(`/tickets/${row.id}/status`, { status: 'fixed' })).data).toEqual({
      ok: true,
    });
    const [saved] = await t.db.select().from(feedback).where(eq(feedback.id, row.id));
    expect(saved).toMatchObject({ status: 'fixed', closedAt: t.clock.now() });
    expect((await post(`/tickets/${row.id}/status`, { status: 'lost' })).status).toBe(400);
    expect(await audits()).toContainEqual(expect.objectContaining({ action: 'ticket.status' }));
  });

  it("confirms a student's bug, rewarding them with Bug Hunter XP, once", async () => {
    const f = await makeFamily();
    const row = await ticket(f, {
      senderRole: 'student',
      senderAuthUserId: null,
      studentId: f.studentId,
    });
    expect((await post(`/tickets/${row.id}/confirm-bug`)).data).toEqual({ ok: true });

    const [saved] = await t.db.select().from(feedback).where(eq(feedback.id, row.id));
    expect(saved!.outcome).toBe('confirmed');
    expect(saved!.rewardXp).toBeGreaterThan(0);
    const list = OperatorTicketListSchema.parse((await get('/tickets')).data);
    expect(list.tickets[0]).toMatchObject({ confirmedBug: true, duplicateOf: null });

    const again = await post(`/tickets/${row.id}/confirm-bug`);
    expect(again).toMatchObject({ status: 409, code: 'already_confirmed' });
    expect(await audits()).toContainEqual(
      expect.objectContaining({ action: 'ticket.confirm_bug' }),
    );
  });

  it('runs a confirm once when AppDeck retries it with the same request id', async () => {
    const f = await makeFamily();
    const row = await ticket(f);
    const first = await post(`/tickets/${row.id}/confirm-bug`, {}, { requestId: 'confirm-0001' });
    const retry = await post(`/tickets/${row.id}/confirm-bug`, {}, { requestId: 'confirm-0001' });
    expect(retry).toEqual(first);
    expect((await audits()).filter((a) => a.action === 'ticket.confirm_bug')).toHaveLength(1);
  });

  it('marks a bug a duplicate of an earlier confirmed one', async () => {
    const f = await makeFamily();
    const original = await ticket(f, { createdAt: t.clock.now() });
    await post(`/tickets/${original.id}/confirm-bug`);
    t.clock.advance(1000);
    const copy = await ticket(f, { createdAt: t.clock.now() });
    expect(
      (await post(`/tickets/${copy.id}/duplicate`, { duplicateOf: original.id })).data,
    ).toEqual({
      ok: true,
    });
    const list = OperatorTicketListSchema.parse((await get('/tickets')).data);
    expect(list.tickets.find((x) => x.id === copy.id)).toMatchObject({
      confirmedBug: false,
      duplicateOf: original.id,
    });
  });

  it('refuses to confirm an idea, or to mark a duplicate of an unconfirmed report', async () => {
    const f = await makeFamily();
    const idea = await ticket(f, { kind: 'idea' });
    expect(await post(`/tickets/${idea.id}/confirm-bug`)).toMatchObject({
      status: 400,
      code: 'not_a_bug',
    });
    const a = await ticket(f);
    const b = await ticket(f);
    expect(await post(`/tickets/${b.id}/duplicate`, { duplicateOf: a.id })).toMatchObject({
      status: 400,
      code: 'invalid_duplicate',
    });
  });
});

describe('operator Not a bug and the bug button (L13)', () => {
  it("marks a student's bug report Not a bug, closed with no reward, and audits it", async () => {
    const f = await makeFamily();
    const row = await ticket(f, {
      senderRole: 'student',
      senderAuthUserId: null,
      studentId: f.studentId,
    });
    expect((await post(`/tickets/${row.id}/not-a-bug`)).data).toEqual({ ok: true });
    const [saved] = await t.db.select().from(feedback).where(eq(feedback.id, row.id));
    expect(saved).toMatchObject({ outcome: 'not_a_bug', status: 'will_not_fix', rewardXp: 0 });
    expect(await post(`/tickets/${row.id}/not-a-bug`)).toMatchObject({
      status: 409,
      code: 'already_reviewed',
    });
    expect(await audits()).toContainEqual(
      expect.objectContaining({ action: 'ticket.not_a_bug', targetId: f.familyId }),
    );
  });

  it("switches the sender's bug button back on from their ticket, and audits it", async () => {
    const f = await makeFamily();
    const rows = [];
    for (let i = 0; i < 3; i++) {
      const row = await ticket(f, {
        senderRole: 'student',
        senderAuthUserId: null,
        studentId: f.studentId,
      });
      await post(`/tickets/${row.id}/not-a-bug`);
      rows.push(row);
    }
    const state = await t.app.request('/v1/student/bug-button', { headers: f.studentHeaders });
    expect(await state.json()).toMatchObject({ state: 'paused' });

    expect((await post(`/tickets/${rows[2]!.id}/bug-button-on`)).data).toEqual({ ok: true });
    const after = await t.app.request('/v1/student/bug-button', { headers: f.studentHeaders });
    expect(await after.json()).toEqual({ state: 'on' });
    expect(await audits()).toContainEqual(
      expect.objectContaining({ action: 'ticket.bug_button_on', targetId: f.familyId }),
    );
  });

  it('refuses Not a bug on an idea, and Bug button on for a ticket a parent sent', async () => {
    const f = await makeFamily();
    const idea = await ticket(f, { kind: 'idea' });
    expect(await post(`/tickets/${idea.id}/not-a-bug`)).toMatchObject({
      status: 400,
      code: 'not_a_bug',
    });
    const fromParent = await ticket(f);
    expect(await post(`/tickets/${fromParent.id}/bug-button-on`)).toMatchObject({
      status: 400,
      code: 'not_a_student_ticket',
    });
  });
});

describe("support notes and replies in the family's own data export", () => {
  it('includes them, with the text and time only, never the operator email', async () => {
    const f = await makeFamily();
    const row = await ticket(f);
    await post(`/families/${f.familyId}/notes`, { text: 'Called about sign-in' });
    await post(`/tickets/${row.id}/reply`, { text: 'Fixed in the next update' });

    const res = await t.app.request('/v1/export', { headers: f.parent.headers });
    const data = (await res.json()) as {
      supportNotes: unknown[];
      feedback: { id: string; replies: unknown[] }[];
    };
    expect(data.supportNotes).toEqual([
      { text: 'Called about sign-in', createdAt: expect.any(String) },
    ]);
    expect(data.feedback.find((x) => x.id === row.id)!.replies).toEqual([
      { body: 'Fixed in the next update', createdAt: expect.any(String) },
    ]);
    expect(JSON.stringify(data)).not.toContain('agent@example.com');
  });
});
