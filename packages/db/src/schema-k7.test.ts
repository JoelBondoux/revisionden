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

async function makeStudent(nickname: string): Promise<string> {
  const fam = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  const st = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ('${fam.rows[0]!.id}', '${nickname}', 'a1', 10) returning id`,
  );
  return st.rows[0]!.id;
}

describe('daily limits table (workstream K7)', () => {
  it('starts on the defaults: no own limits and no exam-season extra', async () => {
    const studentId = await makeStudent('k7_kid_one');
    await client.query(`insert into daily_limits (student_id) values ('${studentId}')`);
    const res = await client.query<Record<string, unknown>>(
      `select weekday_minutes, other_day_minutes, exam_season_extra, pending_suggestion
       from daily_limits where student_id = '${studentId}'`,
    );
    expect(res.rows[0]).toEqual({
      weekday_minutes: null,
      other_day_minutes: null,
      exam_season_extra: false,
      pending_suggestion: null,
    });
  });

  it('keeps limits between 15 minutes and 6 hours', async () => {
    const studentId = await makeStudent('k7_kid_two');
    await expect(
      client.query(
        `insert into daily_limits (student_id, weekday_minutes) values ('${studentId}', 5)`,
      ),
    ).rejects.toThrow();
    await expect(
      client.query(
        `insert into daily_limits (student_id, other_day_minutes) values ('${studentId}', 400)`,
      ),
    ).rejects.toThrow();
  });

  it('is removed with the student', async () => {
    const studentId = await makeStudent('k7_kid_three');
    await client.query(`insert into daily_limits (student_id) values ('${studentId}')`);
    await client.query(`delete from students where id = '${studentId}'`);
    const res = await client.query(`select 1 from daily_limits where student_id = '${studentId}'`);
    expect(res.rows).toHaveLength(0);
  });
});
