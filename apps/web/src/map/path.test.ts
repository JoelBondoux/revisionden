import type { MapTopic, MapUnit, TopicMap } from '@revisionden/core';
import { currentTopicId, currentUnitId, pathLayout, scrollTopToShow, unitIsLocked } from './path';

const topic = (id: string, status: MapTopic['status'], mastery = 0): MapTopic => ({
  id,
  title: id,
  lessonId: id,
  status,
  mastery,
});

const unit = (id: string, topics: MapTopic[]): MapUnit => ({
  id,
  title: id,
  masteryPercent: 0,
  topics,
  challenge: { lessonId: id, unlockAtPercent: 80, unlocked: false },
});

const map = (
  units: MapUnit[],
  missionLessonId?: string,
): Pick<TopicMap, 'units' | 'nextMission'> => ({
  units,
  nextMission: missionLessonId
    ? { kind: 'weak-spot', title: 'Fix it', lessonId: missionLessonId, minutes: 5 }
    : null,
});

describe('the current unit on the map path', () => {
  const number = unit('number', [topic('n1', 'mastered', 100), topic('n2', 'in-progress', 40)]);
  const algebra = unit('algebra', [topic('a1', 'weak', 20), topic('a2', 'in-progress')]);
  const ratio = unit('ratio', [topic('r1', 'locked')]);

  it('is the unit that holds the next mission', () => {
    expect(currentUnitId(map([number, algebra, ratio], 'a1'))).toBe('algebra');
  });

  it('is the first unit with an open topic when there is no mission', () => {
    expect(currentUnitId(map([ratio, number, algebra]))).toBe('number');
  });

  it('is the first unit when every unit is locked, and nothing when there are no units', () => {
    expect(currentUnitId(map([ratio]))).toBe('ratio');
    expect(currentUnitId(map([]))).toBeNull();
  });
});

describe('the current topic in a unit', () => {
  it('is the next mission when the mission is in this unit', () => {
    const u = unit('u', [topic('t1', 'weak', 10), topic('t2', 'weak', 30)]);
    expect(currentTopicId(u, 't2')).toBe('t2');
  });

  it('is otherwise the weakest weak spot', () => {
    const u = unit('u', [
      topic('t1', 'in-progress'),
      topic('t2', 'weak', 30),
      topic('t3', 'weak', 10),
    ]);
    expect(currentTopicId(u, 'elsewhere')).toBe('t3');
  });

  it('is otherwise the first open topic not yet mastered', () => {
    const u = unit('u', [topic('t1', 'mastered', 100), topic('t2', 'in-progress', 40)]);
    expect(currentTopicId(u)).toBe('t2');
  });

  it('is the first topic when all are mastered or locked', () => {
    expect(currentTopicId(unit('u', [topic('t1', 'mastered', 100)]))).toBe('t1');
    expect(currentTopicId(unit('u', [topic('t1', 'locked')]))).toBe('t1');
  });
});

describe('a locked unit', () => {
  it('has every topic locked', () => {
    expect(unitIsLocked(unit('u', [topic('t1', 'locked'), topic('t2', 'locked')]))).toBe(true);
    expect(unitIsLocked(unit('u', [topic('t1', 'locked'), topic('t2', 'in-progress')]))).toBe(
      false,
    );
  });
});

describe('how the topic path scrolls', () => {
  const phone = { viewportWidth: 390, viewportHeight: 844, remPx: 16, bottomInset: 80 };

  it('scrolls inside its card on a normal phone, filling the space above the tab bar', () => {
    expect(pathLayout({ ...phone, regionTop: 500 })).toEqual({ mode: 'scroll', maxHeight: 264 });
  });

  it('gives way to the page scroll on a short screen', () => {
    expect(pathLayout({ ...phone, viewportHeight: 568, regionTop: 500 })).toEqual({ mode: 'flow' });
  });

  it('gives way to the page scroll with big text, even on a tall screen', () => {
    // 320px wide at 200% text is only 10 rem across.
    expect(pathLayout({ ...phone, viewportWidth: 320, remPx: 32, regionTop: 300 })).toEqual({
      mode: 'flow',
    });
  });

  it('needs room for two and a half topics or so (11 rem) before it scrolls inside the card', () => {
    expect(pathLayout({ ...phone, regionTop: 844 - 80 - 175 })).toEqual({ mode: 'flow' });
    expect(pathLayout({ ...phone, regionTop: 844 - 80 - 176 })).toEqual({
      mode: 'scroll',
      maxHeight: 176,
    });
  });
});

describe('scrolling a topic into view', () => {
  it('centres the topic in the path', () => {
    expect(scrollTopToShow({ itemTop: 500, itemHeight: 100, viewHeight: 300 })).toBe(400);
  });

  it('never scrolls above the top', () => {
    expect(scrollTopToShow({ itemTop: 20, itemHeight: 100, viewHeight: 300 })).toBe(0);
  });
});
