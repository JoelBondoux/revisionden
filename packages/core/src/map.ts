/**
 * The topic map (workstream A's Map tab) built from real data (workstream F2).
 *
 * - Units are the top-level topics of a subject's topic tree; each unit shows its leaf topics in
 *   specification order.
 * - Topic state: locked when no item may be served yet; mastered at 80% or more; a weak spot when
 *   the student has tried it and is below 60%; otherwise in progress (including not tried yet).
 * - Unit mastery is the average of its open (not locked) topics; the unit challenge unlocks at 80%.
 * - A subject with no question that may be served yet is `coming_soon` (owner bug RD-MBXKTC):
 *   the Map tab shows a friendly empty state and a subject switcher, never an error.
 * - Next mission follows the next-item rule (weak spots first, weakest first): the weakest weak
 *   spot, else the first topic not yet mastered, else a review of the weakest mastered topic.
 */
import { z } from 'zod';
import { WEAK_SPOT_THRESHOLD } from './mastery';
import { MASTERED_TOPIC_PERCENT } from './reward-stats';

export const UNIT_CHALLENGE_PERCENT = MASTERED_TOPIC_PERCENT;
const MISSION_MINUTES = 5;

// Schemas (shared with apps/web; moved from its temporary local schemas) ---------------------

export const TopicStatusSchema = z.enum(['mastered', 'in-progress', 'weak', 'locked']);
export type TopicStatus = z.infer<typeof TopicStatusSchema>;

export const MapTopicSchema = z.object({
  id: z.string(),
  title: z.string(),
  lessonId: z.string(),
  status: TopicStatusSchema,
  /** Topic mastery, 0 to 100. */
  mastery: z.number().int().min(0).max(100),
});
export type MapTopic = z.infer<typeof MapTopicSchema>;

export const UnitChallengeSchema = z.object({
  lessonId: z.string(),
  unlockAtPercent: z.number().int().min(0).max(100),
  unlocked: z.boolean(),
});
export type UnitChallenge = z.infer<typeof UnitChallengeSchema>;

export const MapUnitSchema = z.object({
  id: z.string(),
  title: z.string(),
  masteryPercent: z.number().int().min(0).max(100),
  topics: z.array(MapTopicSchema),
  challenge: UnitChallengeSchema,
});
export type MapUnit = z.infer<typeof MapUnitSchema>;

export const NextMissionSchema = z.object({
  kind: z.enum(['weak-spot', 'continue', 'review']),
  title: z.string(),
  lessonId: z.string(),
  minutes: z.number().int().positive(),
});
export type NextMission = z.infer<typeof NextMissionSchema>;

/** One of the student's subjects, for the Map tab's subject switcher. */
export const MapSubjectSchema = z.object({
  subjectId: z.string(),
  subject: z.string(),
  /** False while no question in the subject may be served yet ("coming soon"). */
  hasContent: z.boolean(),
});
export type MapSubject = z.infer<typeof MapSubjectSchema>;

export const TopicMapSchema = z.object({
  /** Optional so older stored or mocked maps still parse; the API always sends them. */
  subjectId: z.string().optional(),
  /** `coming_soon` while the subject has no question that may be served (RD-MBXKTC). */
  status: z.enum(['ready', 'coming_soon']).optional(),
  subjects: z.array(MapSubjectSchema).optional(),
  subject: z.string(),
  qualification: z.string(),
  streakDays: z.number().int().nonnegative(),
  xpToday: z.number().int().nonnegative(),
  dailyGoalXp: z.number().int().positive(),
  nextMission: NextMissionSchema.nullable(),
  units: z.array(MapUnitSchema),
});
export type TopicMap = z.infer<typeof TopicMapSchema>;

export const CardsDueSchema = z.object({
  due: z.number().int().nonnegative(),
});
export type CardsDue = z.infer<typeof CardsDueSchema>;

// Building the map ----------------------------------------------------------------------------

export interface MapTopicInput {
  id: string;
  title: string;
  parentTopicId: string | null;
  /** Order in the topic tree (specification order). */
  position: number;
  /** Items in this topic that may be served to the student. */
  servableItems: number;
}

export interface BuildTopicMapInput {
  subjectId: string;
  tier: string;
  topics: readonly MapTopicInput[];
  /** Mastery 0–100 for topics the student has tried. */
  mastery: ReadonlyMap<string, number>;
  progress: { xpToday: number; dailyGoalXp: number; streakDays: number };
  /** The student's subjects in enrolment order, for the subject switcher. */
  subjects?: readonly { subjectId: string; hasContent: boolean }[];
}

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

/** "gcse-maths" + "higher" → { subject: "Maths", qualification: "GCSE Higher" }. */
export function subjectNames(subjectId: string, tier: string) {
  let rest = subjectId;
  let level = '';
  if (rest.startsWith('gcse-')) {
    level = 'GCSE';
    rest = rest.slice(5);
  } else if (rest.startsWith('a-level-')) {
    level = 'A-Level';
    rest = rest.slice(8);
  }
  const tierName = tier === 'higher' || tier === 'foundation' ? capitalise(tier) : '';
  return {
    subject: rest.split('-').map(capitalise).join(' '),
    qualification: [level, tierName].filter(Boolean).join(' '),
  };
}

function topicStatus(topic: MapTopicInput, mastery: number | undefined): TopicStatus {
  if (topic.servableItems === 0) return 'locked';
  if (mastery === undefined) return 'in-progress';
  if (mastery >= MASTERED_TOPIC_PERCENT) return 'mastered';
  return mastery < WEAK_SPOT_THRESHOLD ? 'weak' : 'in-progress';
}

function nextMission(topics: MapTopic[]): NextMission | null {
  const open = topics.filter((t) => t.status !== 'locked');
  const weakest = (list: MapTopic[]) =>
    list.reduce<MapTopic | undefined>(
      (low, t) => (!low || t.mastery < low.mastery ? t : low),
      undefined,
    );
  const weak = weakest(open.filter((t) => t.status === 'weak'));
  if (weak) return mission('weak-spot', `Fix weak spot: ${weak.title}`, weak);
  const next = open.find((t) => t.status === 'in-progress');
  if (next) return mission('continue', `Continue: ${next.title}`, next);
  const review = weakest(open);
  return review ? mission('review', `Review: ${review.title}`, review) : null;
}

const mission = (kind: NextMission['kind'], title: string, topic: MapTopic): NextMission => ({
  kind,
  title,
  lessonId: topic.lessonId,
  minutes: MISSION_MINUTES,
});

export function buildTopicMap(input: BuildTopicMapInput): TopicMap {
  const byPosition = [...input.topics].sort((a, b) => a.position - b.position);
  const children = new Map<string, MapTopicInput[]>();
  for (const t of byPosition) {
    if (t.parentTopicId !== null) {
      children.set(t.parentTopicId, [...(children.get(t.parentTopicId) ?? []), t]);
    }
  }
  const leavesUnder = (id: string): MapTopicInput[] =>
    (children.get(id) ?? []).flatMap((c) => (children.has(c.id) ? leavesUnder(c.id) : [c]));

  const units: MapUnit[] = [];
  for (const root of byPosition.filter((t) => t.parentTopicId === null)) {
    const topics = leavesUnder(root.id).map((leaf): MapTopic => {
      const tried = input.mastery.get(leaf.id);
      return {
        id: leaf.id,
        title: leaf.title,
        lessonId: leaf.id,
        status: topicStatus(leaf, tried),
        mastery: tried ?? 0,
      };
    });
    if (topics.length === 0) continue;
    const open = topics.filter((t) => t.status !== 'locked');
    const masteryPercent =
      open.length === 0 ? 0 : Math.round(open.reduce((sum, t) => sum + t.mastery, 0) / open.length);
    units.push({
      id: root.id,
      title: root.title,
      masteryPercent,
      topics,
      challenge: {
        lessonId: root.id,
        unlockAtPercent: UNIT_CHALLENGE_PERCENT,
        unlocked: masteryPercent >= UNIT_CHALLENGE_PERCENT,
      },
    });
  }

  const open = units.some((u) => u.topics.some((t) => t.status !== 'locked'));
  return {
    subjectId: input.subjectId,
    status: open ? 'ready' : 'coming_soon',
    subjects: (input.subjects ?? []).map((s) => ({
      subjectId: s.subjectId,
      subject: subjectNames(s.subjectId, 'none').subject,
      hasContent: s.hasContent,
    })),
    ...subjectNames(input.subjectId, input.tier),
    streakDays: input.progress.streakDays,
    xpToday: input.progress.xpToday,
    dailyGoalXp: input.progress.dailyGoalXp,
    nextMission: nextMission(units.flatMap((u) => u.topics)),
    units,
  };
}
