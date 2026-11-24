import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

let client: PGlite;

beforeAll(async () => {
  ({ client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

describe('verification tables', () => {
  it('creates the report, quarantine, review queue and re-check tables', async () => {
    const res = await client.query<{ table_name: string }>(
      `select table_name from information_schema.tables where table_schema = 'public'`,
    );
    const tables = res.rows.map((r) => r.table_name);
    for (const t of [
      'reviewer_roles',
      'item_reports',
      'quarantined_items',
      'review_batches',
      'review_batch_items',
      'recheck_requests',
      'recalculation_jobs',
    ]) {
      expect(tables).toContain(t);
    }
  });

  it('only accepts known reviewer roles', async () => {
    await client.query(`insert into auth_users (id, email) values ('rv-1', 'rv1@example.com')`);
    await expect(
      client.query(`insert into reviewer_roles (auth_user_id, role) values ('rv-1', 'headteacher')`),
    ).rejects.toThrow(/reviewer_roles_role_values/);
  });

  it('removes a family\u2019s reports when the family is deleted', async () => {
    const { rows } = await client.query<{ id: string }>(
      `insert into families default values returning id`,
    );
    const family = rows[0]!.id;
    await client.query(
      `insert into item_reports (item_id, item_version, reason, reported_by, family_id)
       values ('fixture-item', 1, 'unclear', 'student', $1)`,
      [family],
    );
    await client.query(`delete from families where id = $1`, [family]);
    const left = await client.query(`select * from item_reports where family_id = $1`, [family]);
    expect(left.rows).toHaveLength(0);
  });

  it('stores no free-text report field that could hold personal data', async () => {
    const res = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'item_reports'`,
    );
    const columns = res.rows.map((r) => r.column_name);
    expect(columns).not.toContain('detail');
    expect(columns).not.toContain('message');
    expect(columns).not.toContain('student_id');
  });
});
