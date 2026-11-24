// Checks the real content in content/ (the GCSE Maths Higher pilot).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent, validateContent } from './validate.mjs';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');
const content = await loadContent(CONTENT);
const pilot = content.topicTrees.find((t) => t.data.id === 'gcse-maths-edexcel-1ma1-higher');

function leaves(nodes, depth = 1, found = []) {
  for (const node of nodes) {
    if (node.children) leaves(node.children, depth + 1, found);
    else found.push({ node, depth });
  }
  return found;
}

const range = (letter, last) => Array.from({ length: last }, (_, i) => `${letter}${i + 1}`);
const SPEC_CODES = [
  ...range('N', 16),
  ...range('A', 25),
  ...range('R', 16),
  ...range('G', 25),
  ...range('P', 9),
  ...range('S', 6),
];

test('the GCSE Maths Higher pilot tree exists', () => {
  assert.ok(pilot, 'content/topic-trees should hold gcse-maths-edexcel-1ma1-higher');
});

test('all content passes the schemas and link checks', async () => {
  assert.deepEqual(await validateContent(content, { checkMaths: null }), []);
});

test('every leaf topic in the pilot has a specification reference', () => {
  for (const { node } of leaves(pilot.data.topics)) {
    assert.ok(node.spec_ref?.length, `${node.id} has no spec_ref`);
  }
});

test('the pilot tree is at most three levels deep', () => {
  for (const { node, depth } of leaves(pilot.data.topics)) {
    assert.ok(depth <= 3, `${node.id} is at depth ${depth}`);
  }
});

test('every specification content reference appears exactly once', () => {
  const refs = leaves(pilot.data.topics).flatMap(({ node }) => node.spec_ref);
  assert.deepEqual([...refs].sort(), [...SPEC_CODES].sort());
});

test('every pilot item links to a pilot topic and records how it was checked', () => {
  const ids = new Set(leaves(pilot.data.topics).map(({ node }) => node.id));
  assert.ok(content.items.length >= 6);
  for (const { data } of content.items) {
    assert.ok(ids.has(data.topic), `${data.id} -> ${data.topic}`);
    assert.ok(data.source_ref && data.checked_by.length);
  }
});
