import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { feedback, operatorAuditLog, students } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { sha256Hex } from './triage';

const TOKEN = 'test-triage-token-0123456789abcdef0123456789abcdef';
let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { triage: { tokenHash: await sha256Hex(TOKEN) } } });
});

afterEach(async () => {
  await t.close();
});

const bot = { authorization: `Bearer ${TOKEN}` };

async function report(headers: Record<string, string>, kind = 'bug', text = 'It broke') {
  const res = await t.app.request(
    '/v1/student/feedback',
    jsonRequest(
      'POST',
      { kind, text, device: { route: '/map', contentId: 'gcse-maths-n1-0001' } },
      headers,
    ),
  );
  expect(res.status).toBe(201);
  return ((await res.json()) as { id: string }).id;
}

const post = (path: string, body: object, headers: Record<string, string> = bot) =>
  t.app.request(`/v1/triage${path}`, jsonRequest('POST', body, headers));

const triageAudits = async () =>
  (await t.db.select().from(operatorAuditLog)).filter((a) => a.operatorEmail === 'triage-bot');

describe('triage token (L14)', () => {
  it('lists tickets with only the fields triage needs, never names or emails', async () => {
    const { headers, studentId } = await t.familyStudent('test_kid');
    await t.db.update(students).set({ tester: true }).where(eq(students.id, studentId));
    const id = await report(headers);

    const res = await t.app.request('/v1/triage/tickets', { headers: bot });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { tickets: Record<string, unknown>[]; nextBefore: unknown };
    expect(body.nextBefore).toBeNull();
    const { tickets } = body;
    expect(tickets).toEqual([
      {
        id,
        kind: 'bug',
        senderRole: 'student',
        text: 'It broke',
        itemId: null,
        contentId: 'gcse-maths-n1-0001',
        device: { route: '/map', contentId: 'gcse-maths-n1-0001' },
        status: 'new',
        outcome: null,
        tester: true,
        createdAt: t.clock.now().toISOString(),
      },
    ]);
    expect(JSON.stringify(tickets)).not.toContain('test_kid');
  });

  it('lists only tickets since a time', async () => {
    const { headers } = await t.familyStudent('test_kid');
    await report(headers);
    const since = new Date(t.clock.now().getTime() + 1).toISOString();
    t.clock.advance(1000);
    const later = await report(headers);
    const res = await t.app.request(`/v1/triage/tickets?since=${since}`, { headers: bot });
    const { tickets } = (await res.json()) as { tickets: { id: string }[] };
    expect(tickets.map((x) => x.id)).toEqual([later]);
  });

  it('audits every successful list read as triage-bot', async () => {
    const { headers } = await t.familyStudent('test_kid');
    await report(headers);
    expect((await t.app.request('/v1/triage/tickets', { headers: bot })).status).toBe(200);
    expect(await triageAudits()).toEqual([
      expect.objectContaining({ action: 'tickets.list', operatorRole: 'agent', reason: 'count=1' }),
    ]);
    await t.app.request('/v1/triage/tickets?status=unreviewed&limit=5', { headers: bot });
    const [, second] = await triageAudits();
    expect(second?.reason).toBe('count=1 status=unreviewed limit=5');
    expect(JSON.stringify(await triageAudits())).not.toContain('It broke');
  });

  it('pages back through older tickets with nextBefore, never skipping one', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) ids.push(await report(headers));
    const seen: string[] = [];
    let url = '/v1/triage/tickets?limit=2';
    for (;;) {
      const res = await t.app.request(url, { headers: bot });
      expect(res.status).toBe(200);
      const page = (await res.json()) as { tickets: { id: string }[]; nextBefore: string | null };
      seen.push(...page.tickets.map((x) => x.id));
      if (!page.nextBefore) break;
      url = `/v1/triage/tickets?limit=2&before=${encodeURIComponent(page.nextBefore)}`;
    }
    expect(seen.sort()).toEqual([...ids].sort());
    expect(new Set(seen).size).toBe(5);
    expect((await t.app.request('/v1/triage/tickets?before=nope', { headers: bot })).status).toBe(
      400,
    );
  });

  it('lists only unreviewed tickets when asked', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const done = await report(headers);
    await post(`/tickets/${done}/not-a-bug`, { reason: 'Works as designed' });
    t.clock.advance(1000);
    const open = await report(headers);
    const res = await t.app.request('/v1/triage/tickets?status=unreviewed', { headers: bot });
    const { tickets } = (await res.json()) as { tickets: { id: string }[] };
    expect(tickets.map((x) => x.id)).toEqual([open]);
  });

  it('reads one ticket, audited against its family, and 404 for an unknown one', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    const res = await t.app.request(`/v1/triage/tickets/${id}`, { headers: bot });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ticket: { id, kind: 'bug', text: 'It broke' } });
    expect(await triageAudits()).toEqual([
      expect.objectContaining({ action: 'ticket.read', targetType: 'family' }),
    ]);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await t.app.request(`/v1/triage/tickets/${missing}`, { headers: bot })).status).toBe(
      404,
    );
  });

  it('refuses a missing or wrong token, and every other route', async () => {
    expect((await t.app.request('/v1/triage/tickets')).status).toBe(401);
    expect(
      (await t.app.request('/v1/triage/tickets', { headers: { authorization: 'Bearer nope' } }))
        .status,
    ).toBe(401);
    // The token is no parent or student session.
    expect((await t.app.request('/v1/feedback', { headers: bot })).status).toBe(401);
    expect((await t.app.request('/v1/admin/feedback', { headers: bot })).status).toBe(401);
  });

  it('confirms a bug with every Bug Hunter rule, and audits it with the reason', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    const res = await post(`/tickets/${id}/confirm-bug`, { reason: 'Map fails to load on /map' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const [row] = await t.db.select().from(feedback).where(eq(feedback.id, id));
    expect(row).toMatchObject({ outcome: 'confirmed', rewardXp: 50, reviewedBy: 'triage' });
    expect(await triageAudits()).toEqual([
      expect.objectContaining({
        action: 'ticket.confirm_bug',
        targetType: 'family',
        reason: 'Map fails to load on /map',
      }),
    ]);
    // One confirm per report still applies.
    expect((await post(`/tickets/${id}/confirm-bug`, { reason: 'Again' })).status).toBe(409);
  });

  it('marks a duplicate and Not a bug through the same rules', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const first = await report(headers);
    await post(`/tickets/${first}/confirm-bug`, { reason: 'Real' });
    t.clock.advance(1000);
    const copy = await report(headers);
    const dup = await post(`/tickets/${copy}/duplicate`, { duplicateOf: first, reason: 'Same' });
    expect(dup.status).toBe(200);
    const notBug = await report(headers);
    expect(
      (await post(`/tickets/${notBug}/not-a-bug`, { reason: 'Works as designed' })).status,
    ).toBe(200);
    const rows = await t.db.select().from(feedback);
    expect(rows.find((r) => r.id === copy)).toMatchObject({ outcome: 'duplicate', rewardXp: 10 });
    expect(rows.find((r) => r.id === notBug)).toMatchObject({
      outcome: 'not_a_bug',
      reviewedBy: 'triage',
    });
    expect((await triageAudits()).map((a) => a.action).sort()).toEqual([
      'ticket.confirm_bug',
      'ticket.duplicate',
      'ticket.not_a_bug',
    ]);
  });

  it('needs a reason of at most 300 characters', async () => {
    const { headers } = await t.familyStudent('test_kid');
    const id = await report(headers);
    expect((await post(`/tickets/${id}/confirm-bug`, {})).status).toBe(400);
    expect((await post(`/tickets/${id}/confirm-bug`, { reason: '' })).status).toBe(400);
    expect((await post(`/tickets/${id}/confirm-bug`, { reason: 'x'.repeat(301) })).status).toBe(
      400,
    );
    expect(await triageAudits()).toEqual([]);
  });
});

describe('triage when no token hash is set (L14)', () => {
  it('answers 404 so the routes stay hidden', async () => {
    const plain = await createTestContext();
    try {
      expect((await plain.app.request('/v1/triage/tickets', { headers: bot })).status).toBe(404);
    } finally {
      await plain.close();
    }
  });
});
