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
