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

describe('parent-set rewards table (workstream R)', () => {
  it('stores a real-world reward tied to a catalogue reward, not yet given', async () => {
    const studentId = await makeStudent('r_kid_one');
    await client.query(
      `insert into parent_rewards (student_id, title, target_kind, reward_id)
       values ('${studentId}', 'Cinema trip', 'reward', 'streak-100')`,
    );
    const res = await client.query<Record<string, unknown>>(
      `select title, target_kind, reward_id, stat, at_least, given_at from parent_rewards
       where student_id = '${studentId}'`,
    );
    expect(res.rows[0]).toEqual({
      title: 'Cinema trip',
      target_kind: 'reward',
      reward_id: 'streak-100',
      stat: null,
      at_least: null,
      given_at: null,
    });
  });

  it('stores a reward tied to a stat target', async () => {
    const studentId = await makeStudent('r_kid_two');
    await client.query(
      `insert into parent_rewards (student_id, title, target_kind, stat, at_least)
       values ('${studentId}', 'New game', 'stat', 'level', 20)`,
    );
    const res = await client.query<{ n: number }>(
      `select count(*)::int as n from parent_rewards where student_id = '${studentId}'`,
    );
    expect(res.rows[0]!.n).toBe(1);
  });

  it('stores an optional note and a custom date target', async () => {
    const studentId = await makeStudent('r_kid_five');
    await client.query(
      `insert into parent_rewards (student_id, title, note, target_kind, target_date)
       values ('${studentId}', 'Day out', 'You pick where', 'date', '2027-02-14')`,
    );
    const res = await client.query<{ note: string; target_date: string }>(
      `select note, target_date::text from parent_rewards where student_id = '${studentId}'`,
    );
    expect(res.rows[0]).toEqual({ note: 'You pick where', target_date: '2027-02-14' });
    await expect(
      client.query(
        `insert into parent_rewards (student_id, title, target_kind)
         values ('${studentId}', 'No date', 'date')`,
      ),
    ).rejects.toThrow();
  });

  it('rejects a reward without a complete target', async () => {
    const studentId = await makeStudent('r_kid_three');
    await expect(
      client.query(
        `insert into parent_rewards (student_id, title, target_kind)
         values ('${studentId}', 'Pizza night', 'reward')`,
      ),
    ).rejects.toThrow();
    await expect(
      client.query(
        `insert into parent_rewards (student_id, title, target_kind, stat, at_least)
         values ('${studentId}', 'Pizza night', 'stat', 'level', 0)`,
      ),
    ).rejects.toThrow();
  });

  it('removes parent rewards when the student is deleted', async () => {
    const studentId = await makeStudent('r_kid_four');
    await client.query(
      `insert into parent_rewards (student_id, title, target_kind, reward_id)
       values ('${studentId}', 'Day out', 'reward', 'streak-7')`,
    );
    await client.query(`delete from students where id = '${studentId}'`);
    const res = await client.query<{ n: number }>(
      `select count(*)::int as n from parent_rewards where student_id = '${studentId}'`,
    );
    expect(res.rows[0]!.n).toBe(0);
  });
});
