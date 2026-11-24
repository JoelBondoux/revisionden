import { describe, expect, it } from 'vitest';
import { createRng } from './rng';
import {
  FOCUS_POINTS,
  selectNextItems,
  subjectShares,
  topicShares,
  type Candidate,
  type TopicState,
} from './next-item';

const topics: TopicState[] = [
  { topicId: 'm-algebra', subjectId: 'maths', mastery: 20 },
  { topicId: 'm-ratio', subjectId: 'maths', mastery: 70 },
  { topicId: 'b-cells', subjectId: 'biology', mastery: 50 },
  { topicId: 'b-ecology', subjectId: 'biology', mastery: 90 },
];

function questions(topicId: string, n = 30): Candidate[] {
  return Array.from({ length: n }, (_, i) => ({
    itemId: `${topicId}-q${i}`,
    topicId,
    kind: 'question' as const,
  }));
}

const pool = topics.flatMap((t) => questions(t.topicId));
const topicOf = new Map(topics.map((t) => [t.topicId, t]));

function maxRun(topicIds: string[]): number {
  let best = 0;
  let run = 0;
  topicIds.forEach((id, i) => {
    run = i > 0 && topicIds[i - 1] === id ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

describe('shares', () => {
  it('gives subjects with weaker topics a bigger share without a focus', () => {
    // Topic weight = (100 - mastery) + 5: maths 85 + 35 = 120, biology 55 + 15 = 70.
    const shares = subjectShares(topics);
    expect(shares.maths).toBeCloseTo((120 / 190) * 100, 9);
    expect(shares.biology).toBeCloseTo((70 / 190) * 100, 9);
  });

  it('gives the weakest topic the biggest share overall', () => {
    const shares = [...topicShares(topics).entries()].sort((a, b) => b[1] - a[1]);
    expect(shares[0]![0]).toBe('m-algebra');
  });

  it('gives weaker topics a bigger share within their subject', () => {
    const shares = topicShares(topics);
    expect(shares.get('m-algebra')!).toBeGreaterThan(shares.get('m-ratio')!);
    expect(shares.get('b-cells')!).toBeGreaterThan(shares.get('b-ecology')!);
    const total = [...shares.values()].reduce((a, b) => a + b, 0);
    expect(total).toBeCloseTo(100, 9);
  });

  it('adds the nudge points to the focus subject before normalising', () => {
    expect(FOCUS_POINTS).toEqual({ light: 10, medium: 22, strong: 38 });
    for (const nudge of ['light', 'medium', 'strong'] as const) {
      const shares = subjectShares(topics, { kind: 'subject', id: 'biology', nudge });
      const base = subjectShares(topics).biology!;
      const expected = ((base + FOCUS_POINTS[nudge]) / (100 + FOCUS_POINTS[nudge])) * 100;
      expect(shares.biology).toBeCloseTo(expected, 9);
      expect(shares.maths! + shares.biology!).toBeCloseTo(100, 9);
    }
  });

  it('adds the nudge points to a focus topic before normalising', () => {
    const before = topicShares(topics).get('b-ecology')!;
    const after = topicShares(topics, { kind: 'topic', id: 'b-ecology', nudge: 'medium' });
    expect(after.get('b-ecology')).toBeCloseTo(((before + 22) / 122) * 100, 9);
  });

  it('ignores a focus on a subject the student does not study', () => {
    expect(subjectShares(topics, { kind: 'subject', id: 'latin', nudge: 'strong' })).toEqual(
      subjectShares(topics),
    );
  });
});

describe('selectNextItems', () => {
  it('returns the requested number of different items', () => {
    const items = selectNextItems({ topics, candidates: pool, count: 10, rng: createRng(1) });
    expect(items).toHaveLength(10);
    expect(new Set(items.map((i) => i.itemId)).size).toBe(10);
  });

  it('is repeatable with the same seed', () => {
    const a = selectNextItems({ topics, candidates: pool, count: 10, rng: createRng(9) });
    const b = selectNextItems({ topics, candidates: pool, count: 10, rng: createRng(9) });
    expect(a).toEqual(b);
  });

  it('chooses the weakest topic most often', () => {
    const rng = createRng(11);
    const counts = new Map<string, number>();
    for (let s = 0; s < 300; s++) {
      for (const item of selectNextItems({ topics, candidates: pool, count: 10, rng })) {
        counts.set(item.topicId, (counts.get(item.topicId) ?? 0) + 1);
      }
    }
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    expect(ranked[0]).toBe('m-algebra');
  });

  it('raises the focus subject share by the expected amount', () => {
    const share = (focus?: Parameters<typeof selectNextItems>[0]['focus']) => {
      const rng = createRng(21);
      let biology = 0;
      let total = 0;
      for (let s = 0; s < 400; s++) {
        for (const item of selectNextItems({ topics, candidates: pool, count: 10, rng, focus })) {
          total++;
          if (topicOf.get(item.topicId)!.subjectId === 'biology') biology++;
        }
      }
      return (biology / total) * 100;
    };
    const base = subjectShares(topics).biology!;
    expect(Math.abs(share() - base)).toBeLessThan(3);
    const strong = share({ kind: 'subject', id: 'biology', nudge: 'strong' });
    expect(Math.abs(strong - ((base + 38) / 138) * 100)).toBeLessThan(3);
  });

  it('never serves more than 3 items in a row from one topic, counting what came just before', () => {
    const rng = createRng(5);
    for (let s = 0; s < 300; s++) {
      const recentTopicIds = ['m-algebra', 'm-algebra'];
      const items = selectNextItems({ topics, candidates: pool, count: 20, rng, recentTopicIds });
      expect(maxRun([...recentTopicIds, ...items.map((i) => i.topicId)])).toBeLessThanOrEqual(3);
    }
  });

  it('keeps the variety rule for any mix of topics, pool sizes and recent history', () => {
    const rng = createRng(99);
    for (let s = 0; s < 500; s++) {
      const n = 1 + Math.floor(rng() * 5);
      const mixed: TopicState[] = Array.from({ length: n }, (_, i) => ({
        topicId: `t${i}`,
        subjectId: `s${i % 2}`,
        mastery: Math.floor(rng() * 101),
      }));
      const candidates = mixed.flatMap((t) => questions(t.topicId, Math.floor(rng() * 12)));
      const recentTopicIds = Array.from({ length: Math.floor(rng() * 4) }, () => 't0');
      const items = selectNextItems({ topics: mixed, candidates, count: 15, rng, recentTopicIds });
      expect(items.length).toBeLessThanOrEqual(15);
      expect(maxRun([...recentTopicIds, ...items.map((i) => i.topicId)])).toBeLessThanOrEqual(3);
    }
  });

  it('puts weak-spot picks first, weakest first, whenever the variety rule allows', () => {
    const rng = createRng(8);
    let checked = 0;
    for (let s = 0; s < 200; s++) {
      const ids = selectNextItems({ topics, candidates: pool, count: 6, rng }).map(
        (i) => i.topicId,
      );
      const counts = new Map<string, number>();
      ids.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
      // With no topic picked more than 3 times, nothing forces a different order.
      if (Math.max(...counts.values()) > 3) continue;
      checked++;
      const masteries = ids.map((id) => topicOf.get(id)!.mastery);
      expect(masteries).toEqual([...masteries].sort((a, b) => a - b));
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('orders weak spots weakest first when nothing else gets in the way', () => {
    const two: TopicState[] = [topics[0]!, topics[2]!];
    const candidates = [...questions('b-cells', 1), ...questions('m-algebra', 1)];
    const items = selectNextItems({ topics: two, candidates, count: 2, rng: createRng(2) });
    expect(items.map((i) => i.topicId)).toEqual(['m-algebra', 'b-cells']);
  });

  it('keeps weak spots first even with a strong parent focus elsewhere', () => {
    const rng = createRng(13);
    const focus = { kind: 'topic' as const, id: 'b-ecology', nudge: 'strong' as const };
    const items = selectNextItems({ topics, candidates: pool, count: 10, rng, focus });
    expect(topicOf.get(items[0]!.topicId)!.mastery).toBeLessThan(60);
  });

  it('serves due flashcards before questions from the same topic, and never cards not yet due', () => {
    const cards: Candidate[] = [
      { itemId: 'card-due', topicId: 'm-algebra', kind: 'flashcard', due: true },
      { itemId: 'card-later', topicId: 'm-algebra', kind: 'flashcard', due: false },
    ];
    const one: TopicState[] = [{ topicId: 'm-algebra', subjectId: 'maths', mastery: 10 }];
    const items = selectNextItems({
      topics: one,
      candidates: [...questions('m-algebra', 2), ...cards],
      count: 3,
      rng: createRng(1),
    });
    expect(items.map((i) => i.itemId)).toEqual(['card-due', 'm-algebra-q0', 'm-algebra-q1']);
  });

  it('stops early rather than break the variety rule or run out of items', () => {
    const one: TopicState[] = [{ topicId: 'm-algebra', subjectId: 'maths', mastery: 10 }];
    const many = questions('m-algebra', 10);
    expect(
      selectNextItems({ topics: one, candidates: many, count: 10, rng: createRng(1) }),
    ).toHaveLength(3);
    const few = [...questions('m-algebra', 1), ...questions('m-ratio', 1)];
    expect(selectNextItems({ topics, candidates: few, count: 10, rng: createRng(1) })).toHaveLength(
      2,
    );
  });

  it('ignores candidates from topics it knows nothing about', () => {
    const stray = questions('unknown-topic', 5);
    expect(selectNextItems({ topics, candidates: stray, count: 5, rng: createRng(1) })).toEqual([]);
  });
});
