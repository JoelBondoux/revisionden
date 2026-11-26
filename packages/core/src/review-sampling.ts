import type { Rng } from './rng';

/**
 * Batch sampling rule (docs/VERIFICATION.md section 3): a person reviews a random 10% of each
 * batch, at least 30 items (or the whole batch when it is smaller). A batch made only of items
 * from templates whose preview the owner approved and whose cross-check passed is sampled at 3%,
 * at least 10 (decision 0010). One confirmed error sends the whole batch back. Items that need
 * human approval are always reviewed individually.
 */
export const SAMPLE_FRACTION = 0.1;
export const MIN_SAMPLE = 30;
export const TEMPLATE_SAMPLE_FRACTION = 0.03;
export const TEMPLATE_MIN_SAMPLE = 10;

/** `template`: every item is from an approved template (decision 0010); otherwise `standard`. */
export type SamplingRule = 'standard' | 'template';

export type ReviewDecision = 'approved' | 'confirmed_error';
export type BatchOutcome = 'in_review' | 'passed' | 'failed';

export interface BatchEntry {
  itemId: string;
  needsHumanApproval: boolean;
}

/** How many items a person reviews from a batch of this size. */
export function sampleSize(batchSize: number, rule: SamplingRule = 'standard'): number {
  const [fraction, min] =
    rule === 'template'
      ? [TEMPLATE_SAMPLE_FRACTION, TEMPLATE_MIN_SAMPLE]
      : [SAMPLE_FRACTION, MIN_SAMPLE];
  // Round before ceil so floating-point error (300 * 0.03 = 9.000000000000002) cannot add one.
  return Math.min(batchSize, Math.max(min, Math.ceil(Number((batchSize * fraction).toFixed(9)))));
}

interface CheckLike {
  name?: unknown;
  result?: unknown;
  tool_version?: unknown;
}

interface TemplateItemLike {
  template?: { id?: unknown; version?: unknown };
  verification?: { checks?: unknown };
}

/**
 * True when the item comes from a template whose preview the owner approved and whose cross-check
 * passed (decision 0010). The approval is a passing `template-approval` check naming the same
 * template id and version ("<id> v<version>"); for templates the `maths-engine` check is the
 * cross-check (docs/TEMPLATES.md).
 */
export function templateApproved(item: unknown): boolean {
  const record = (item ?? {}) as TemplateItemLike;
  const id = record.template?.id;
  const version = record.template?.version;
  if (typeof id !== 'string' || typeof version !== 'number') return false;
  const checks = Array.isArray(record.verification?.checks)
    ? (record.verification.checks as CheckLike[])
    : [];
  const passed = (name: string) => checks.filter((c) => c.name === name && c.result === 'pass');
  const failed = checks.some(
    (c) => (c.name === 'maths-engine' || c.name === 'template-approval') && c.result === 'fail',
  );
  return (
    !failed &&
    passed('maths-engine').length > 0 &&
    passed('template-approval').some((c) => c.tool_version === `${id} v${version}`)
  );
}

/** The sampling rule for a batch of item records: `template` only if every item qualifies. */
export function samplingRule(items: readonly unknown[]): SamplingRule {
  return items.length > 0 && items.every(templateApproved) ? 'template' : 'standard';
}

/**
 * Item ids to review: a random sample of the batch plus every item that needs human approval,
 * in batch order. rng is injected so a sample can be replayed.
 */
export function drawSample(
  entries: readonly BatchEntry[],
  rng: Rng,
  rule: SamplingRule = 'standard',
): string[] {
  const forced = entries.filter((e) => e.needsHumanApproval);
  const pool = entries.filter((e) => !e.needsHumanApproval);
  const want = Math.min(pool.length, sampleSize(entries.length, rule));
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
