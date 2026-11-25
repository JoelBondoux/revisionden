import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, groupReports, parseSince } from './error-reports.mjs';

const NOW = new Date('2026-11-25T12:00:00Z');

test('since defaults to 24 hours ago and never goes back more than 90 days', () => {
  assert.equal(parseSince(undefined, NOW).toISOString(), '2026-11-24T12:00:00.000Z');
  assert.equal(parseSince('2026-11-25T06:00:00Z', NOW).toISOString(), '2026-11-25T06:00:00.000Z');
  assert.equal(parseSince('2020-01-01T00:00:00Z', NOW).toISOString(), '2026-08-27T12:00:00.000Z');
  assert.throws(() => parseSince('yesterday', NOW), /since must be a date/);
});

test('groups reports like GET /v1/admin/error-reports: most first, newest refs first', () => {
  const at = (iso) => new Date(iso);
  const summary = groupReports(
    [
      {
        ref: 'RD-000001',
        screen: '/a',
        api_path: null,
        status: null,
        build: 'b1',
        created_at: at('2026-11-25T01:00:00Z'),
      },
      {
        ref: 'RD-000002',
        screen: '/map',
        api_path: '/v1/student/map',
        status: 404,
        build: 'b1',
        created_at: at('2026-11-25T02:00:00Z'),
      },
      {
        ref: 'RD-000003',
        screen: '/map',
        api_path: '/v1/student/map',
        status: 404,
        build: 'b2',
        created_at: at('2026-11-25T03:00:00Z'),
      },
    ],
    at('2026-11-24T12:00:00Z'),
  );
  assert.equal(summary.total, 3);
  assert.deepEqual(
    summary.groups.map((g) => [g.screen, g.apiPath, g.status, g.count, g.refs]),
    [
      ['/map', '/v1/student/map', 404, 2, ['RD-000003', 'RD-000002']],
      ['/a', null, null, 1, ['RD-000001']],
    ],
  );
});

test('prints one readable line per group', () => {
  const text = formatSummary({
    since: '2026-11-24T12:00:00.000Z',
    total: 2,
    groups: [
      {
        screen: '/map',
        apiPath: '/v1/student/map',
        status: 404,
        count: 2,
        refs: ['RD-000003', 'RD-000002'],
        builds: ['b2', 'b1'],
        firstSeen: '2026-11-25T02:00:00.000Z',
        lastSeen: '2026-11-25T03:00:00.000Z',
      },
    ],
  });
  assert.match(text, /2 error reports since 2026-11-24T12:00:00.000Z/);
  assert.match(text, /2× \/map → \/v1\/student\/map 404 \(builds b2, b1\) RD-000003 RD-000002/);
  assert.match(formatSummary({ since: 'x', total: 0, groups: [] }), /No error reports since x/);
});
