// Builders for synthetic test content. Fixture text is generic and made up for tests; it is not
// RevisionDen educational content.

export function quoted(overrides = {}) {
  return {
    source_type: 'specification',
    publisher: 'Pearson Edexcel',
    title: 'Fixture specification',
    document_ref: 'FIXTURE-1',
    url: 'https://qualifications.pearson.com/fixture-spec.pdf',
    location: 'page 2',
    quote: 'solve linear equations',
    retrieved_at: '2026-11-24',
    supports: ['question', 'answer'],
    ...overrides,
  };
}

export function draftItem(id, citations = [quoted()], overrides = {}) {
  return {
    id,
    topic: 'fixture-leaf',
    type: 'short_answer',
    difficulty: 1,
    prompt: 'Fixture question?',
    answer: { accepted: ['fixture answer'] },
    marks: 1,
    source_ref: 'Fixture specification point',
    checked_by: ['author'],
    citations,
    verification: { status: 'draft', version: 1, checks: [] },
    ...overrides,
  };
}

const check = (name, tool, at = '2026-11-24T12:00:00Z') => ({
  name,
  result: 'pass',
  tool,
  tool_version: '1',
  at,
});

export function verifiedRecord({ version = 1 } = {}) {
  return {
    status: 'verified',
    version,
    reviewed_by: 'subject-specialist',
    checks: [
      check('grounded-writing', 'writer-model'),
      check('quote-check', 'revisionden-quote-check'),
      check('blind-answer', 'second-provider-model'),
      check('adversarial-review', 'review-model'),
      check('schema', 'revisionden-content-validate'),
      check('human-approval', 'subject-specialist'),
    ],
  };
}
