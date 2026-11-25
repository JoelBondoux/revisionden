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

async function student(): Promise<string> {
  const family = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  const res = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ($1, 'daily_kid', 'a1', 10) returning id`,
    [family.rows[0]!.id],
  );
  return res.rows[0]!.id;
}

describe('daily 5-a-day sets (workstream Q)', () => {
  it('keeps one set of item ids per student per day', async () => {
    const id = await student();
    await client.query(
      `insert into daily_sets (student_id, day, item_ids) values ($1, '2026-11-25', '["a","b"]')`,
      [id],
    );
    await expect(
      client.query(
        `insert into daily_sets (student_id, day, item_ids) values ($1, '2026-11-25', '[]')`,
        [id],
      ),
    ).rejects.toThrow();
    const rows = await client.query<{ item_ids: string[] }>(
      `select item_ids from daily_sets where student_id = $1`,
      [id],
    );
    expect(rows.rows[0]!.item_ids).toEqual(['a', 'b']);
  });

  it('is deleted with the student', async () => {
    const id = await student();
    await client.query(
      `insert into daily_sets (student_id, day, item_ids) values ($1, '2026-11-25', '[]')`,
      [id],
    );
    await client.query(`delete from students where id = $1`, [id]);
    const rows = await client.query(`select 1 from daily_sets where student_id = $1`, [id]);
    expect(rows.rows).toEqual([]);
  });
});
