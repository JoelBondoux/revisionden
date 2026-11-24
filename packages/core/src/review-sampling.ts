import type { Rng } from './rng';

/**
 * Batch sampling rule (docs/VERIFICATION.md section 3): a person reviews a random 10% of each
 * batch, at least 30 items (or the whole batch when it is smaller). One confirmed error sends the
 * whole batch back. Items that need human approval are always reviewed individually.
 */
export const SAMPLE_FRACTION = 0.1;
export const MIN_SAMPLE = 30;

export type ReviewDecision = 'approved' | 'confirmed_error';
export type BatchOutcome = 'in_review' | 'passed' | 'failed';

export interface BatchEntry {
  itemId: string;
  needsHumanApproval: boolean;
}

/** How many items a person reviews from a batch of this size. */
export function sampleSize(batchSize: number): number {
  return Math.min(batchSize, Math.max(MIN_SAMPLE, Math.ceil(batchSize * SAMPLE_FRACTION)));
}

/**
 * Item ids to review: a random sample of the batch plus every item that needs human approval,
 * in batch order. rng is injected so a sample can be replayed.
 */
export function drawSample(entries: readonly BatchEntry[], rng: Rng): string[] {
  const forced = entries.filter((e) => e.needsHumanApproval);
  const pool = entries.filter((e) => !e.needsHumanApproval);
  const want = Math.min(pool.length, sampleSize(entries.length));
  const picked = [...pool];
  // Partial Fisher-Yates: the first `want` places hold a uniform random sample.
  for (let i = 0; i < want; i += 1) {
    const j = i + Math.floor(rng() * (picked.length - i));
    [picked[i], picked[j]] = [picked[j]!, picked[i]!];
  }
  const chosen = new Set([...forced, ...picked.slice(0, want)].map((e) => e.itemId));
  return entries.map((e) => e.itemId).filter((id) => chosen.has(id));
}

/** The batch result from the decisions on its sample (null: not decided yet). */
export function batchOutcome(decisions: readonly (ReviewDecision | null)[]): BatchOutcome {
  if (decisions.includes('confirmed_error')) return 'failed';
  if (decisions.length > 0 && decisions.every((d) => d === 'approved')) return 'passed';
  return 'in_review';
}
