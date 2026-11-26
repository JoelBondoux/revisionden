import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

let client: PGlite;
let ids: Record<'nova' | 'quill' | 'orbit', string>;

const AVATAR = '10000000000000000000000000000';

async function student(familyId: string, nickname: string) {
  const { rows } = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ($1, $2, $3, 10) returning id`,
    [familyId, nickname, AVATAR],
  );
  return rows[0]!.id;
}

beforeAll(async () => {
  ({ client } = await createTestDb());
  const fam = async () =>
    (await client.query<{ id: string }>(`insert into families default values returning id`))
      .rows[0]!.id;
  const [f1, f2, f3] = [await fam(), await fam(), await fam()];
  ids = {
    nova: await student(f1, 'Nova_7'),
    quill: await student(f2, 'Quill_2'),
    orbit: await student(f3, 'Orbit_9'),
  };
});

afterAll(async () => {
  await client.close();
});

const lower = (a: string, b: string) => (a < b ? [a, b] : [b, a]);

describe('friends tables (FL)', () => {
  it('has friends off and the league visible by default', async () => {
    const { rows } = await client.query<{
      friends_allowed: boolean;
      league_hidden: boolean;
      league_wins: number;
    }>(`select friends_allowed, league_hidden, league_wins from students where id = $1`, [
      ids.nova,
    ]);
    expect(rows[0]).toEqual({ friends_allowed: false, league_hidden: false, league_wins: 0 });
  });

  it('stores a friendship once, lower id first', async () => {
    const [a, b] = lower(ids.nova, ids.quill);
    await client.query(`insert into friendships (student_a, student_b) values ($1, $2)`, [a, b]);
    await expect(
      client.query(`insert into friendships (student_a, student_b) values ($1, $2)`, [b, a]),
    ).rejects.toThrow();
    await expect(
      client.query(`insert into friendships (student_a, student_b) values ($1, $1)`, [a]),
    ).rejects.toThrow();
  });

  it('allows only the fixed report reasons', async () => {
    await expect(
      client.query(
        `insert into friend_reports (reporter_id, reported_id, reason) values ($1, $2, 'free text')`,
        [ids.nova, ids.orbit],
      ),
    ).rejects.toThrow();
    await client.query(
      `insert into friend_reports (reporter_id, reported_id, reason) values ($1, $2, 'pressured')`,
      [ids.nova, ids.orbit],
    );
  });

  it('keeps parent labels short', async () => {
    const [a, b] = lower(ids.quill, ids.orbit);
    await expect(
      client.query(`insert into friendships (student_a, student_b, label_a) values ($1, $2, $3)`, [
        a,
        b,
        'x'.repeat(31),
      ]),
    ).rejects.toThrow();
  });

  it('keeps one league result per child per week', async () => {
    await client.query(
      `insert into league_weeks (student_id, week_start, xp, place, won) values ($1, '2026-11-16', 120, 1, true)`,
      [ids.quill],
    );
    await expect(
      client.query(
        `insert into league_weeks (student_id, week_start, xp, place, won) values ($1, '2026-11-16', 5, 2, false)`,
        [ids.quill],
      ),
    ).rejects.toThrow();
    await client.query(`delete from league_weeks where student_id = $1`, [ids.quill]);
  });

  it('deletes friendships, codes, requests, blocks and reports with either child', async () => {
    await client.query(
      `insert into friend_codes (student_id, code_hash, expires_at) values ($1, 'h1', now())`,
      [ids.nova],
    );
    await client.query(
      `insert into friend_requests (from_student_id, to_student_id, expires_at) values ($1, $2, now())`,
      [ids.orbit, ids.nova],
    );
    await client.query(`insert into friend_blocks (blocker_id, blocked_id) values ($1, $2)`, [
      ids.orbit,
      ids.nova,
    ]);
    await client.query(
      `insert into friend_code_tries (student_id, family_id, ok)
       select id, family_id, false from students where id = $1`,
      [ids.nova],
    );
    await client.query(
      `insert into league_weeks (student_id, week_start, xp, won) values ($1, '2026-11-16', 0, false)`,
      [ids.nova],
    );
    await client.query(`delete from students where id = $1`, [ids.nova]);
    for (const table of [
      'friendships',
      'friend_codes',
      'friend_requests',
      'friend_blocks',
      'friend_reports',
      'friend_code_tries',
      'league_weeks',
    ]) {
      const { rows } = await client.query<{ n: number }>(`select count(*)::int as n from ${table}`);
      expect(rows[0]!.n, table).toBe(0);
    }
  });
});
