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

async function newFamily(): Promise<string> {
  const { rows } = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  return rows[0]!.id;
}

describe('feedback table (workstream L)', () => {
  it('stores feedback with the status new by default', async () => {
    const family = await newFamily();
    const { rows } = await client.query<{ status: string; closed_at: string | null }>(
      `insert into feedback (family_id, sender_role, kind, text) values ($1, 'parent', 'idea', 'More maths')
       returning status, closed_at`,
      [family],
    );
    expect(rows[0]).toEqual({ status: 'new', closed_at: null });
  });

  it('only accepts known kinds, sender roles and statuses', async () => {
    const family = await newFamily();
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind) values ($1, 'parent', 'rant')`,
        [family],
      ),
    ).rejects.toThrow(/feedback_kind_values/);
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind) values ($1, 'teacher', 'bug')`,
        [family],
      ),
    ).rejects.toThrow(/feedback_sender_role_values/);
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind, status) values ($1, 'parent', 'bug', 'done')`,
        [family],
      ),
    ).rejects.toThrow(/feedback_status_values/);
  });

  it('refuses text longer than 500 characters', async () => {
    const family = await newFamily();
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind, text) values ($1, 'parent', 'bug', $2)`,
        [family, 'a'.repeat(501)],
      ),
    ).rejects.toThrow(/feedback_text_length/);
  });

  it('removes a family’s feedback when the family is deleted', async () => {
    const family = await newFamily();
    await client.query(
      `insert into feedback (family_id, sender_role, kind) values ($1, 'parent', 'other')`,
      [family],
    );
    await client.query(`delete from families where id = $1`, [family]);
    const left = await client.query(`select * from feedback where family_id = $1`, [family]);
    expect(left.rows).toHaveLength(0);
  });
});

describe('policy acceptances table (workstream L)', () => {
  it('keeps one version per parent and policy, and nothing else', async () => {
    await client.query(`insert into auth_users (id, email) values ('pa-1', 'pa1@example.com')`);
    await client.query(
      `insert into policy_acceptances (auth_user_id, policy, version) values ('pa-1', 'terms-of-use', '1.0')`,
    );
    await expect(
      client.query(
        `insert into policy_acceptances (auth_user_id, policy, version) values ('pa-1', 'terms-of-use', '1.1')`,
      ),
    ).rejects.toThrow();
    const cols = await client.query<{ column_name: string }>(
      `select column_name from information_schema.columns where table_name = 'policy_acceptances'
       order by ordinal_position`,
    );
    expect(cols.rows.map((r) => r.column_name)).toEqual([
      'auth_user_id',
      'policy',
      'version',
      'accepted_at',
    ]);
  });

  it('records a confirmed bug with its reward, and a duplicate pointing at the first report', async () => {
    const family = await newFamily();
    const first = await client.query<{ id: string; outcome: string | null; reward_xp: number }>(
      `insert into feedback (family_id, sender_role, kind) values ($1, 'parent', 'bug')
       returning id, outcome, reward_xp`,
      [family],
    );
    expect(first.rows[0]).toMatchObject({ outcome: null, reward_xp: 0 });
    await client.query(
      `update feedback set outcome = 'confirmed', track_step = true, reward_xp = 50,
       confirmed_at = now() where id = $1`,
      [first.rows[0]!.id],
    );
    const dup = await client.query<{ duplicate_of: string }>(
      `insert into feedback (family_id, sender_role, kind, outcome, duplicate_of)
       values ($1, 'parent', 'bug', 'duplicate', $2) returning duplicate_of`,
      [family, first.rows[0]!.id],
    );
    expect(dup.rows[0]!.duplicate_of).toBe(first.rows[0]!.id);
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind, outcome) values ($1, 'parent', 'bug', 'maybe')`,
        [family],
      ),
    ).rejects.toThrow(/feedback_outcome_values/);
  });

  it('records a Not-a-bug outcome with its time, and the student bug button reset time (L13)', async () => {
    const family = await newFamily();
    const student = await client.query<{ id: string; bug_button_reset_at: string | null }>(
      `insert into students (family_id, nickname, avatar_code, year_group)
       values ($1, 'Tester', 'a1', 10) returning id, bug_button_reset_at`,
      [family],
    );
    expect(student.rows[0]!.bug_button_reset_at).toBeNull();
    const { rows } = await client.query<{ outcome: string; not_a_bug_at: string | null }>(
      `insert into feedback (family_id, sender_role, student_id, kind, outcome, not_a_bug_at)
       values ($1, 'student', $2, 'bug', 'not_a_bug', now()) returning outcome, not_a_bug_at`,
      [family, student.rows[0]!.id],
    );
    expect(rows[0]!.outcome).toBe('not_a_bug');
    expect(rows[0]!.not_a_bug_at).not.toBeNull();
  });
});
