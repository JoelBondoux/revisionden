/**
 * Which draft items may go to a person for approval (docs/VERIFICATION.md section 3): every
 * automated pipeline step (1 to 6) must have passed first. A person never sees an item that a
 * check failed or skipped. The one exception is the fact-check (step 4b, decision 0009): an item
 * whose fact-check failed still goes to a person, but always for individual review.
 */

const MATHS_TYPES = new Set(['numeric', 'worked_maths']);
const BASE_CHECKS = ['grounded-writing', 'quote-check', 'adversarial-review', 'schema'];

interface CheckRecord {
  name?: unknown;
  result?: unknown;
  at?: unknown;
}

interface ItemRecord {
  type?: unknown;
  facts?: unknown;
  exact?: { quantity?: unknown; chemical_equation?: unknown; equation_sheet?: unknown };
  needs_human_approval?: unknown;
  verification?: { status?: unknown; checks?: unknown };
}

const checksOf = (item: ItemRecord): CheckRecord[] =>
  Array.isArray(item.verification?.checks) ? (item.verification.checks as CheckRecord[]) : [];

const hasFacts = (item: ItemRecord) => Array.isArray(item.facts) && item.facts.length > 0;

/** The checks this item needs to have passed before human review (as scripts/content/validate). */
function requiredChecks(item: ItemRecord): string[] {
  const type = typeof item.type === 'string' ? item.type : '';
  const blind = type === 'extended_answer' ? 'blind-marking' : 'blind-answer';
  return [
    ...BASE_CHECKS,
    blind,
    ...(MATHS_TYPES.has(type) ? ['maths-engine'] : []),
    // Exact checks (step 5) for the facts the item names in its exact block.
    ...(item.exact?.quantity ? ['units'] : []),
    ...(item.exact?.chemical_equation ? ['chemical-equation'] : []),
    ...(item.exact?.equation_sheet ? ['equation-sheet'] : []),
  ];
}

/** Steps 3 to 5, which a failed batch sends every item back through. */
const RECHECK_STEPS = new Set([
  'blind-answer',
  'blind-marking',
  'adversarial-review',
  'maths-engine',
  'units',
  'chemical-equation',
  'equation-sheet',
]);

/**
 * True when every step 3 to 5 check on the item ran after `time` (a failed batch's decision), so
 * the item has really been re-checked before it may join a new batch.
 */
export function recheckedSince(item: unknown, time: Date): boolean {
  const steps = checksOf((item ?? {}) as ItemRecord).filter((c) =>
    RECHECK_STEPS.has(c.name as string),
  );
  return (
    steps.length > 0 &&
    steps.every((c) => {
      const at = new Date(String(c.at)).getTime();
      return Number.isFinite(at) && at > time.getTime();
    })
  );
}

/** Required checks that have not passed (missing or failed), in pipeline order. */
export function missingChecks(item: unknown): string[] {
  const record = (item ?? {}) as ItemRecord;
  const checks = checksOf(record);
  const passed = new Set(checks.filter((c) => c.result === 'pass').map((c) => c.name));
  const missing = requiredChecks(record).filter((name) => !passed.has(name));
  // Items with facts need a fact-check record; a failed one still allows individual review.
  if (hasFacts(record) && !checks.some((c) => c.name === 'fact-check')) missing.push('fact-check');
  return missing;
}

/** True for a draft content item whose automated checks have all passed. */
export function readyForHumanReview(item: unknown): boolean {
  const record = (item ?? {}) as ItemRecord;
  if (typeof record.type !== 'string' || record.verification?.status !== 'draft') return false;
  return missingChecks(item).length === 0;
}

/** True when a person must approve this item on its own, never through batch sampling. */
export function needsIndividualReview(item: unknown): boolean {
  const record = (item ?? {}) as ItemRecord;
  if (record.needs_human_approval === true) return true;
  return checksOf(record).some((c) => c.name === 'fact-check' && c.result === 'fail');
}
