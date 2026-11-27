import { useSyncExternalStore } from 'react';
import type { MapSubject, TopicMap } from '@revisionden/core';
import { ApiError } from '../../api/client';

/*
 * UX-1 (owner approved the UX report, 2026-11-27): the subject a student is working on, shared by
 * Home, Learn and Cards and remembered on this device, so every screen shows the same one. Until
 * they pick, the API's default stands (the first subject with questions). The subjects themselves
 * come from whichever screen last loaded a map, for the top bar's switcher.
 */

const KEY = 'revisionden.subject.';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listen) => listen());
const subscribe = (listen: () => void) => {
  listeners.add(listen);
  return () => listeners.delete(listen);
};

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Choices made this page load, so switching works even when storage is refused. */
const memory = new Map<string, string | null>();

/** The subject this student chose on this device, or undefined for the API's default. */
export function chosenSubject(studentId: string | null): string | undefined {
  if (!studentId) return undefined;
  if (memory.has(studentId)) return memory.get(studentId) ?? undefined;
  try {
    return storage()?.getItem(KEY + studentId) ?? undefined;
  } catch {
    return undefined;
  }
}

/** Remember a subject for this student (null forgets it, back to the default). */
export function chooseSubject(studentId: string | null, subjectId: string | null): void {
  if (!studentId || chosenSubject(studentId) === (subjectId ?? undefined)) return;
  memory.set(studentId, subjectId);
  try {
    if (subjectId) storage()?.setItem(KEY + studentId, subjectId);
    else storage()?.removeItem(KEY + studentId);
  } catch {
    // Private windows can refuse storage: the choice then lasts until the page reloads (memory).
  }
  notify();
}

export function useChosenSubject(studentId: string | null): string | undefined {
  return useSyncExternalStore(subscribe, () => chosenSubject(studentId));
}

/** What the top bar shows: the subject on screen and the student's subjects. */
export interface KnownSubjects {
  current: { subjectId: string; subject: string };
  subjects: readonly MapSubject[];
}

let known: KnownSubjects | null = null;

export function useKnownSubjects(): KnownSubjects | null {
  return useSyncExternalStore(subscribe, () => known);
}

/** A remembered subject the student no longer takes falls back to the default. */
export function stillTaken(chosen: string | undefined, subjects: readonly MapSubject[]): boolean {
  return !chosen || subjects.length === 0 || subjects.some((s) => s.subjectId === chosen);
}

/** Called with each map a screen loads: updates the top bar and drops a stale choice. */
export function reportMap(studentId: string | null, map: TopicMap): void {
  const subjects = map.subjects ?? [];
  if (!stillTaken(chosenSubject(studentId), subjects)) chooseSubject(studentId, null);
  const subjectId = map.subjectId ?? map.subject;
  if (
    known?.current.subjectId === subjectId &&
    known.current.subject === map.subject &&
    known.subjects.length === subjects.length &&
    known.subjects.every((s, i) => s.subjectId === subjects[i]?.subjectId)
  )
    return;
  known = {
    current: { subjectId, subject: map.subject },
    subjects: subjects.length
      ? subjects
      : [{ subjectId, subject: map.subject, hasContent: map.status !== 'coming_soon' }],
  };
  notify();
}

/** Tests only: forget what the top bar knows and every remembered choice. */
export function resetKnownSubjects(): void {
  known = null;
  memory.clear();
  const store = storage();
  if (store) for (const key of Object.keys(store)) if (key.startsWith(KEY)) store.removeItem(key);
  notify();
}

/**
 * UX-1: the order subjects are offered in. The one on screen first, then the others with
 * questions to start, each in the order the family added them; subjects still coming soon go in
 * `later`, for one folded line (not an A–Z grid with the current subject in the middle).
 */
export function pickerOrder(
  subjects: readonly MapSubject[],
  current: string | undefined,
): { now: MapSubject[]; later: MapSubject[] } {
  const mine = subjects.filter((s) => s.subjectId === current);
  const rest = subjects.filter((s) => s.subjectId !== current);
  return {
    now: [...mine, ...rest.filter((s) => s.hasContent)],
    later: rest.filter((s) => !s.hasContent),
  };
}

/**
 * The map for the chosen subject. A remembered subject the API no longer knows (dropped, with no
 * topics: 404) is forgotten and the default is loaded instead, so no screen is left on an error.
 */
export async function loadSubjectMap(
  getTopicMap: (subjectId?: string) => Promise<TopicMap>,
  studentId: string | null,
  chosen: string | undefined,
): Promise<TopicMap> {
  try {
    return await getTopicMap(chosen);
  } catch (err) {
    if (!chosen || !(err instanceof ApiError) || err.status !== 404) throw err;
    chooseSubject(studentId, null);
    return getTopicMap(undefined);
  }
}
