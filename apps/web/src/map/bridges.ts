/**
 * Bridges to other subjects (J15c, owner direction 2026-11-26): opening a topic can reveal a related
 * topic from another subject the student studies, and opening that can reveal the next one. They
 * are discovered, never shown up front, and always optional.
 *
 * The links themselves come from content (tasks D7/D8); with none, the map shows no bridges. What a
 * student has found is kept in memory for the session only (nothing saved on the device).
 */

export interface BridgeLink {
  /** The other subject's name and id (for its tint and prop). */
  subject: string;
  subjectId: string;
  /** The related topic in that subject. */
  topic: string;
  /** Why it helps, said when the bridge is tapped. */
  why: string;
}

/** Each topic id's chain of links, in the order they are discovered. */
export type Bridges = Readonly<Record<string, readonly BridgeLink[]>>;

/** How many links of each topic's chain have been found. */
const found = new Map<string, number>();
/** Discoveries waiting to be celebrated the next time the map shows them. */
const fresh = new Set<string>();

export const discoveryKey = (topicId: string, index: number) => `${topicId}#${index}`;

/** How many of a topic's links the student has found. */
export function foundCount(topicId: string): number {
  return found.get(topicId) ?? 0;
}

/** Finds the next link of a topic's chain (if there is one), to celebrate on the next map visit. */
export function discoverNext(topicId: string, chainLength: number): string | null {
  const next = foundCount(topicId);
  if (next >= chainLength) return null;
  found.set(topicId, next + 1);
  const key = discoveryKey(topicId, next);
  fresh.add(key);
  return key;
}

/** True once, the first time a discovery is shown. */
export function takeFresh(key: string): boolean {
  return fresh.delete(key);
}

/** Forgets every discovery (tests, and the dev tester's "Reset discoveries"). */
export function resetDiscoveries(): void {
  found.clear();
  fresh.clear();
}
