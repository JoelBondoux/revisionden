import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { OperatorFriendReportsSchema } from '@revisionden/core';
import { operatorAuditLog } from '@revisionden/db';
import { createTestContext, jsonRequest, type TestContext } from './test/helpers';
import { signedOperatorRequest, TEST_OPERATOR_SECRET } from './test/operator';

/* AppDeck's view of friend reports (FL PR 4, docs/FRIENDS_LEAGUE.md section 7). */

type H = Record<string, string>;
let t: TestContext;

beforeAll(async () => {
  t = await createTestContext({
    config: { operatorBridge: { secret: TEST_OPERATOR_SECRET }, friendsEnabled: true },
  });
});
afterAll(async () => {
  await t.close();
});

const send = (method: string, path: string, headers: H, body: unknown = {}) =>
  t.app.request(path, jsonRequest(method, body, headers));

async function op(method: string, path: string, body?: unknown, role = 'agent') {
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
  return { status: res.status, data: json.data as Record<string, unknown>, code: json.error?.code };
}

async function kid(nickname: string) {
  const k = { ...(await t.familyStudent(nickname)), nickname };
  await send('PUT', `/v1/students/${k.studentId}/friends/allowed`, k.parent.headers, {
    allowed: true,
  });
  return k;
}

/** Two children from different families become friends, then one reports the other. */
async function reported(reason = 'pressured') {
  const a = await kid(`Rep_${Math.floor(Math.random() * 1e6)}`);
  const b = await kid(`Sub_${Math.floor(Math.random() * 1e6)}`);
  const code = (await (await send('POST', '/v1/student/friends/codes', a.headers)).json()) as {
    code: string;
  };
  const { requestId } = (await (
    await send('POST', '/v1/student/friends/redeem', b.headers, { code: code.code })
  ).json()) as { requestId: string };
  await send('POST', `/v1/student/friends/requests/${requestId}/confirm`, b.headers);
  for (const k of [a, b]) {
    await send(
      'POST',
      `/v1/students/${k.studentId}/friends/requests/${requestId}/approve`,
      k.parent.headers,
    );
  }
  await send('POST', `/v1/student/friends/${b.studentId}/report`, a.headers, { reason });
  return { a, b };
}

describe('friend reports in AppDeck', () => {
  it('lists reports with only nicknames, the reported avatar, the fixed reason and dates', async () => {
    const { a, b } = await reported();
    const { status, data } = await op('GET', '/friend-reports');
    expect(status).toBe(200);
    expect(OperatorFriendReportsSchema.safeParse(data).success).toBe(true);
    const reports = data.reports as Record<string, unknown>[];
    const mine = reports.find((r) => r.reporter !== undefined && r.id)!;
    expect(Object.keys(mine).sort()).toEqual(
      [
        'closedAt',
        'createdAt',
        'id',
        'reason',
        'reported',
        'reportedAvatarCode',
        'reporter',
      ].sort(),
    );
    const text = JSON.stringify(data);
    for (const id of [a.studentId, b.studentId]) expect(text).not.toContain(id);
    const audits = await t.db
      .select()
      .from(operatorAuditLog)
      .where(eq(operatorAuditLog.action, 'friend_reports.list'));
    expect(audits).toHaveLength(1);
  });

  it('lets support close a report, once, and the families then see it as dealt with', async () => {
    const { a, b } = await reported('other');
    const list = await op('GET', '/friend-reports');
    const report = (list.data.reports as { id: string; reporter: string }[]).find(
      (r) => r.reporter === a.nickname,
    )!;
    const res = await op('POST', `/friend-reports/${report.id}/close`, {});
    expect(res.status).toBe(200);
    expect((await op('POST', `/friend-reports/${report.id}/close`, {})).code).toBe('report_closed');
    for (const k of [a, b]) {
      const view = (await (
        await t.app.request(`/v1/students/${k.studentId}/friends`, { headers: k.parent.headers })
      ).json()) as { reports: { closed: boolean }[] };
      expect(view.reports[0]!.closed).toBe(true);
    }
    const audits = await t.db
      .select()
      .from(operatorAuditLog)
      .where(eq(operatorAuditLog.action, 'friend_report.close'));
    expect(audits.map((x) => x.targetId)).toContain(report.id);
  });

  it('answers 404 for an unknown report', async () => {
    const res = await op('POST', '/friend-reports/00000000-0000-4000-8000-000000000999/close', {});
    expect(res.status).toBe(404);
  });
});
