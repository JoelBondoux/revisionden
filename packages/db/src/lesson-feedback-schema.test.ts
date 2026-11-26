import { afterAll, beforeAll, describe, expect, it } from 'vitest';
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
});
