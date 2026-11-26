/**
 * The topic map's path (J12b, design C "Your path"): which unit and topic are current, and whether
 * the topic path scrolls inside its card or with the page. Pure functions; the components measure.
 */
import type { MapTopic, MapUnit, TopicMap } from '@revisionden/core';

/** A unit whose every topic is locked (no questions can be served yet). */
export function unitIsLocked(unit: MapUnit): boolean {
  return unit.topics.every((t) => t.status === 'locked');
}

/** The unit that holds the next mission, else the first unit with an open topic, else the first. */
export function currentUnitId(map: Pick<TopicMap, 'units' | 'nextMission'>): string | null {
  const missionId = map.nextMission?.lessonId;
  const withMission = map.units.find((u) => u.topics.some((t) => t.lessonId === missionId));
  const open = map.units.find((u) => !unitIsLocked(u));
  return (withMission ?? open ?? map.units[0])?.id ?? null;
}

/**
 * The topic to bring into view: the next mission when it is in this unit, else the weakest weak
 * spot, else the first open topic not yet mastered, else the first topic.
 */
export function currentTopicId(unit: MapUnit, missionLessonId?: string): string | null {
  const mission = unit.topics.find((t) => t.lessonId === missionLessonId);
  const weakest = unit.topics
    .filter((t) => t.status === 'weak')
    .reduce<MapTopic | undefined>(
      (low, t) => (!low || t.mastery < low.mastery ? t : low),
      undefined,
    );
  const next = unit.topics.find((t) => t.status === 'in-progress');
  return (mission ?? weakest ?? next ?? unit.topics[0])?.id ?? null;
}

/** Below this width (in rem, so big text counts) the path never scrolls inside its card. */
const MIN_WIDTH_REM = 20;
/** The path scrolls inside its card only with room for two and a half topics or so. */
const MIN_HEIGHT_REM = 11;

export type PathLayout = { mode: 'scroll'; maxHeight: number } | { mode: 'flow' };

/**
 * On a normal phone the path scrolls inside its card and fills the space above the tab bar, so the
 * whole map fits one screen. On a short screen, a narrow one or with big text it gives way to the
 * page's own scroll, so there is never a scroll inside a scroll.
 */
export function pathLayout(input: {
  viewportWidth: number;
  viewportHeight: number;
  remPx: number;
  /** The path's top edge, measured from the top of the page. */
  regionTop: number;
  /** The space kept below the path: the card's bottom edge and the tab bar. */
  bottomInset: number;
}): PathLayout {
  const { viewportWidth, viewportHeight, remPx, regionTop, bottomInset } = input;
  const available = Math.floor(viewportHeight - regionTop - bottomInset);
  if (viewportWidth / remPx < MIN_WIDTH_REM || available < MIN_HEIGHT_REM * remPx) {
    return { mode: 'flow' };
  }
  return { mode: 'scroll', maxHeight: available };
}

/** The scroll position that centres a topic in the path, never above the top. */
export function scrollTopToShow(input: {
  itemTop: number;
  itemHeight: number;
  viewHeight: number;
}): number {
  return Math.max(0, Math.round(input.itemTop - (input.viewHeight - input.itemHeight) / 2));
}
