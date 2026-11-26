import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { PGlite } from '@electric-sql/pglite';
import { createTestDb } from './testing';

// "Did this help?" after an interactive lesson (W8): one tap, an item, never any text.
let client: PGlite;
let family: string;
let item: string;

beforeAll(async () => {
  ({ client } = await createTestDb());
  family = (await client.query<{ id: string }>(`insert into families default values returning id`))
    .rows[0]!.id;
  await client.query(
    `insert into topics (id, subject_id, board, title, position) values ('t-a4', 's', 'b', 'A4', 0)`,
  );
  item = (
    await client.query<{ id: string }>(
      `insert into items (content_id, topic_id, type, difficulty, status, version, body, answer)
       values ('area-1', 't-a4', 'area_model', 1, 'draft', 1, '{}', '{}') returning id`,
    )
  ).rows[0]!.id;
});

afterAll(async () => {
  await client.close();
});

describe('lesson feedback in the feedback table', () => {
  it('stores "it helped" and "it did not help" with the item', async () => {
    for (const kind of ['lesson_helped', 'lesson_not_helped']) {
      const { rows } = await client.query<{ kind: string; item_id: string }>(
        `insert into feedback (family_id, sender_role, kind, item_id) values ($1, 'student', $2, $3)
         returning kind, item_id`,
        [family, kind, item],
      );
      expect(rows[0]).toEqual({ kind, item_id: item });
    }
  });

  it('refuses lesson feedback with text or without an item', async () => {
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind, item_id, text) values ($1, 'student', 'lesson_helped', $2, 'hi')`,
        [family, item],
      ),
    ).rejects.toThrow(/feedback_lesson_tap/);
    await expect(
      client.query(
        `insert into feedback (family_id, sender_role, kind) values ($1, 'student', 'lesson_not_helped')`,
        [family],
      ),
    ).rejects.toThrow(/feedback_lesson_tap/);
  });

  it('keeps one tap per student and item, so a second tap updates the first (W8b, Codex P2)', async () => {
    const student = (
      await client.query<{ id: string }>(
        `insert into students (family_id, nickname, avatar_code, year_group)
         values ($1, 'tap_kid', '1' || repeat('0', 28), 11) returning id`,
        [family],
      )
    ).rows[0]!.id;
    const tap = (kind: string) =>
      client.query(
        `insert into feedback (family_id, sender_role, student_id, kind, item_id)
         values ($1, 'student', $2, $3, $4)`,
        [family, student, kind, item],
      );
    await tap('lesson_helped');
    await expect(tap('lesson_not_helped')).rejects.toThrow(/feedback_lesson_tap_unique/);
    // The upsert the route uses: its conflict target repeats the partial index's predicate.
    await client.query(
      `insert into feedback (family_id, sender_role, student_id, kind, item_id)
       values ($1, 'student', $2, 'lesson_not_helped', $3)
       on conflict (student_id, item_id) where kind in ('lesson_helped', 'lesson_not_helped')
       do update set kind = excluded.kind`,
      [family, student, item],
    );
    const { rows } = await client.query<{ kind: string }>(
      `select kind from feedback where student_id = $1 and item_id = $2`,
      [student, item],
    );
    expect(rows).toEqual([{ kind: 'lesson_not_helped' }]);
  });

  it('migration 0033 keeps only the newest of any duplicate taps before adding the index', async () => {
    const student = (
      await client.query<{ id: string }>(
        `insert into students (family_id, nickname, avatar_code, year_group)
         values ($1, 'dupe_kid', '1' || repeat('0', 28), 11) returning id`,
        [family],
      )
    ).rows[0]!.id;
    // As if two taps had raced in before the index existed.
    await client.query(`drop index feedback_lesson_tap_unique`);
    await client.query(
      `insert into feedback (family_id, sender_role, student_id, kind, item_id, created_at)
       values ($1, 'student', $2, 'lesson_helped', $3, '2026-11-26T10:00:00Z'),
              ($1, 'student', $2, 'lesson_not_helped', $3, '2026-11-26T10:05:00Z')`,
      [family, student, item],
    );
    const migration = readFileSync(
      new URL('../migrations/0033_lesson_tap_unique.sql', import.meta.url),
      'utf8',
    );
    for (const statement of migration.split('--> statement-breakpoint')) {
      await client.query(statement);
    }
    const { rows } = await client.query<{ kind: string }>(
      `select kind from feedback where student_id = $1 and item_id = $2`,
      [student, item],
    );
    expect(rows).toEqual([{ kind: 'lesson_not_helped' }]);
  });
});
