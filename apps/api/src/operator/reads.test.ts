import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  OperatorAuditLogSchema,
  OperatorContentReportListSchema,
  OperatorFamilyDetailSchema,
  OperatorFamilySearchResultSchema,
  OperatorOverviewSchema,
  OperatorHealthSchema,
  OperatorTicketListSchema,
  OperatorTicketDetailSchema,
  type OperatorTicket,
} from '@revisionden/core';
import {
  attempts,
  errorReports,
  families,
  feedback,
  itemReports,
  items,
  operatorAuditLog,
  operatorRequests,
  parents,
  quarantinedItems,
  topics,
} from '@revisionden/db';
import { createTestContext, type TestContext } from '../test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from '../test/operator';

const DAY = 24 * 60 * 60 * 1000;

let t: TestContext;

beforeEach(async () => {
  t = await createTestContext({ config: { operatorBridge: { secret: TEST_OPERATOR_SECRET } } });
});
afterEach(async () => {
  await t.close();
});

/** Sends a signed request; a 2xx body must be AppDeck's envelope, and `body` is its `data`. */
async function call(
  path: string,
  method: string,
  body?: unknown,
  extra: { requestId?: string } = {},
) {
  const res = await t.app.request(
    ...(await signedOperatorRequest({ clock: t.clock, path, method, body, ...extra })),
  );
  const json = (await res.json()) as { success?: boolean; data?: unknown };
  if (res.status >= 200 && res.status < 300) {
    expect(json.success).toBe(true);
    return { status: res.status, body: json.data };
  }
  return { status: res.status, body: json as unknown };
}
const get = (path: string) => call(path, 'GET');
const search = (body: unknown, extra: { requestId?: string } = {}) =>
  call('/operator/appdeck/families/search', 'POST', body, extra);

/** A family with one parent and one child; returns ids and the parent's sign-in email. */
async function makeFamily(nickname = 'test_kid', subjects: string[] = []) {
  const { studentId, parent } = await t.familyStudent(nickname, subjects);
  const [row] = await t.db
    .select({ familyId: parents.familyId })
    .from(parents)
    .where(eq(parents.authUserId, parent.userId));
  const email = parent.userId.replace('test-parent-', 'parent') + '@example.com';
  return { familyId: row!.familyId, studentId, parentUserId: parent.userId, email };
}

async function auditRows() {
  return t.db.select().from(operatorAuditLog);
}

let itemCounter = 0;
async function answerAt(studentId: string, at: Date) {
  itemCounter += 1;
  await t.db
    .insert(topics)
    .values({ id: 'op-topic', subjectId: 'gcse-maths', board: 'AQA', title: 'Topic' })
    .onConflictDoNothing();
  const [item] = await t.db
    .insert(items)
    .values({
      topicId: 'op-topic',
      type: 'mcq',
      body: {},
      answer: {},
      contentId: `op-${itemCounter}`,
    })
    .returning({ id: items.id });
  await t.db.insert(attempts).values({ studentId, itemId: item!.id, correct: true, createdAt: at });
}

describe('operator overview', () => {
  it('counts families, active students, open tickets, content and error reports', async () => {
    const a = await makeFamily('kid_a');
    const b = await makeFamily('kid_b');
    const now = t.clock.now().getTime();
    await answerAt(a.studentId, new Date(now - 3 * DAY));
    await answerAt(b.studentId, new Date(now - 20 * DAY));
    await t.db.insert(feedback).values([
      { familyId: a.familyId, senderRole: 'parent', kind: 'bug', status: 'new' },
      { familyId: a.familyId, senderRole: 'parent', kind: 'idea', status: 'fixed' },
    ]);
    await t.db.insert(itemReports).values({
      itemId: 'item-1',
      itemVersion: 1,
      reason: 'wrong_answer',
      reportedBy: 'student',
      familyId: a.familyId,
    });
    await t.db.insert(errorReports).values({
      ref: 'RD-AAAAAA',
      screen: '/map',
      build: 'b',
      browser: 'Safari',
      online: true,
      reportedAt: new Date(now),
      createdAt: new Date(now - 60_000),
    });

    const { status, body } = await get('/operator/appdeck/overview');
    expect(status).toBe(200);
    expect(OperatorOverviewSchema.parse(body)).toEqual({
      families: 2,
      students: 2,
      activeStudents7d: 1,
      activeStudents30d: 2,
      openTickets: 1,
      openContentReports: 1,
      errorReports24h: 1,
      premiumFamilies: null,
      trials: null,
      freePlaces: null,
      openComplaints: 0,
    });
  });
});

describe('operator family search', () => {
  it('finds a family by the exact parent sign-in email, in any letter case, and audits it', async () => {
    const f = await makeFamily();
    const { status, body } = await search({ email: f.email.toUpperCase() });
    expect(status).toBe(200);
    const result = OperatorFamilySearchResultSchema.parse(body);
    expect(result.families).toEqual([
      expect.objectContaining({ id: f.familyId, parentCount: 1, childCount: 1 }),
    ]);
    const [entry] = await auditRows();
    expect(entry).toMatchObject({
      action: 'family.search',
      targetType: 'family',
      targetId: f.familyId,
      outcome: 'ok',
    });
    // The search text is never recorded.
    expect(JSON.stringify(entry)).not.toContain(f.email);
  });

  it('does not match part of an email', async () => {
    const f = await makeFamily();
    const { body } = await search({ email: `x${f.email}` });
    expect(OperatorFamilySearchResultSchema.parse(body).families).toEqual([]);
  });

  it('finds a family by id', async () => {
    const f = await makeFamily();
    const { body } = await search({ familyId: f.familyId });
    expect(OperatorFamilySearchResultSchema.parse(body).families[0]!.id).toBe(f.familyId);
  });

  it('audits a search that found nothing, without a target', async () => {
    await search({ email: 'nobody@example.com' });
    expect(await auditRows()).toEqual([
      expect.objectContaining({ action: 'family.search', targetType: null, targetId: null }),
    ]);
  });

  it('refuses a search by name, by part of an email or by both email and id', async () => {
    const bad = [
      { name: 'kid' },
      { email: 'parent1' },
      { email: 'a@example.com', familyId: crypto.randomUUID() },
      {},
    ];
    for (const body of bad) {
      expect((await search(body)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('treats a search as a read: the same request id twice is refused and nothing is stored', async () => {
    const f = await makeFamily();
    expect((await search({ email: f.email }, { requestId: 'search-0001' })).status).toBe(200);
    const again = await search({ email: f.email }, { requestId: 'search-0001' });
    expect(again.status).toBe(409);
    const [stored] = await t.db.select().from(operatorRequests);
    expect(stored!.responseBody).toBeNull();
  });
});

describe('operator family detail', () => {
  it('shows only minimal fields: parents, children as nickname and year group, flags', async () => {
    const f = await makeFamily('test_kid', ['gcse-maths']);
    await answerAt(f.studentId, new Date(t.clock.now().getTime() - DAY));
    await t.db.insert(feedback).values({
      familyId: f.familyId,
      senderRole: 'parent',
      kind: 'bug',
      status: 'looking_into_it',
    });

    const { status, body } = await get(`/operator/appdeck/families/${f.familyId}`);
    expect(status).toBe(200);
    const family = OperatorFamilyDetailSchema.parse(body);
    expect(family.parents).toEqual([{ email: f.email, joinedAt: expect.any(String) }]);
    // AppDeck gets only a child's nickname and year group.
    expect(family.children).toEqual([{ nickname: 'test_kid', yearGroup: 11 }]);
    expect(family.plan).toBeNull();
    expect(family.flags).toEqual({
      inactivityWarning: false,
      openTickets: 1,
      openContentReports: 0,
    });
    expect(await auditRows()).toEqual([
      expect.objectContaining({
        action: 'family.view',
        targetType: 'family',
        targetId: f.familyId,
      }),
    ]);
  });

  it('flags a family not used for 11 months and says when it would be deleted', async () => {
    const f = await makeFamily();
    const lastActive = new Date('2025-12-01T10:00:00Z');
    await t.db
      .update(families)
      .set({ lastActiveAt: lastActive })
      .where(eq(families.id, f.familyId));
    const family = OperatorFamilyDetailSchema.parse(
      (await get(`/operator/appdeck/families/${f.familyId}`)).body,
    );
    expect(family.flags.inactivityWarning).toBe(true);
    expect(family.deletesAfter).toBe('2026-12-01T10:00:00.000Z');
  });

  it('answers 404 for an unknown or malformed family id', async () => {
    expect((await get(`/operator/appdeck/families/${crypto.randomUUID()}`)).status).toBe(404);
    expect((await get('/operator/appdeck/families/not-an-id')).status).toBe(404);
  });
});

describe('operator tickets', () => {
  it("lists feedback newest first and never sends a student's own words", async () => {
    const f = await makeFamily();
    const now = t.clock.now().getTime();
    await t.db.insert(feedback).values([
      {
        familyId: f.familyId,
        senderRole: 'student',
        studentId: f.studentId,
        kind: 'confusing',
        text: 'words a child typed',
        device: { appVersion: '00.01.002', route: '/map' },
        createdAt: new Date(now - 2000),
      },
      {
        familyId: f.familyId,
        senderRole: 'parent',
        senderAuthUserId: f.parentUserId,
        kind: 'bug',
        text: 'The map does not load',
        createdAt: new Date(now - 1000),
      },
    ]);

    const { status, body } = await get('/operator/appdeck/tickets');
    expect(status).toBe(200);
    const { tickets } = OperatorTicketListSchema.parse(body);
    expect(tickets.map((x: OperatorTicket) => [x.senderRole, x.text])).toEqual([
      ['parent', 'The map does not load'],
      ['student', null],
    ]);
    expect(tickets[1]!.device).toEqual({ appVersion: '00.01.002', route: '/map' });
    expect(JSON.stringify(body)).not.toContain('words a child typed');
    expect(await auditRows()).toEqual([expect.objectContaining({ action: 'tickets.list' })]);
  });

  it('filters open tickets and one family', async () => {
    const a = await makeFamily('kid_a');
    const b = await makeFamily('kid_b');
    await t.db.insert(feedback).values([
      { familyId: a.familyId, senderRole: 'parent', kind: 'bug', status: 'new' },
      { familyId: a.familyId, senderRole: 'parent', kind: 'bug', status: 'fixed' },
      { familyId: b.familyId, senderRole: 'parent', kind: 'bug', status: 'looking_into_it' },
    ]);
    const open = OperatorTicketListSchema.parse(
      (await get('/operator/appdeck/tickets?status=open')).body,
    );
    expect(open.tickets.map((x) => x.status).sort()).toEqual(['looking_into_it', 'new']);
    const familyA = OperatorTicketListSchema.parse(
      (await get(`/operator/appdeck/tickets?familyId=${a.familyId}`)).body,
    );
    expect(familyA.tickets).toHaveLength(2);
    expect(await auditRows()).toContainEqual(
      expect.objectContaining({
        action: 'tickets.list',
        targetType: 'family',
        targetId: a.familyId,
      }),
    );
    expect((await get('/operator/appdeck/tickets?status=lost')).status).toBe(400);
  });

  it('filters by kind and shows one ticket, audited against its family', async () => {
    const f = await makeFamily();
    const [bug] = await t.db
      .insert(feedback)
      .values([
        { familyId: f.familyId, senderRole: 'parent', kind: 'bug', text: 'Map broken' },
        { familyId: f.familyId, senderRole: 'parent', kind: 'idea', text: 'Dark mode' },
      ])
      .returning({ id: feedback.id });
    const bugs = OperatorTicketListSchema.parse(
      (await get('/operator/appdeck/tickets?kind=bug')).body,
    );
    expect(bugs.tickets.map((x) => x.kind)).toEqual(['bug']);

    const one = await get(`/operator/appdeck/tickets/${bug!.id}`);
    expect(one.status).toBe(200);
    expect(OperatorTicketDetailSchema.parse(one.body)).toMatchObject({
      id: bug!.id,
      text: 'Map broken',
    });
    expect(await auditRows()).toContainEqual(
      expect.objectContaining({
        action: 'ticket.view',
        targetType: 'family',
        targetId: f.familyId,
      }),
    );
    expect((await get(`/operator/appdeck/tickets/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe('operator error reports and content reports', () => {
  it('groups error reports by screen, API path and status', async () => {
    const now = t.clock.now().getTime();
    await t.db.insert(errorReports).values(
      ['RD-AAAAAA', 'RD-BBBBBB'].map((ref, i) => ({
        ref,
        screen: '/map',
        apiPath: '/v1/student/map',
        status: 500,
        build: 'b',
        browser: 'Chrome' as const,
        online: true,
        reportedAt: new Date(now),
        createdAt: new Date(now - (i + 1) * 60_000),
      })),
    );
    const { status, body } = await get('/operator/appdeck/error-reports');
    expect(status).toBe(200);
    expect(body).toMatchObject({ total: 2, groups: [{ screen: '/map', count: 2 }] });
  });

  it('finds the group holding one RD code exactly, in any letter case, over 90 days', async () => {
    const now = t.clock.now().getTime();
    const report = (ref: string, screen: string, daysAgo: number) => ({
      ref,
      screen,
      apiPath: '/v1/student/map',
      status: 500,
      build: 'b',
      browser: 'Chrome' as const,
      online: true,
      reportedAt: new Date(now),
      createdAt: new Date(now - daysAgo * 24 * 60 * 60 * 1000),
    });
    // 25 reports in one group, so the code is beyond the group's sampled refs.
    await t.db
      .insert(errorReports)
      .values([
        report('RD-7K2M9Q', '/map', 40),
        ...Array.from({ length: 24 }, (_, i) =>
          report(`RD-${String(i).padStart(6, 'A')}`, '/map', 1),
        ),
        report('RD-BBBBBB', '/cards', 2),
      ]);

    const { status, body } = await get('/operator/appdeck/error-reports?code=rd-7k2m9q');
    expect(status).toBe(200);
    expect(body).toMatchObject({
      code: 'RD-7K2M9Q',
      groups: [{ screen: '/map', count: 25 }],
    });
    const group = (body as { groups: { refs: string[] }[] }).groups[0]!;
    expect(group.refs).toContain('RD-7K2M9Q');
  });

  it('answers 404 for an unknown code and 400 for something that is not a code', async () => {
    expect((await get('/operator/appdeck/error-reports?code=RD-ZZZZZZ')).status).toBe(404);
    expect((await get('/operator/appdeck/error-reports?code=hello')).status).toBe(400);
  });

  it('lists open content reports with whether the question is hidden, and the review queue link', async () => {
    const f = await makeFamily();
    await t.db.insert(itemReports).values([
      {
        itemId: 'item-1',
        itemVersion: 2,
        reason: 'wrong_answer',
        reportedBy: 'parent',
        familyId: f.familyId,
      },
      {
        itemId: 'item-2',
        itemVersion: 1,
        reason: 'wrong_answer',
        reportedBy: 'student',
        familyId: f.familyId,
        status: 'no_error',
      },
    ]);
    await t.db
      .insert(quarantinedItems)
      .values({ itemId: 'item-1', itemVersion: 2, cause: 'report' });

    const list = OperatorContentReportListSchema.parse(
      (await get('/operator/appdeck/content-reports')).body,
    );
    expect(list.reviewQueueUrl).toBe('https://dev.revisionden.test/review');
    expect(list.reports).toEqual([
      expect.objectContaining({ itemId: 'item-1', quarantined: true, status: 'open' }),
    ]);
    const all = OperatorContentReportListSchema.parse(
      (await get('/operator/appdeck/content-reports?status=all')).body,
    );
    expect(all.reports).toHaveLength(2);
  });
});

describe('operator audit log and service status', () => {
  it('lists audit entries newest first, by target, a page at a time', async () => {
    const f = await makeFamily();
    for (let i = 0; i < 3; i += 1) {
      await get(`/operator/appdeck/families/${f.familyId}`);
      t.clock.advance(1000);
    }
    await get('/operator/appdeck/tickets');

    const page1 = OperatorAuditLogSchema.parse(
      (await get(`/operator/appdeck/audit?targetType=family&targetId=${f.familyId}&limit=2`)).body,
    );
    expect(page1.entries).toHaveLength(2);
    expect(page1.entries.every((e) => e.action === 'family.view')).toBe(true);
    expect(page1.nextBefore).not.toBeNull();
    const page2 = OperatorAuditLogSchema.parse(
      (
        await get(
          `/operator/appdeck/audit?targetType=family&targetId=${f.familyId}&limit=2&before=${encodeURIComponent(page1.nextBefore!)}`,
        )
      ).body,
    );
    expect(page2.entries).toHaveLength(1);
    expect(page2.nextBefore).toBeNull();
  });

  it('refuses a malformed cursor with a 400, not a server error', async () => {
    const bad = encodeURIComponent('2026-11-25T12:00:00.000Z~------------------------------------');
    expect((await get(`/operator/appdeck/audit?before=${bad}`)).status).toBe(400);
  });

  it('pages through entries that share a time without skipping any', async () => {
    const at = t.clock.now();
    await t.db.insert(operatorAuditLog).values(
      ['a', 'b', 'c'].map((id) => ({
        operatorEmail: 'agent@example.com',
        operatorRole: 'agent' as const,
        action: 'family.view',
        targetType: 'tie',
        targetId: 'same-time',
        requestId: `tie-${id}`,
        outcome: 'ok' as const,
        createdAt: at,
      })),
    );
    const seen: string[] = [];
    let before: string | null = null;
    do {
      const query: string = `/operator/appdeck/audit?targetType=tie&limit=2${before ? `&before=${encodeURIComponent(before)}` : ''}`;
      const page = OperatorAuditLogSchema.parse((await get(query)).body);
      seen.push(...page.entries.map((e) => e.requestId));
      before = page.nextBefore;
    } while (before);
    expect(seen.sort()).toEqual(['tie-a', 'tie-b', 'tie-c']);
  });

  it('reports the environment, version and error-report rate', async () => {
    const now = t.clock.now().getTime();
    await t.db.insert(errorReports).values({
      ref: 'RD-CCCCCC',
      screen: '/map',
      build: 'b',
      browser: 'Safari',
      online: true,
      reportedAt: new Date(now),
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    });
    expect(OperatorHealthSchema.parse((await get('/operator/appdeck/health')).body)).toEqual({
      status: 'ok',
      environment: 'development',
      version: '00.01.000',
      operator: { email: 'agent@example.com', role: 'agent' },
      errorReportsLastHour: 0,
      errorReports24h: 1,
    });
  });
});
