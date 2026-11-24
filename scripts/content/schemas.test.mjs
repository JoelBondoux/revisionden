import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createValidators } from './schemas.mjs';
import { citation, draft, quotedCitation, verified } from './test-helpers.mjs';

const v = createValidators();

const without = (obj, key) => {
  const copy = { ...obj };
  delete copy[key];
  return copy;
};

const base = {
  id: 'gcse-maths-h-a17-0001',
  topic: 'gcse-maths-h-a17',
  difficulty: 2,
  source_ref: 'Pearson Edexcel 1MA1 A17',
  checked_by: ['maths-engine'],
  citations: [citation()],
  verification: draft(),
};

const samples = {
  multiple_choice: {
    ...base,
    type: 'multiple_choice',
    prompt: 'Which is a prime number?',
    options: ['21', '23', '25', '27'],
    answer: { option: 1 },
    marks: 1,
  },
  short_answer: {
    ...base,
    type: 'short_answer',
    prompt: 'What is the name of a polygon with eight sides?',
    answer: { accepted: ['octagon'] },
    marks: 1,
  },
  numeric: {
    ...base,
    type: 'numeric',
    prompt: 'Work out 3/4 of 120.',
    answer: { value: '90' },
    verify: { expression: '3/4 * 120' },
    marks: 1,
  },
  worked_maths: {
    ...base,
    type: 'worked_maths',
    prompt: 'Solve 2x + 3 = 7',
    answer: { solutions: ['2'] },
    verify: { method: 'solve', equation: '2x + 3 = 7', variable: 'x' },
    steps: ['2x + 3 = 7', '2x = 4', 'x = 2'],
    marks: 2,
    mark_scheme: ['M1 subtracts 3 from both sides', 'A1 x = 2'],
  },
  flashcard: {
    ...base,
    type: 'flashcard',
    front: 'Quadratic formula',
    back: 'x = (-b ± √(b² - 4ac)) / 2a',
  },
  extended_answer: {
    ...base,
    type: 'extended_answer',
    prompt: 'Prove that the sum of two consecutive odd numbers is a multiple of 4.',
    marks: 3,
    mark_scheme_ref: 'ms-proof-three-marks',
  },
};

for (const [type, item] of Object.entries(samples)) {
  test(`a valid ${type} item passes the item schema`, () => {
    assert.equal(v.item(item), true, JSON.stringify(v.item.errors));
  });
}

test('an item without a source reference fails', () => {
  const item = without(samples.numeric, 'source_ref');
  assert.equal(v.item(item), false);
  assert.match(JSON.stringify(v.item.errors), /source_ref/);
});

test('an item with an empty source reference fails', () => {
  assert.equal(v.item({ ...samples.numeric, source_ref: '' }), false);
});

test('an item without checked_by fails, and so does an empty list', () => {
  const item = without(samples.flashcard, 'checked_by');
  assert.equal(v.item(item), false);
  assert.equal(v.item({ ...samples.flashcard, checked_by: [] }), false);
});

test('an unknown item type fails', () => {
  assert.equal(v.item({ ...samples.short_answer, type: 'essay_mill' }), false);
});

test('a numeric item without a verify expression fails', () => {
  const item = without(samples.numeric, 'verify');
  assert.equal(v.item(item), false);
});

test('a worked maths item needs a verify method the engine understands', () => {
  assert.equal(v.item({ ...samples.worked_maths, verify: { method: 'guess' } }), false);
});

test('a worked maths item can check an expression answer in a required form', () => {
  const item = {
    ...samples.worked_maths,
    prompt: 'Factorise x^2 + 5x + 6',
    answer: { expression: '(x + 2)(x + 3)' },
    verify: { method: 'expression', expression: 'x^2 + 5x + 6', form: 'factorised' },
  };
  delete item.steps;
  assert.equal(v.item(item), true, JSON.stringify(v.item.errors));
});

test('an extended answer must point at a mark scheme', () => {
  const item = without(samples.extended_answer, 'mark_scheme_ref');
  assert.equal(v.item(item), false);
});

test('difficulty must be 1 to 5', () => {
  assert.equal(v.item({ ...samples.flashcard, difficulty: 6 }), false);
});

test('item ids are lowercase words joined by hyphens', () => {
  assert.equal(v.item({ ...samples.flashcard, id: 'Bad ID' }), false);
});

test('unknown fields are rejected so typos are caught', () => {
  assert.equal(v.item({ ...samples.flashcard, sourceRef: 'x' }), false);
});

const leaf = (id, ref) => ({
  id,
  title: `Topic ${id}`,
  spec_ref: [ref],
  citations: [citation({ supports: ['topic'] })],
});

const tree = {
  id: 'gcse-maths-edexcel-higher',
  subject: 'gcse-maths',
  board: 'edexcel',
  tier: 'higher',
  specification: {
    code: '1MA1',
    title: 'GCSE (9-1) Mathematics',
    url: 'https://example.org/spec.pdf',
  },
  verification: draft(),
  topics: [
    {
      id: 'gcse-maths-h-algebra',
      title: 'Algebra',
      children: [
        {
          id: 'gcse-maths-h-algebra-equations',
          title: 'Equations',
          children: [leaf('gcse-maths-h-a17', 'A17')],
        },
      ],
    },
  ],
};

test('a valid topic tree passes', () => {
  assert.equal(v.topicTree(tree), true, JSON.stringify(v.topicTree.errors));
});

test('a leaf topic without a specification reference fails', () => {
  const bad = structuredClone(tree);
  delete bad.topics[0].children[0].children[0].spec_ref;
  assert.equal(v.topicTree(bad), false);
});

test('a topic tree deeper than three levels fails', () => {
  const bad = structuredClone(tree);
  bad.topics[0].children[0].children[0] = {
    id: 'gcse-maths-h-too-deep',
    title: 'Too deep',
    children: [leaf('gcse-maths-h-a18', 'A18')],
  };
  assert.equal(v.topicTree(bad), false);
});

test('a valid subject passes', () => {
  const subject = {
    id: 'gcse-maths',
    name: 'Maths',
    level: 'GCSE',
    boards: [{ board: 'edexcel', spec_code: '1MA1', tiers: ['foundation', 'higher'] }],
  };
  assert.equal(v.subject(subject), true, JSON.stringify(v.subject.errors));
  assert.equal(v.subject({ ...subject, level: 'Degree' }), false);
});

test('points and levels mark schemes pass; an empty one fails', () => {
  const points = {
    id: 'ms-points',
    type: 'points',
    source_ref: 'Edexcel sample mark scheme style',
    citations: [citation({ source_type: 'mark_scheme', supports: ['mark_scheme'] })],
    verification: draft(),
    points: [{ code: 'M1', description: 'Correct method' }],
  };
  const levels = {
    id: 'ms-levels',
    type: 'levels',
    source_ref: 'Board level descriptors',
    citations: [citation({ source_type: 'mark_scheme', supports: ['mark_scheme'] })],
    verification: draft(),
    levels: [{ level: 1, marks: [1, 2], descriptor: 'Some relevant points' }],
  };
  assert.equal(v.markScheme(points), true, JSON.stringify(v.markScheme.errors));
  assert.equal(v.markScheme(levels), true, JSON.stringify(v.markScheme.errors));
  assert.equal(v.markScheme({ ...points, points: [] }), false);
});

test('an item without citations, or with an empty list, fails', () => {
  assert.equal(v.item(without(samples.numeric, 'citations')), false);
  assert.equal(v.item({ ...samples.numeric, citations: [] }), false);
});

for (const field of [
  'source_type',
  'publisher',
  'title',
  'document_ref',
  'url',
  'location',
  'supports',
]) {
  test(`a citation without ${field} fails`, () => {
    assert.equal(v.item({ ...samples.numeric, citations: [without(citation(), field)] }), false);
  });
}

test('a citation must use a known source type and an https url', () => {
  assert.equal(
    v.item({ ...samples.numeric, citations: [citation({ source_type: 'blog' })] }),
    false,
  );
  assert.equal(
    v.item({ ...samples.numeric, citations: [citation({ url: 'http://x.org' })] }),
    false,
  );
});

test('a quote needs the date it was retrieved, and a retrieval date needs a quote', () => {
  const quoteOnly = without(quotedCitation(), 'retrieved_at');
  const dateOnly = without(quotedCitation(), 'quote');
  assert.equal(v.item({ ...samples.numeric, citations: [quoteOnly] }), false);
  assert.equal(v.item({ ...samples.numeric, citations: [dateOnly] }), false);
  assert.equal(v.item({ ...samples.numeric, citations: [quotedCitation()] }), true);
});

test('a retrieval date must be an ISO date', () => {
  const bad = quotedCitation({ retrieved_at: '24/11/2026' });
  assert.equal(v.item({ ...samples.numeric, citations: [bad] }), false);
});

test('supports names known parts, including a distractor by index', () => {
  const ok = citation({ supports: ['distractor:2', 'explanation', 'diagram'] });
  assert.equal(v.item({ ...samples.numeric, citations: [ok] }), true);
  const bad = citation({ supports: ['vibes'] });
  assert.equal(v.item({ ...samples.numeric, citations: [bad] }), false);
});

test('an item without a verification record fails', () => {
  assert.equal(v.item(without(samples.numeric, 'verification')), false);
});

test('verification status, version and check results are restricted', () => {
  assert.equal(v.item({ ...samples.numeric, verification: { ...draft(), status: 'ok' } }), false);
  assert.equal(v.item({ ...samples.numeric, verification: { ...draft(), version: 0 } }), false);
  const failing = verified({ maths: true });
  failing.checks[0].result = 'maybe';
  assert.equal(v.item({ ...samples.numeric, verification: failing }), false);
  assert.equal(v.item({ ...samples.numeric, verification: verified({ maths: true }) }), true);
});

test('reviewed_by must be a role, not a person', () => {
  const named = { ...verified(), reviewed_by: 'Sam Smith' };
  assert.equal(v.item({ ...samples.numeric, verification: named }), false);
});

test('needs_human_approval is allowed on items', () => {
  assert.equal(v.item({ ...samples.numeric, needs_human_approval: true }), true);
});

test('a leaf topic without citations fails', () => {
  const bad = structuredClone(tree);
  delete bad.topics[0].children[0].children[0].citations;
  assert.equal(v.topicTree(bad), false);
});

test('a topic tree without a verification record fails', () => {
  assert.equal(v.topicTree(without(tree, 'verification')), false);
});

test('a mark scheme without citations fails', () => {
  const ms = {
    id: 'ms-points',
    type: 'points',
    source_ref: 'x',
    verification: draft(),
    points: [{ code: 'M1', description: 'Correct method' }],
  };
  assert.equal(v.markScheme(ms), false);
});

const diagram = {
  id: 'diagram-right-triangle',
  generated_by: 'code',
  format: 'svg',
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>',
  data: { a: 3, b: 4, c: 5 },
  alt: 'Right-angled triangle with sides 3, 4 and 5',
  citations: [citation({ supports: ['diagram'] })],
  verification: draft(),
};

test('a diagram drawn by code as SVG passes', () => {
  assert.equal(v.diagram(diagram), true, JSON.stringify(v.diagram.errors));
});

test('AI-generated or raster diagrams are refused', () => {
  assert.equal(v.diagram({ ...diagram, generated_by: 'ai' }), false);
  assert.equal(v.diagram({ ...diagram, format: 'png' }), false);
  assert.equal(v.diagram({ ...diagram, svg: 'data:image/png;base64,AAAA' }), false);
});

test('a diagram needs alt text, citations and a verification record', () => {
  for (const field of ['alt', 'citations', 'verification']) {
    assert.equal(v.diagram(without(diagram, field)), false, field);
  }
});

test('an item can point at a diagram', () => {
  assert.equal(v.item({ ...samples.numeric, diagram_ref: 'diagram-right-triangle' }), true);
});

test('grade boundaries are an allowed source type', () => {
  const c = citation({ source_type: 'grade_boundaries' });
  assert.equal(v.item({ ...samples.numeric, citations: [c] }), true);
});

test('a citation can record the SHA-256 of the archived source file', () => {
  const ok = citation({ sha256: 'a'.repeat(64) });
  assert.equal(v.item({ ...samples.numeric, citations: [ok] }), true);
  assert.equal(v.item({ ...samples.numeric, citations: [citation({ sha256: 'abc' })] }), false);
});

test('check names follow the verification pipeline', () => {
  const old = draft();
  old.checks = [
    {
      name: 'second-model',
      result: 'pass',
      tool: 'x',
      tool_version: '1',
      at: '2026-11-24T12:00:00Z',
    },
  ];
  assert.equal(v.item({ ...samples.numeric, verification: old }), false);
  assert.equal(
    v.item({ ...samples.numeric, verification: verified({ release: 'batch-sample' }) }),
    true,
  );
});
