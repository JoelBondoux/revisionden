import { describe, expect, it } from 'vitest';
import {
  INTERACTIVE_PILOT_TAG,
  arrangeInteractivePilot,
  showsInteractivePilot,
} from './pilot-lesson';

describe('when the interactive pilot shows (owner, 2026-11-26: A4 weak spots)', () => {
  it('shows in a one-topic lesson when the topic is a weak spot (mastery below 60)', () => {
    expect(showsInteractivePilot({ mastery: 59, topicCount: 1 })).toBe(true);
    expect(showsInteractivePilot({ mastery: 0, topicCount: 1 })).toBe(true);
  });

  it('does not show at exactly 60 or above', () => {
    expect(showsInteractivePilot({ mastery: 60, topicCount: 1 })).toBe(false);
    expect(showsInteractivePilot({ mastery: 85, topicCount: 1 })).toBe(false);
  });

  it('does not show for a topic with no history yet (not a weak spot, just not tried)', () => {
    expect(showsInteractivePilot({ mastery: undefined, topicCount: 1 })).toBe(false);
  });

  it('does not show in a unit challenge or subject lesson spanning several topics', () => {
    expect(showsInteractivePilot({ mastery: 20, topicCount: 3 })).toBe(false);
  });
});

describe('arranging a lesson around the pilot', () => {
  const row = (id: string, tags: string[] = []) => ({ id, tags });
  const pilot = (id: string) => row(id, [INTERACTIVE_PILOT_TAG]);
  const isPilot = (r: { tags: string[] }) => r.tags.includes(INTERACTIVE_PILOT_TAG);
  const lesson = [row('a4-0101'), pilot('area-0001'), row('a4-0105'), pilot('area-0002')];

  it('puts the pilot steps first, in content order, then the normal questions as the hand-over', () => {
    const ids = arrangeInteractivePilot(lesson, isPilot, true).map((r) => r.id);
    expect(ids).toEqual(['area-0001', 'area-0002', 'a4-0101', 'a4-0105']);
  });

  it('leaves the pilot steps out entirely when it does not show', () => {
    const ids = arrangeInteractivePilot(lesson, isPilot, false).map((r) => r.id);
    expect(ids).toEqual(['a4-0101', 'a4-0105']);
  });
});
