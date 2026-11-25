import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

let client: PGlite;
let n = 0;

beforeAll(async () => {
  ({ client } = await createTestDb());
});

afterAll(async () => {
  await client.close();
});

async function family(): Promise<string> {
  const res = await client.query<{ id: string }>('insert into families default values returning id');
  return res.rows[0]!.id;
}

async function user(): Promise<string> {
  n += 1;
  const id = `two-parents-user-${n}`;
  await client.query('insert into auth_users (id, email) values ($1, $2)', [
    id,
    `tp${n}@example.com`,
  ]);
  return id;
}

async function parent(familyId: string, position?: number) {
  const authUserId = await user();
  const res = await client.query<{ id: string; position: number }>(
    position === undefined
      ? 'insert into parents (family_id, auth_user_id) values ($1, $2) returning id, position'
      : 'insert into parents (family_id, auth_user_id, position) values ($1, $2, $3) returning id, position',
    position === undefined ? [familyId, authUserId] : [familyId, authUserId, position],
  );
  return { ...res.rows[0]!, authUserId };
}

describe('two parents', () => {
  it('makes the first parent Parent 1', async () => {
    const p = await parent(await family());
    expect(p.position).toBe(1);
  });

  it('allows a Parent 2 in the same family, but not two Parent 1s or a Parent 3', async () => {
    const f = await family();
    await parent(f, 1);
    await parent(f, 2);
    await expect(parent(f, 1)).rejects.toThrow(/parents_family_position_unique/);
    await expect(parent(f, 3)).rejects.toThrow(/parents_position_range/);
  });

  it('stores invites only as a hash, deleted with the family', async () => {
    const f = await family();
    const p = await parent(f);
    await client.query(
      `insert into parent_invites (family_id, code_hash, created_by_parent_id, expires_at)
       values ($1, 'hash-1', $2, now() + interval '7 days')`,
      [f, p.id],
    );
    const cols = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'parent_invites'`,
    );
    expect(cols.rows.map((r) => r.column_name)).not.toContain('code');
    await client.query('delete from families where id = $1', [f]);
    const left = await client.query(`select 1 from parent_invites where code_hash = 'hash-1'`);
    expect(left.rows).toHaveLength(0);
  });

  it('keeps a family activity log that names parents only by number', async () => {
    const f = await family();
    await client.query(
      `insert into family_events (family_id, actor_position, kind, important) values ($1, 2, 'child_added', true)`,
      [f],
    );
    const cols = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'family_events'`,
    );
    const names = cols.rows.map((r) => r.column_name);
    expect(names).toContain('actor_position');
    expect(names).not.toContain('email');
    expect(names).not.toContain('auth_user_id');
  });

  it('remembers a removed parent so they can be told, until they have seen it', async () => {
    const id = await user();
    await client.query('insert into parent_removal_notices (auth_user_id) values ($1)', [id]);
    await client.query('delete from auth_users where id = $1', [id]);
    const left = await client.query('select 1 from parent_removal_notices where auth_user_id = $1', [
      id,
    ]);
    expect(left.rows).toHaveLength(0);
  });

  it('records which parent asked to delete the family', async () => {
    const res = await client.query<{
      deletion_requested_by: number | null;
      deletion_requested_at: Date | null;
    }>('insert into families default values returning deletion_requested_by, deletion_requested_at');
    expect(res.rows[0]).toEqual({ deletion_requested_by: null, deletion_requested_at: null });
  });
});
