// Builders for test content: citations and verification records.

export function citation(overrides = {}) {
  return {
    source_type: 'specification',
    publisher: 'Pearson Edexcel',
    title: 'GCSE (9-1) Mathematics specification',
    document_ref: '1MA1',
    url: 'https://example.org/spec',
    location: 'Content reference A17',
    supports: ['question', 'answer'],
    ...overrides,
  };
}

/** A citation with a retrieved verbatim quote (needed once content is verified). */
export function quotedCitation(overrides = {}) {
  return citation({
    quote: 'solve linear equations in one unknown algebraically',
    retrieved_at: '2026-11-24',
    ...overrides,
  });
}

export function draft() {
  return { status: 'draft', version: 1, checks: [] };
}

const check = (name, tool) => ({
  name,
  result: 'pass',
  tool,
  tool_version: '1',
  at: '2026-11-24T12:00:00Z',
});

/**
 * A complete verified record (docs/VERIFICATION.md pipeline steps 1 to 7).
 * Maths items also get the maths-engine check. release: 'human-approval' or 'batch-sample'.
 */
export function verified({ maths = false, version = 1, release = 'human-approval' } = {}) {
  return {
    status: 'verified',
    version,
    reviewed_by: 'subject-specialist',
    checks: [
      check('grounded-writing', 'writer-model'),
      check('quote-check', 'revisionden-quote-check'),
      check('blind-answer', 'second-provider-model'),
      check('adversarial-review', 'review-model'),
      ...(maths ? [check('maths-engine', 'revisionden-maths')] : []),
      check('schema', 'revisionden-content-validate'),
      check(release, 'subject-specialist'),
    ],
  };
}
