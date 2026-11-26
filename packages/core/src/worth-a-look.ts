/**
 * "Worth a look together" (workstream K11): topics holding learning points the child has missed
 * on several review-ladder visits across days (F5 flags them). Parent dashboard only, never shown
 * to the child. Learning points are internal ids, so a parent sees topics and a count, not ids.
 */
import { z } from 'zod';

export const WorthALookTopicSchema = z.object({
  topicId: z.string().min(1),
  title: z.string().min(1),
  points: z.number().int().positive(),
});

export const WorthALookSchema = z.object({ topics: z.array(WorthALookTopicSchema) });

export type WorthALookTopic = z.infer<typeof WorthALookTopicSchema>;
export type WorthALook = z.infer<typeof WorthALookSchema>;

export interface FlaggedPoint {
  learningPoint: string;
  topicId: string;
  topicTitle: string;
}

/** One entry per topic, with how many flagged points it holds, in title order. */
export function groupWorthALook(points: readonly FlaggedPoint[]): WorthALook {
  const byTopic = new Map<string, WorthALookTopic>();
  for (const p of points) {
    const entry = byTopic.get(p.topicId);
    if (entry) entry.points += 1;
    else byTopic.set(p.topicId, { topicId: p.topicId, title: p.topicTitle, points: 1 });
  }
  const topics = [...byTopic.values()].sort((a, b) => a.title.localeCompare(b.title));
  return { topics };
}
