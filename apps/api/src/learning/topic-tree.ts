import { inArray } from 'drizzle-orm';
import { topics, type Database } from '@revisionden/db';

/** A topic and every topic below it (a unit challenge covers the whole unit). */
export async function topicAndDescendants(db: Database, topicId: string): Promise<string[]> {
  const found = [topicId];
  let frontier = [topicId];
  while (frontier.length > 0) {
    const children = await db
      .select({ id: topics.id })
      .from(topics)
      .where(inArray(topics.parentTopicId, frontier));
    frontier = children.map((c) => c.id).filter((id) => !found.includes(id));
    found.push(...frontier);
  }
  return found;
}
