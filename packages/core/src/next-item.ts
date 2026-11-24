/**
 * Next-item selection (see docs/PRODUCT_RULES.md "Parent focus").
 *
 * 1. Shares. Each topic's weight is (100 - mastery) + 5, so weaker topics get more and mastered
 *    topics still come up now and then. A subject's share is the sum of its topics' weights, so
 *    the weakest topic overall gets the most picks.
 * 2. Parent focus. The nudge's points (light +10, medium +22, strong +38) are added to the focus
 *    subject's (or topic's) share before normalising back to 100.
 * 3. Draw. Topics for each slot are drawn by share with seeded randomness.
 * 4. Order. Weak spots (mastery below 60) come first, weakest first; then the rest, weakest
 *    first. Parent focus changes how many picks a topic gets, never this order.
 * 5. Variety. Never more than 3 items in a row from one topic, counting the items served just
 *    before this batch. If that cannot be kept (for example only one topic has items) the batch
 *    is cut short instead.
 * 6. Within a topic, due flashcards come before questions; flashcards not yet due are skipped.
 */
import { isWeakSpot } from './mastery';
import { weightedPick, type Rng } from './rng';

export type Nudge = 'light' | 'medium' | 'strong';

export const FOCUS_POINTS: Record<Nudge, number> = { light: 10, medium: 22, strong: 38 };
export const MAX_IN_A_ROW = 3;
const MIN_TOPIC_WEIGHT = 5;

export interface TopicState {
  topicId: string;
  subjectId: string;
  /** 0 to 100. */
  mastery: number;
}

export interface ParentFocus {
  kind: 'subject' | 'topic';
  id: string;
  nudge: Nudge;
}

export interface Candidate {
  itemId: string;
  topicId: string;
  kind: 'question' | 'flashcard';
  /** For flashcards: whether the card is due now. */
  due?: boolean;
}

export interface SelectNextItemsInput {
  topics: readonly TopicState[];
  candidates: readonly Candidate[];
  count: number;
  rng: Rng;
  focus?: ParentFocus;
  /** Topics of the items served just before, oldest first, so variety carries across batches. */
  recentTopicIds?: readonly string[];
}

/** Adds `points` to one key's percentage share, then scales everything back to 100. */
function boost<K>(shares: Map<K, number>, key: K, points: number): Map<K, number> {
  const current = shares.get(key);
  if (current === undefined) return shares;
  const scale = 100 / (100 + points);
  const result = new Map<K, number>();
  for (const [k, share] of shares) result.set(k, (k === key ? share + points : share) * scale);
  return result;
}

const topicWeight = (t: TopicState) => 100 - t.mastery + MIN_TOPIC_WEIGHT;

function subjectWeights(topics: readonly TopicState[]): Map<string, number> {
  const weights = new Map<string, number>();
  for (const t of topics)
    weights.set(t.subjectId, (weights.get(t.subjectId) ?? 0) + topicWeight(t));
  return weights;
}

/** Percentage of the session for each subject, including any parent focus on a subject. */
export function subjectShares(
  topics: readonly TopicState[],
  focus?: ParentFocus,
): Record<string, number> {
  const weights = subjectWeights(topics);
  let total = 0;
  for (const w of weights.values()) total += w;
  let shares = new Map([...weights].map(([subjectId, w]) => [subjectId, (100 * w) / total]));
  if (focus?.kind === 'subject') shares = boost(shares, focus.id, FOCUS_POINTS[focus.nudge]);
  return Object.fromEntries(shares);
}

/** Percentage of the session for each topic, including any parent focus. */
export function topicShares(
  topics: readonly TopicState[],
  focus?: ParentFocus,
): Map<string, number> {
  const subjects = subjectShares(topics, focus);
  const weights = subjectWeights(topics);
  let shares = new Map(
    topics.map((t) => [
      t.topicId,
      (subjects[t.subjectId]! * topicWeight(t)) / weights.get(t.subjectId)!,
    ]),
  );
  if (focus?.kind === 'topic') shares = boost(shares, focus.id, FOCUS_POINTS[focus.nudge]);
  return shares;
}

interface Run {
  topicId: string | undefined;
  length: number;
}

function trailingRun(topicIds: readonly string[]): Run {
  const last = topicIds.at(-1);
  let length = 0;
  for (let i = topicIds.length - 1; i >= 0 && topicIds[i] === last; i--) length++;
  return { topicId: last, length };
}

/**
 * Whether the slots in `counts` can be put in an order with no more than MAX_IN_A_ROW from one
 * topic in a row, given the run the sequence continues from.
 */
function canArrange(counts: Map<string, number>, run: Run): boolean {
  let total = 0;
  for (const n of counts.values()) total += n;
  for (const [topicId, n] of counts) {
    const others = total - n;
    const alreadyUsed = topicId === run.topicId ? run.length : 0;
    if (n > MAX_IN_A_ROW * (others + 1) - alreadyUsed) return false;
  }
  return true;
}

function withChange(counts: Map<string, number>, topicId: string, delta: number) {
  const next = new Map(counts);
  const n = (next.get(topicId) ?? 0) + delta;
  if (n === 0) next.delete(topicId);
  else next.set(topicId, n);
  return next;
}

function poolsByTopic(topics: readonly TopicState[], candidates: readonly Candidate[]) {
  const pools = new Map<string, Candidate[]>(topics.map((t) => [t.topicId, []]));
  const servable = candidates.filter((c) => c.kind === 'question' || c.due === true);
  const dueFirst = [
    ...servable.filter((c) => c.kind === 'flashcard'),
    ...servable.filter((c) => c.kind === 'question'),
  ];
  for (const c of dueFirst) pools.get(c.topicId)?.push(c);
  return pools;
}

export function selectNextItems(input: SelectNextItemsInput): Candidate[] {
  const { count, rng, focus } = input;
  const pools = poolsByTopic(input.topics, input.candidates);
  const topics = input.topics.filter((t) => (pools.get(t.topicId)?.length ?? 0) > 0);
  const startRun = trailingRun(input.recentTopicIds ?? []);
  const shares = topicShares(topics, focus);

  // Draw how many slots each topic gets.
  let counts = new Map<string, number>();
  for (let slot = 0; slot < count; slot++) {
    const options = topics
      .filter((t) => (counts.get(t.topicId) ?? 0) < pools.get(t.topicId)!.length)
      .filter((t) => canArrange(withChange(counts, t.topicId, 1), startRun))
      .map((t) => [t.topicId, shares.get(t.topicId)!] as const);
    if (options.length === 0) break;
    counts = withChange(counts, weightedPick(options, rng), 1);
  }

  // Order: weak spots first, weakest first, keeping the variety rule.
  const byPriority = [...topics].sort(
    (a, b) =>
      Number(isWeakSpot(b.mastery)) - Number(isWeakSpot(a.mastery)) || a.mastery - b.mastery,
  );
  const order: string[] = [];
  let run = startRun;
  while (counts.size > 0) {
    const next = byPriority.find((t) => {
      if (!counts.has(t.topicId)) return false;
      const nextRun =
        t.topicId === run.topicId
          ? { topicId: run.topicId, length: run.length + 1 }
          : { topicId: t.topicId, length: 1 };
      return (
        nextRun.length <= MAX_IN_A_ROW && canArrange(withChange(counts, t.topicId, -1), nextRun)
      );
    })!;
    run =
      next.topicId === run.topicId
        ? { topicId: next.topicId, length: run.length + 1 }
        : { topicId: next.topicId, length: 1 };
    counts = withChange(counts, next.topicId, -1);
    order.push(next.topicId);
  }

  const used = new Map<string, number>();
  return order.map((topicId) => {
    const index = used.get(topicId) ?? 0;
    used.set(topicId, index + 1);
    return pools.get(topicId)![index]!;
  });
}
