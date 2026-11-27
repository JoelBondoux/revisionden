import { describe, expect, it } from 'vitest';
import {
  CardsDueSchema,
  MapTopicSchema,
  TopicMapSchema,
  UNIT_CHALLENGE_PERCENT,
  buildTopicMap,
  subjectNames,
  type MapTopicInput,
} from './map';

const progress = { xpToday: 30, dailyGoalXp: 50, streakDays: 4 };

const unit = (id: string, position: number): MapTopicInput => ({
  id,
  title: `Unit ${id}`,
  parentTopicId: null,
  position,
  servableItems: 0,
});
const leaf = (
  id: string,
  parentTopicId: string,
  position: number,
  extra: Partial<MapTopicInput> = {},
): MapTopicInput => ({
  id,
  title: `Topic ${id}`,
  parentTopicId,
  position,
  servableItems: 3,
  ...extra,
});

describe('subject names', () => {
  it('turns a subject id and tier into the map heading', () => {
    expect(subjectNames('gcse-maths', 'higher')).toEqual({
      subject: 'Maths',
      qualification: 'GCSE Higher',
    });
    expect(subjectNames('gcse-film-studies', 'none')).toEqual({
      subject: 'Film Studies',
      qualification: 'GCSE',
    });
    expect(subjectNames('a-level-further-maths', 'not_sure')).toEqual({
      subject: 'Further Maths',
      qualification: 'A-Level',
    });
    expect(subjectNames('maths', 'foundation')).toEqual({
      subject: 'Maths',
      qualification: 'Foundation',
    });
  });
});

describe('topic map', () => {
  const build = (topics: MapTopicInput[], mastery: Record<string, number> = {}) =>
    buildTopicMap({
      subjectId: 'gcse-maths',
      tier: 'higher',
      topics,
      mastery: new Map(Object.entries(mastery)),
      progress,
    });

  it('groups leaf topics under their top-level unit, in specification order', () => {
    const map = build([
      unit('u2', 10),
      unit('u1', 0),
      { ...unit('mid', 1), parentTopicId: 'u1' },
      leaf('b', 'mid', 3),
      leaf('a', 'mid', 2),
      leaf('c', 'u2', 11),
    ]);
    expect(map.units.map((u) => u.id)).toEqual(['u1', 'u2']);
    expect(map.units[0]!.topics.map((t) => t.id)).toEqual(['a', 'b']);
    expect(TopicMapSchema.parse(map)).toEqual(map);
  });

  it('gives each topic a state from its mastery', () => {
    const map = build(
      [
        unit('u', 0),
        leaf('done', 'u', 1),
        leaf('weak', 'u', 2),
        leaf('going', 'u', 3),
        leaf('new', 'u', 4),
        leaf('empty', 'u', 5, { servableItems: 0 }),
      ],
      { done: 85, weak: 40, going: 65 },
    );
    const states = Object.fromEntries(map.units[0]!.topics.map((t) => [t.id, t.status]));
    expect(states).toEqual({
      done: 'mastered',
      weak: 'weak',
      going: 'in-progress',
      new: 'in-progress',
      empty: 'locked',
    });
    expect(map.units[0]!.topics.find((t) => t.id === 'done')).toMatchObject({
      lessonId: 'done',
      mastery: 85,
    });
  });

  it('works out unit mastery from open topics and unlocks the challenge at 80%', () => {
    const low = build([unit('u', 0), leaf('a', 'u', 1), leaf('b', 'u', 2)], { a: 90, b: 60 });
    expect(low.units[0]!.masteryPercent).toBe(75);
    expect(low.units[0]!.challenge).toEqual({
      lessonId: 'u',
      unlockAtPercent: UNIT_CHALLENGE_PERCENT,
      unlocked: false,
    });
    const high = build(
      [unit('u', 0), leaf('a', 'u', 1), leaf('b', 'u', 2), leaf('x', 'u', 3, { servableItems: 0 })],
      { a: 90, b: 80 },
    );
    expect(high.units[0]!.masteryPercent).toBe(85);
    expect(high.units[0]!.challenge.unlocked).toBe(true);
  });

  it('leaves out units with no topics and shows 0% for a unit with nothing open', () => {
    const map = build([unit('empty', 0), unit('u', 1), leaf('x', 'u', 2, { servableItems: 0 })]);
    expect(map.units.map((u) => u.id)).toEqual(['u']);
    expect(map.units[0]!.masteryPercent).toBe(0);
  });

  it('suggests the weakest weak spot as the next mission', () => {
    const map = build([unit('u', 0), leaf('a', 'u', 1), leaf('b', 'u', 2)], { a: 50, b: 30 });
    expect(map.nextMission).toEqual({
      kind: 'weak-spot',
      title: 'Fix weak spot: Topic b',
      lessonId: 'b',
      minutes: 5,
    });
  });

  it('otherwise carries on with the first topic not yet mastered', () => {
    const map = build([unit('u', 0), leaf('a', 'u', 1), leaf('b', 'u', 2)], { a: 90 });
    expect(map.nextMission).toMatchObject({
      kind: 'continue',
      title: 'Continue: Topic b',
      lessonId: 'b',
    });
  });

  it('suggests a review when everything open is mastered, and nothing when nothing is open', () => {
    const all = build([unit('u', 0), leaf('a', 'u', 1), leaf('b', 'u', 2)], { a: 95, b: 85 });
    expect(all.nextMission).toMatchObject({
      kind: 'review',
      title: 'Review: Topic b',
      lessonId: 'b',
    });
    expect(build([unit('u', 0), leaf('x', 'u', 1, { servableItems: 0 })]).nextMission).toBeNull();
  });

  it('carries the subject heading, streak and daily goal', () => {
    const map = build([unit('u', 0), leaf('a', 'u', 1)]);
    expect(map).toMatchObject({
      subject: 'Maths',
      qualification: 'GCSE Higher',
      streakDays: 4,
      xpToday: 30,
      dailyGoalXp: 50,
    });
  });
});

describe('cards due', () => {
  it('is a count of due flashcards', () => {
    expect(CardsDueSchema.parse({ due: 3 })).toEqual({ due: 3 });
    expect(CardsDueSchema.safeParse({ due: -1 }).success).toBe(false);
  });
});

describe('a subject with no questions yet (RD-MBXKTC)', () => {
  const base = { tier: 'none', mastery: new Map<string, number>(), progress };

  it('is "coming soon" when it has no topics or no topic with questions', () => {
    const none = buildTopicMap({ ...base, subjectId: 'gcse-chemistry', topics: [] });
    expect(none).toMatchObject({ subjectId: 'gcse-chemistry', status: 'coming_soon', units: [] });
    const locked = buildTopicMap({
      ...base,
      subjectId: 'gcse-drama',
      topics: [unit('u', 0), leaf('t', 'u', 1, { servableItems: 0 })],
    });
    expect(locked.status).toBe('coming_soon');
    expect(TopicMapSchema.parse(none).status).toBe('coming_soon');
  });

  it('is ready when any topic has questions', () => {
    const map = buildTopicMap({
      ...base,
      subjectId: 'gcse-maths',
      topics: [unit('u', 0), leaf('t', 'u', 1)],
    });
    expect(map.status).toBe('ready');
  });

  it('lists the student’s subjects with names and whether each has questions', () => {
    const map = buildTopicMap({
      ...base,
      subjectId: 'gcse-maths',
      topics: [],
      subjects: [
        { subjectId: 'gcse-chemistry', hasContent: false },
        { subjectId: 'gcse-maths', hasContent: true, lastPractisedAt: '2026-11-26T09:00:00.000Z' },
      ],
    });
    // UX-1: when each was last practised (null when never), for the picker's order.
    expect(map.subjects).toEqual([
      {
        subjectId: 'gcse-chemistry',
        subject: 'Chemistry',
        hasContent: false,
        lastPractisedAt: null,
      },
      {
        subjectId: 'gcse-maths',
        subject: 'Maths',
        hasContent: true,
        lastPractisedAt: '2026-11-26T09:00:00.000Z',
      },
    ]);
  });
});

// J15c: optional route hints for the winding map. Left out, nothing changes.
describe('map topic route hints', () => {
  const base = { id: 't', title: 'Surds', lessonId: 'surds', status: 'in-progress', mastery: 20 };
  it('keeps a Higher-only tier and an either-order group when sent', () => {
    expect(MapTopicSchema.parse({ ...base, tier: 'higher', orderGroup: 'g1' })).toMatchObject({
      tier: 'higher',
      orderGroup: 'g1',
    });
  });
  it('still parses a topic without them', () => {
    const parsed = MapTopicSchema.parse(base);
    expect(parsed.tier).toBeUndefined();
    expect(parsed.orderGroup).toBeUndefined();
  });
});
