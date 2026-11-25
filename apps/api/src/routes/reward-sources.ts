/**
 * Reward data owned by other workstreams, behind small adapters so the rewards code does not
 * depend on their tables directly.
 *
 * - Confirmed bugs (Bug Hunter track): the operator's "Confirm bug" action is being built by
 *   workstream L. Until it lands this returns 0, so the track stays hidden. Swap the body for
 *   L's count (one per distinct confirmed bug, at most 3 a week) when it is on dev.
 */
import type { Database } from '@revisionden/db';

export async function confirmedBugCount(db: Database, studentId: string): Promise<number> {
  // No confirmed-bug record exists yet; the arguments are what L's count will need.
  void db;
  void studentId;
  return 0;
}
