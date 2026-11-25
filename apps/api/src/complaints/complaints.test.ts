import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { OperatorComplaintListSchema, OperatorOverviewSchema } from '@revisionden/core';
import { complaints, operatorAuditLog, parents } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';
import { deleteExpiredComplaints } from './routes';

let t: TestContext;

beforeEach(async () => {
  // Wednesday 25 November 2026, 10:00 UK time.
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
  t.clock.advance(new Date('2026-11-25T10:00:00Z').getTime() - t.clock.now().getTime());
});
afterEach(async () => {
  await t.close();
});

async function operator(method: string, path: string, body?: unknown, role = 'agent') {
  const res = await t.app.request(
    ...(await signedOperatorRequest({
      clock: t.clock,
      method,
      path: `/operator/appdeck${path}`,
      body,
      role,
    })),
  );
  const json = (await res.json()) as { data?: unknown; error?: { code: string } };
  return { status: res.status, data: json.data, code: json.error?.code };
}

async function makeFamily() {
  const { parent } = await t.familyStudent('test_kid');
  const [row] = await t.db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, parent.userId));
  return { familyId: row!.familyId, headers: parent.headers };
}

const complain = (headers: Record<string, string>, body: unknown) =>
  t.app.request('/v1/complaints', jsonRequest('POST', body, headers));

async function listOwn(headers: Record<string, string>) {
  const res = await t.app.request('/v1/complaints', { headers });
  return ((await res.json()) as { complaints: Record<string, unknown>[] }).complaints;
}

const operatorList = async () =>
  OperatorComplaintListSchema.parse((await operator('GET', '/complaints')).data).complaints;

describe('a parent makes a complaint in the app', () => {
  it('records it with the deadlines and shows it to the parent', async () => {
    const f = await makeFamily();
    const res = await complain(f.headers, {
      summary: 'The starting test marked a right answer wrong',
      aboutPersonalData: false,
    });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      acknowledgeDueAt: '2026-11-27T23:59:59.999Z',
      resolveDueAt: '2026-12-09T23:59:59.999Z',
    });
    expect(await listOwn(f.headers)).toEqual([
      expect.objectContaining({
        status: 'new',
        summary: 'The starting test marked a right answer wrong',
        acknowledgeDueAt: '2026-11-27T23:59:59.999Z',
        messages: [],
      }),
    ]);
  });

  it('needs a signed-in parent and a real summary, and refuses contact details', async () => {
    const f = await makeFamily();
    expect(
      (
        await t.app.request(
          '/v1/complaints',
          jsonRequest('POST', { summary: 'Hello there', aboutPersonalData: false }),
        )
      ).status,
    ).toBe(401);
    expect((await complain(f.headers, { summary: 'no', aboutPersonalData: false })).status).toBe(
      400,
    );
    const withEmail = await complain(f.headers, {
      summary: 'Please email me at someone@example.com',
      aboutPersonalData: false,
    });
    expect(withEmail.status).toBe(400);
    expect(((await withEmail.json()) as { error: { code: string } }).error.code).toBe(
      'personal_details',
    );
  });

  it('allows 3 complaints a day per family', async () => {
    const f = await makeFamily();
    for (let i = 0; i < 3; i += 1) {
      expect(
        (await complain(f.headers, { summary: `Complaint number ${i}`, aboutPersonalData: false }))
          .status,
      ).toBe(201);
    }
    expect(
      (await complain(f.headers, { summary: 'One more complaint', aboutPersonalData: false }))
        .status,
    ).toBe(429);
  });
});

describe('support handles a complaint from AppDeck', () => {
  it('lists it with its deadlines, acknowledges, replies and resolves; the parent sees it all', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'My data was shown wrongly', aboutPersonalData: true });
    const [listed] = await operatorList();
    expect(listed).toMatchObject({
      familyId: f.familyId,
      status: 'new',
      channel: 'app',
      aboutPersonalData: true,
      acknowledgeDueAt: '2026-11-27T23:59:59.999Z',
    });

    expect((await operator('POST', `/complaints/${listed!.id}/acknowledge`)).data).toEqual({
      ok: true,
    });
    await operator('POST', `/complaints/${listed!.id}/reply`, { text: 'We are looking into it' });
    expect(
      (
        await operator('POST', `/complaints/${listed!.id}/resolve`, {
          outcome: 'We fixed how the page shows your data.',
        })
      ).data,
    ).toEqual({ ok: true });

    const [own] = await listOwn(f.headers);
    expect(own).toMatchObject({
      status: 'resolved',
      outcome: 'We fixed how the page shows your data.',
      messages: [
        { from: 'operator', body: 'We are looking into it', createdAt: expect.any(String) },
      ],
    });
    expect(JSON.stringify(own)).not.toContain('agent@example.com');
    const actions = (await t.db.select().from(operatorAuditLog)).map((a) => a.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'complaints.list',
        'complaint.acknowledge',
        'complaint.reply',
        'complaint.resolve',
      ]),
    );
  });

  it("shows the parent's own follow-up messages to support", async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Something went wrong', aboutPersonalData: false });
    const [own] = await listOwn(f.headers);
    const res = await t.app.request(
      `/v1/complaints/${own!.id as string}/messages`,
      jsonRequest('POST', { text: 'It happened again today' }, f.headers),
    );
    expect(res.status).toBe(201);
    const [listed] = await operatorList();
    expect(listed!.messages).toEqual([
      expect.objectContaining({ from: 'family', body: 'It happened again today' }),
    ]);
  });

  it('logs an emailed complaint, with or without a family', async () => {
    const f = await makeFamily();
    const logged = await operator('POST', '/complaints', {
      familyId: f.familyId,
      summary: 'Emailed: unhappy with a mark',
      aboutPersonalData: false,
      receivedOn: '2026-11-24',
    });
    expect(logged.status).toBe(200);
    expect(logged.data).toEqual({ complaint: { id: expect.any(String) } });
    await operator('POST', '/complaints', {
      familyId: null,
      summary: 'Emailed by someone without an account',
      aboutPersonalData: true,
      receivedOn: '2026-11-25',
    });
    const list = await operatorList();
    expect(list.map((c) => [c.channel, c.familyId === null])).toEqual(
      expect.arrayContaining([
        ['email', false],
        ['email', true],
      ]),
    );
    // Received Tuesday 24 November: due by the end of Thursday 26 November.
    expect(list.find((c) => c.familyId === f.familyId)!.acknowledgeDueAt).toBe(
      '2026-11-26T23:59:59.999Z',
    );
  });

  it('lets only a Manager escalate', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Escalate this please', aboutPersonalData: false });
    const [listed] = await operatorList();
    expect((await operator('POST', `/complaints/${listed!.id}/escalate`, {}, 'agent')).status).toBe(
      403,
    );
    expect(
      (await operator('POST', `/complaints/${listed!.id}/escalate`, {}, 'manager')).data,
    ).toEqual({ ok: true });
    expect((await operatorList())[0]!.status).toBe('escalated');
  });

  it('refuses to resolve without an outcome, or to act on a resolved complaint', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Resolve rules', aboutPersonalData: false });
    const [listed] = await operatorList();
    expect(
      (await operator('POST', `/complaints/${listed!.id}/resolve`, { outcome: '' })).status,
    ).toBe(400);
    await operator('POST', `/complaints/${listed!.id}/resolve`, { outcome: 'Sorted it out.' });
    expect(await operator('POST', `/complaints/${listed!.id}/acknowledge`)).toMatchObject({
      status: 409,
      code: 'complaint_closed',
    });
    expect((await operator('POST', `/complaints/${crypto.randomUUID()}/acknowledge`)).status).toBe(
      404,
    );
  });

  it('counts open complaints in the overview', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'One open complaint', aboutPersonalData: false });
    const overview = OperatorOverviewSchema.parse((await operator('GET', '/overview')).data);
    expect(overview.openComplaints).toBe(1);
  });
});

describe('complaint retention and the family export', () => {
  it('deletes complaints 12 months after they are resolved', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Old complaint here', aboutPersonalData: false });
    await t.db
      .update(complaints)
      .set({ status: 'resolved', resolvedAt: new Date('2025-11-24T10:00:00Z') });
    expect(await deleteExpiredComplaints(t.db, t.clock.now())).toBe(1);
  });

  it("includes the family's complaints in its data export, without staff emails", async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Exported complaint', aboutPersonalData: false });
    const [listed] = await operatorList();
    await operator('POST', `/complaints/${listed!.id}/reply`, { text: 'Reply in export' });
    const res = await t.app.request('/v1/export', { headers: f.headers });
    const data = (await res.json()) as { complaints: { summary: string; messages: unknown[] }[] };
    expect(data.complaints).toEqual([
      expect.objectContaining({
        summary: 'Exported complaint',
        messages: [{ from: 'operator', body: 'Reply in export', createdAt: expect.any(String) }],
      }),
    ]);
    expect(JSON.stringify(data)).not.toContain('agent@example.com');
  });
});

describe('a student asks a parent to raise something (owner, 2026-11-25)', () => {
  async function family() {
    const { parent, headers, studentId } = await t.familyStudent('test_kid');
    return { parentHeaders: parent.headers, studentHeaders: headers, studentId };
  }
  const ask = (headers: Record<string, string>, body: unknown) =>
    t.app.request('/v1/student/complaint-requests', jsonRequest('POST', body, headers));
  const requests = async (headers: Record<string, string>) =>
    (
      (await (await t.app.request('/v1/complaint-requests', { headers })).json()) as {
        requests: Record<string, unknown>[];
      }
    ).requests;

  it("shows the topic and the child's note to the parents only, never to AppDeck", async () => {
    const f = await family();
    expect(
      (await ask(f.studentHeaders, { topic: 'marking', note: 'Question 3 on fractions' })).status,
    ).toBe(201);
    expect(await requests(f.parentHeaders)).toEqual([
      {
        id: expect.any(String),
        nickname: 'test_kid',
        topic: 'marking',
        topicLabel: 'A mark or a question seemed wrong',
        note: 'Question 3 on fractions',
        createdAt: expect.any(String),
      },
    ]);
    const appdeck = JSON.stringify([
      (await operator('GET', '/complaints')).data,
      (await operator('GET', '/tickets')).data,
    ]);
    expect(appdeck).not.toContain('Question 3 on fractions');
    expect(appdeck).not.toContain('marking');
  });

  it('refuses contact details in the note, and more than 3 requests a day', async () => {
    const f = await family();
    expect(
      (await ask(f.studentHeaders, { topic: 'unfair', note: 'call 07700 900123' })).status,
    ).toBe(400);
    for (let i = 0; i < 3; i += 1) {
      expect((await ask(f.studentHeaders, { topic: 'unfair' })).status).toBe(201);
    }
    expect((await ask(f.studentHeaders, { topic: 'unfair' })).status).toBe(429);
  });

  it('is removed when a parent dismisses it, or starts the complaint from it', async () => {
    const f = await family();
    await ask(f.studentHeaders, { topic: 'app_problem' });
    await ask(f.studentHeaders, { topic: 'my_data' });
    const [first, second] = await requests(f.parentHeaders);
    const dismissed = await t.app.request(`/v1/complaint-requests/${first!.id as string}`, {
      method: 'DELETE',
      headers: f.parentHeaders,
    });
    expect(dismissed.status).toBe(204);
    const started = await complain(f.parentHeaders, {
      summary: 'My child says their information was shown wrongly',
      aboutPersonalData: true,
      fromRequestId: second!.id,
    });
    expect(started.status).toBe(201);
    expect(await requests(f.parentHeaders)).toEqual([]);
  });

  it('accepts the pre-filled summary when a parent starts a complaint from a request', async () => {
    const { complaintSummaryFromRequest } = await import('@revisionden/core');
    const f = await family();
    await ask(f.studentHeaders, { topic: 'marking' });
    const [request] = await requests(f.parentHeaders);
    const nicknamed = await complain(f.parentHeaders, {
      summary: 'Raised for test_kid: a mark seemed wrong.',
      aboutPersonalData: false,
      fromRequestId: request!.id,
    });
    expect(nicknamed.status).toBe(400);
    const started = await complain(f.parentHeaders, {
      summary: complaintSummaryFromRequest('marking'),
      aboutPersonalData: false,
      fromRequestId: request!.id,
    });
    expect(started.status).toBe(201);
  });

  it('deletes requests nobody acted on after 90 days', async () => {
    const { deleteExpiredComplaintRequests } = await import('./routes');
    const f = await family();
    await ask(f.studentHeaders, { topic: 'unfair' });
    t.clock.advance(89 * 24 * 60 * 60 * 1000);
    expect(await deleteExpiredComplaintRequests(t.db, t.clock.now())).toBe(0);
    t.clock.advance(2 * 24 * 60 * 60 * 1000);
    expect(await deleteExpiredComplaintRequests(t.db, t.clock.now())).toBe(1);
  });
});

describe('escalation after 5 working days, and overdue dates in AppDeck', () => {
  it('lets a parent escalate once 5 working days have passed since acknowledgement', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Escalate when allowed', aboutPersonalData: false });
    const [listed] = await operatorList();
    expect(listed).toMatchObject({
      escalationFrom: null,
      acknowledgeOverdue: false,
      resolveOverdue: false,
    });
    await operator('POST', `/complaints/${listed!.id}/acknowledge`);
    const [acked] = await operatorList();
    // Acknowledged Wednesday 25 November 2026: the 5th working day is Wednesday 2 December.
    expect(acked!.escalationFrom).toBe('2026-12-02T23:59:59.999Z');

    const escalate = () =>
      t.app.request(`/v1/complaints/${listed!.id}/escalate`, jsonRequest('POST', {}, f.headers));
    const early = await escalate();
    expect(early.status).toBe(409);
    expect(((await early.json()) as { error: { code: string } }).error.code).toBe('too_early');

    t.clock.advance(8 * 24 * 60 * 60 * 1000);
    expect((await escalate()).status).toBe(204);
    const [own] = await listOwn(f.headers);
    expect(own).toMatchObject({ status: 'escalated', escalationFrom: '2026-12-02T23:59:59.999Z' });
  });

  it('marks acknowledgement and resolution overdue when their dates pass', async () => {
    const f = await makeFamily();
    await complain(f.headers, { summary: 'Overdue complaint', aboutPersonalData: false });
    t.clock.advance(3 * 24 * 60 * 60 * 1000);
    expect((await operatorList())[0]).toMatchObject({
      acknowledgeOverdue: true,
      resolveOverdue: false,
    });
    t.clock.advance(12 * 24 * 60 * 60 * 1000);
    expect((await operatorList())[0]).toMatchObject({ resolveOverdue: true });
  });
});

describe("a child's request in the family export", () => {
  it('is included with its topic and note', async () => {
    const { parent, headers } = await t.familyStudent('test_kid');
    await t.app.request(
      '/v1/student/complaint-requests',
      jsonRequest('POST', { topic: 'unfair', note: 'The timer' }, headers),
    );
    const data = (await (
      await t.app.request('/v1/export', { headers: parent.headers })
    ).json()) as {
      complaintRequests: unknown[];
    };
    expect(data.complaintRequests).toEqual([
      { nickname: 'test_kid', topic: 'unfair', note: 'The timer', createdAt: expect.any(String) },
    ]);
  });
});
