/**
 * Which draft items may go to a person for approval (docs/VERIFICATION.md section 3): every
 * automated pipeline step (1 to 6) must have passed first. A person never sees an item that a
 * check failed or skipped.
 */

const MATHS_TYPES = new Set(['numeric', 'worked_maths']);
const BASE_CHECKS = ['grounded-writing', 'quote-check', 'adversarial-review', 'schema'];

interface CheckRecord {
  name?: unknown;
  result?: unknown;
}

/** The checks this item type needs before human review. */
function requiredChecks(type: string): string[] {
  const blind = type === 'extended_answer' ? 'blind-marking' : 'blind-answer';
  return [...BASE_CHECKS, blind, ...(MATHS_TYPES.has(type) ? ['maths-engine'] : [])];
}

/** Required checks that have not passed (missing or failed), in pipeline order. */
export function missingChecks(item: unknown): string[] {
  const record = (item ?? {}) as { type?: unknown; verification?: { checks?: unknown } };
  const type = typeof record.type === 'string' ? record.type : '';
  const checks = Array.isArray(record.verification?.checks)
    ? (record.verification.checks as CheckRecord[])
    : [];
  const passed = new Set(checks.filter((c) => c.result === 'pass').map((c) => c.name));
  return requiredChecks(type).filter((name) => !passed.has(name));
}

/** True for a draft content item whose automated checks have all passed. */
export function readyForHumanReview(item: unknown): boolean {
  const record = (item ?? {}) as { type?: unknown; verification?: { status?: unknown } };
  if (typeof record.type !== 'string' || record.verification?.status !== 'draft') return false;
  return missingChecks(item).length === 0;
}
