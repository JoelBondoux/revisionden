/**
 * Loading a student's flashcards, shared by the flashcard routes and the Cards tab badge (F2).
 * Only cards whose content may be served are returned (own cards have no item).
 */
import { and, asc, eq, inArray, isNull, or, type SQL } from 'drizzle-orm';
import type { Card } from '@revisionden/core';
import { enrolments, flashcards, items, topics, type Database } from '@revisionden/db';
import type { ItemRow } from './items';

type CardRow = typeof flashcards.$inferSelect;
type TopicRow = typeof topics.$inferSelect;
export interface Loaded {
  card: CardRow;
  item: ItemRow | null;
  topic: TopicRow;
}

export const toCard = (row: CardRow): Card => ({
  id: row.id,
  repetitions: row.repetitions,
  intervalDays: row.intervalDays,
  ease: row.ease,
  dueAt: row.dueAt.getTime(),
});

export function flashcardStore(db: Database, servable: SQL) {
  /** The student's cards whose content may be served (own cards have no item). */
  async function loadCards(studentId: string, where?: SQL): Promise<Loaded[]> {
    return db
      .select({ card: flashcards, item: items, topic: topics })
      .from(flashcards)
      .innerJoin(topics, eq(topics.id, flashcards.topicId))
      .leftJoin(items, eq(items.id, flashcards.itemId))
      .where(
        and(eq(flashcards.studentId, studentId), or(isNull(flashcards.itemId), servable), where),
      )
      .orderBy(asc(flashcards.dueAt), asc(flashcards.createdAt));
  }

  /** Makes a row for each servable deck card in the student's subjects not yet seen. */
  async function addNewDeckCards(studentId: string, now: Date) {
    const subjects = await db
      .select({ subjectId: enrolments.subjectId })
      .from(enrolments)
      .where(eq(enrolments.studentId, studentId));
    if (subjects.length === 0) return;
    const deck = await db
      .select({ itemId: items.id, topicId: items.topicId })
      .from(items)
      .innerJoin(topics, eq(topics.id, items.topicId))
      .where(
        and(
          servable,
          eq(items.type, 'flashcard'),
          inArray(
            topics.subjectId,
            subjects.map((s) => s.subjectId),
          ),
        ),
      );
    if (deck.length === 0) return;
    await db
      .insert(flashcards)
      .values(deck.map((d) => ({ studentId, ...d, origin: 'deck' as const, dueAt: now })))
      .onConflictDoNothing();
  }
  return { loadCards, addNewDeckCards };
}
