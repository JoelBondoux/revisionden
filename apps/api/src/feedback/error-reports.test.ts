import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { authUsers, errorReports } from '@revisionden/db';
import { ErrorReportSummarySchema } from '@revisionden/core';
import { createTestContext, jsonRequest, type TestContext } from '../test/helpers';
import { deleteExpiredErrorReports, groupErrorReports } from './error-reports';

type Line = Record<string, unknown>;
let t: TestContext;
const logged: Line[] = [];

beforeAll(async () => {
  t = await createTestContext({
    config: { operatorEmails: ['operator@example.com'] },
    errorLog: (line) => logged.push(line),
  });
});
afterAll(async () => {
  await t.close();
});

const report = (ref: string, extra: Record<string, unknown> = {}) => ({
  ref,
  screen: '/map',
  apiPath: '/v1/student/map',
  status: 404,
  build: '00.01.002-48657ff',
  browser: 'Safari',
  online: true,
  at: '2026-11-24T09:59:00.000Z',
  ...extra,
});

async function signInOperator() {
  const op = await t.signInParent();
  await t.db
    .update(authUsers)
    .set({ email: 'operator@example.com' })
    .where(eq(authUsers.id, op.userId));
  return op;
}

describe('POST /v1/error-reports (Send error report button)', () => {
  it('stores an anonymous report without signing in, and logs its reference code', async () => {
    const res = await t.app.request('/v1/error-reports', jsonRequest('POST', report('RD-VDMW5E')));
    expect(res.status).toBe(202);
    const rows = await t.db.select().from(errorReports).where(eq(errorReports.ref, 'RD-VDMW5E'));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ screen: '/map', apiPath: '/v1/student/map', status: 404 });
    expect(logged.at(-1)).toEqual({
      source: 'error-report',
      ref: 'RD-VDMW5E',
      screen: '/map',
      apiPath: '/v1/student/map',
      status: 404,
    });
  });

  it('accepts the same report twice without storing it twice', async () => {
    await t.app.request('/v1/error-reports', jsonRequest('POST', report('RD-7K2M9Q')));
    const again = await t.app.request(
      '/v1/error-reports',
      jsonRequest('POST', report('RD-7K2M9Q')),
    );
    expect(again.status).toBe(202);
    const rows = await t.db.select().from(errorReports).where(eq(errorReports.ref, 'RD-7K2M9Q'));
    expect(rows).toHaveLength(1);
  });

  it('refuses a report with a nickname, an id or free text in it', async () => {
    for (const bad of [
      report('RD-AAAAAA', { nickname: 'sam' }),
      report('RD-AAAAAB', { screen: '/family/8f6d2b1e-4c3a-4d5e-9f00-000000000001/rewards' }),
      report('RD-AAAAAC', { message: 'it broke' }),
    ]) {
      const res = await t.app.request('/v1/error-reports', jsonRequest('POST', bad));
      expect(res.status).toBe(400);
    }
  });
});

describe('GET /v1/admin/error-reports', () => {
  it('groups reports since a time by screen, API path and status, for the operator', async () => {
    await t.app.request(
      '/v1/error-reports',
      jsonRequest(
        'POST',
        report('RD-BBBBBB', { screen: '/cards', apiPath: undefined, status: undefined }),
      ),
    );
    const op = await signInOperator();
    const res = await t.app.request('/v1/admin/error-reports?since=2026-11-24T00:00:00.000Z', {
      headers: op.headers,
    });
    expect(res.status).toBe(200);
    const summary = ErrorReportSummarySchema.parse(await res.json());
    expect(summary.total).toBe(3);
    expect(summary.groups[0]).toMatchObject({
      screen: '/map',
      apiPath: '/v1/student/map',
      status: 404,
      count: 2,
      builds: ['00.01.002-48657ff'],
    });
    expect(summary.groups[0]!.refs.sort()).toEqual(['RD-7K2M9Q', 'RD-VDMW5E']);
    expect(summary.groups[1]).toMatchObject({
      screen: '/cards',
      apiPath: null,
      status: null,
      count: 1,
    });
  });

  it('is hidden (404) from parents without the operator role', async () => {
    const parent = await t.signInParent();
    const res = await t.app.request('/v1/admin/error-reports', { headers: parent.headers });
    expect(res.status).toBe(404);
  });
});

describe('groupErrorReports', () => {
  it('orders groups by count, then by the latest report', () => {
    const at = (iso: string) => new Date(iso);
    const summary = groupErrorReports(
      [
        {
          ref: 'RD-000001',
          screen: '/a',
          apiPath: null,
          status: null,
          build: 'b1',
          createdAt: at('2026-11-25T01:00:00Z'),
        },
        {
          ref: 'RD-000002',
          screen: '/b',
          apiPath: '/v1/x',
          status: 500,
          build: 'b1',
          createdAt: at('2026-11-25T02:00:00Z'),
        },
        {
          ref: 'RD-000003',
          screen: '/b',
          apiPath: '/v1/x',
          status: 500,
          build: 'b2',
          createdAt: at('2026-11-25T03:00:00Z'),
        },
      ],
      at('2026-11-24T00:00:00Z'),
    );
    expect(summary.groups.map((g) => [g.screen, g.count])).toEqual([
      ['/b', 2],
      ['/a', 1],
    ]);
    expect(summary.groups[0]).toMatchObject({
      refs: ['RD-000003', 'RD-000002'],
      builds: ['b2', 'b1'],
      firstSeen: '2026-11-25T02:00:00.000Z',
      lastSeen: '2026-11-25T03:00:00.000Z',
    });
  });
});

describe('error report retention', () => {
  it('deletes reports older than 90 days', async () => {
    const old = new Date('2026-08-01T00:00:00Z');
    await t.db.insert(errorReports).values({
      ref: 'RD-CCCCCC',
      screen: '/map',
      build: 'b',
      browser: 'Chrome',
      online: true,
      reportedAt: old,
      createdAt: old,
    });
    const deleted = await deleteExpiredErrorReports(t.db, new Date('2026-11-25T00:00:00Z'));
    expect(deleted).toBe(1);
    const left = await t.db.select().from(errorReports).where(eq(errorReports.ref, 'RD-CCCCCC'));
    expect(left).toEqual([]);
  });
});
