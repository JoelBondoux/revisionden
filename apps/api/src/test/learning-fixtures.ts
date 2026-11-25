/**
 * Made-up content in the content/ format for learning tests. Not educational content: every
 * question, answer and citation here is fake on purpose.
 */
import type { ContentItem, ContentTopicTree } from '../learning/content-sync';

const citations = [
  {
    source_type: 'specification',
    publisher: 'Test board',
    title: 'Test specification',
    document_ref: 'TEST-1',
    url: 'https://example.com/test-spec',
    location: 'Test reference 1',
    supports: ['question'],
  },
];

const verified = { status: 'verified', version: 1, checks: [] };
const draft = { status: 'draft', version: 1, checks: [] };
const quarantined = { status: 'quarantined', version: 1, checks: [] };

export const TEST_SUBJECT = 'test-subject';

export const testTopicTree: ContentTopicTree = {
  id: 'test-tree',
  subject: TEST_SUBJECT,
  board: 'test-board',
  topics: [
    {
      id: 'test-unit',
      title: 'Test unit',
      children: [
        { id: 'test-topic-a', title: 'Test topic A', spec_ref: ['T1'], citations },
        { id: 'test-topic-b', title: 'Test topic B', spec_ref: ['T2'], citations },
        // No items at all: shows as locked on the topic map (F2).
        { id: 'test-topic-c', title: 'Test topic C', spec_ref: ['T3'], citations },
      ],
    },
  ],
};

const common = { source_ref: 'Test specification reference T1', checked_by: ['author'], citations };

export const testItems: ContentItem[] = [
  {
    ...common,
    id: 'test-mc-0001',
    topic: 'test-topic-a',
    type: 'multiple_choice',
    difficulty: 3,
    prompt: 'Test question 1',
    options: ['Option A', 'Option B', 'Option C'],
    answer: { option: 1 },
    marks: 1,
    explanation: 'Test explanation 1',
    verification: verified,
  },
  {
    ...common,
    id: 'test-short-0001',
    topic: 'test-topic-a',
    type: 'short_answer',
    difficulty: 2,
    prompt: 'Test question 2',
    answer: { accepted: ['test answer'] },
    marks: 1,
    verification: verified,
  },
  {
    ...common,
    id: 'test-num-0001',
    topic: 'test-topic-b',
    type: 'numeric',
    difficulty: 3,
    prompt: 'Test question 3',
    answer: { value: '4', unit: 'cm' },
    verify: { expression: '2+2' },
    marks: 1,
    hint: 'Test hint 3',
    verification: verified,
  },
  {
    ...common,
    id: 'test-work-0001',
    topic: 'test-topic-b',
    type: 'worked_maths',
    difficulty: 3,
    prompt: 'Test question 4',
    answer: { solutions: ['2'] },
    verify: { method: 'solve', equation: 'x + 1 = 3', variable: 'x' },
    marks: 2,
    verification: verified,
  },
  {
    ...common,
    id: 'test-card-0001',
    topic: 'test-topic-a',
    type: 'flashcard',
    difficulty: 1,
    front: 'Test front 1',
    back: 'Test back 1',
    verification: verified,
  },
  {
    ...common,
    id: 'test-long-0001',
    topic: 'test-topic-b',
    type: 'extended_answer',
    difficulty: 4,
    prompt: 'Test question 6',
    marks: 6,
    mark_scheme_ref: 'test-mark-scheme',
    verification: verified,
  },
  {
    ...common,
    id: 'test-draft-0001',
    topic: 'test-topic-a',
    type: 'multiple_choice',
    difficulty: 3,
    prompt: 'Draft question 1',
    options: ['Draft A', 'Draft B'],
    answer: { option: 0 },
    marks: 1,
    verification: draft,
  },
  {
    ...common,
    id: 'test-draft-card-0001',
    topic: 'test-topic-a',
    type: 'flashcard',
    difficulty: 1,
    front: 'Draft front 1',
    back: 'Draft back 1',
    verification: draft,
  },
  {
    ...common,
    id: 'test-quarantined-0001',
    topic: 'test-topic-b',
    type: 'multiple_choice',
    difficulty: 3,
    prompt: 'Quarantined question 1',
    options: ['Q A', 'Q B'],
    answer: { option: 0 },
    marks: 1,
    verification: quarantined,
  },
  {
    ...common,
    id: 'test-command-0001',
    topic: 'test-topic-a',
    type: 'multiple_choice',
    difficulty: 2,
    tags: ['command-word'],
    prompt: 'Test command word question 1',
    options: ['Word A', 'Word B'],
    answer: { option: 0 },
    marks: 1,
    verification: verified,
  },
];

export const DRAFT_PROMPTS = ['Draft question 1', 'Draft front 1', 'Quarantined question 1'];
