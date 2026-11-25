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

async function columns(table: string): Promise<string[]> {
  const res = await client.query<{ column_name: string }>(
    `select column_name from information_schema.columns where table_name = $1`,
    [table],
  );
  return res.rows.map((r) => r.column_name);
}

async function student(): Promise<string> {
  const family = await client.query<{ id: string }>(
    `insert into families default values returning id`,
  );
  const res = await client.query<{ id: string }>(
    `insert into students (family_id, nickname, avatar_code, year_group)
     values ($1, 'test_kid', 'a1', 10) returning id`,
    [family.rows[0]!.id],
  );
  return res.rows[0]!.id;
}

describe('learning loop tables (workstream F)', () => {
  it('adds the content id, version, status, difficulty and tags to items', async () => {
    expect(await columns('items')).toEqual(
      expect.arrayContaining(['content_id', 'version', 'status', 'difficulty', 'tags']),
    );
  });

  it('records the item version, mode, XP and starting test on each attempt', async () => {
    expect(await columns('attempts')).toEqual(
      expect.arrayContaining(['item_version', 'mode', 'xp_earned', 'starting_test_id']),
    );
  });

  it('keeps what the streak rules need between days', async () => {
    expect(await columns('streaks')).toEqual(
      expect.arrayContaining(['skips_in_a_row', 'last_date', 'last_settled_week']),
    );
  });

  it('keeps learning points, expected times and retries for learning from mistakes (F5)', async () => {
    expect(await columns('items')).toEqual(
      expect.arrayContaining(['learning_point', 'expected_seconds']),
    );
    expect(await columns('attempts')).toEqual(expect.arrayContaining(['retry']));
    expect(await columns('review_points')).toEqual(
      expect.arrayContaining(['student_id', 'learning_point', 'topic_id', 'rung', 'due_day']),
    );
    const id = await student();
    const point = (learningPoint: string) =>
      client.query(
        `insert into review_points (student_id, learning_point, topic_id, rung, due_day)
         values ($1, $2, 't', 0, '2026-11-26')`,
        [id, learningPoint],
      );
    await point('lp-a');
    await expect(point('lp-a')).rejects.toThrow();
  });

  it('stores flashcards with their SM-2 state', async () => {
    expect(await columns('flashcards')).toEqual(
      expect.arrayContaining([
        'id',
        'student_id',
        'item_id',
        'topic_id',
        'origin',
        'front',
        'back',
        'repetitions',
        'interval_days',
        'ease',
        'due_at',
      ]),
    );
  });

  it('keeps one total of XP per student per day', async () => {
    const id = await student();
    await client.query(`insert into daily_xp (student_id, day, xp) values ($1, '2026-11-24', 10)`, [
      id,
    ]);
    await expect(
      client.query(`insert into daily_xp (student_id, day, xp) values ($1, '2026-11-24', 5)`, [id]),
    ).rejects.toThrow(/duplicate key/i);
  });

  it('only allows the three flashcard origins', async () => {
    const id = await student();
    await client.query(
      `insert into topics (id, subject_id, board, title) values ('t', 's', 'b', 'T')`,
    );
    await expect(
      client.query(
        `insert into flashcards (student_id, topic_id, origin, front, back) values ($1, 't', 'stolen', 'f', 'b')`,
        [id],
      ),
    ).rejects.toThrow(/check constraint/i);
  });

  it("keeps each topic's place in the topic tree (F2 map order)", async () => {
    expect(await columns('topics')).toContain('position');
  });

  it('records starting tests per student and subject', async () => {
    expect(await columns('starting_tests')).toEqual(
      expect.arrayContaining(['id', 'student_id', 'subject_id', 'item_ids', 'finished_at']),
    );
  });

  it('records flashcard sessions with the cards counted and the XP paid (F3)', async () => {
    expect(await columns('flashcard_sessions')).toEqual(
      expect.arrayContaining([
        'id',
        'student_id',
        'card_ids',
        'started_at',
        'finished_at',
        'completed',
        'xp_earned',
        'topic_id',
        'rewarded_day',
        'reward_slot',
      ]),
    );
  });

  it('allows each daily reward slot to be taken by one flashcard session only', async () => {
    const id = await student();
    const reward = (slot: number) =>
      client.query(
        `insert into flashcard_sessions (student_id, rewarded_day, reward_slot, xp_earned)
         values ($1, '2026-11-25', $2, 20)`,
        [id, slot],
      );
    await reward(1);
    await reward(2);
    await expect(reward(1)).rejects.toThrow();
    await expect(
      client.query(
        `insert into flashcard_sessions (student_id, rewarded_day, reward_slot) values ($1, '2026-11-25', 3)`,
        [id],
      ),
    ).rejects.toThrow();
  });
});
