// Checks the real A-Level Computer Science topic tree (OCR H446, board provisional).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './validate.mjs';

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');
const content = await loadContent(CONTENT);
const tree = content.topicTrees.find((t) => t.data.id === 'alevel-computer-science-ocr-h446');
const subject = content.subjects.find((s) => s.data.id === 'alevel-computer-science');

const SPEC_URL =
  'https://www.ocr.org.uk/Images/170844-specification-accredited-a-level-gce-computer-science-h446.pdf';

// Lettered points per subsection in section 2c of H446 version 3.0 (Components 01 and 02).
// 1.5.2 has no lettered points, so it is one reference on its own.
const POINTS = {
  '1.1.1': 5,
  '1.1.2': 3,
  '1.1.3': 4,
  '1.2.1': 8,
  '1.2.2': 6,
  '1.2.3': 3,
  '1.2.4': 5,
  '1.3.1': 4,
  '1.3.2': 6,
  '1.3.3': 5,
  '1.3.4': 4,
  '1.4.1': 10,
  '1.4.2': 3,
  '1.4.3': 5,
  '1.5.1': 4,
  '1.5.2': 0,
  '2.1.1': 4,
  '2.1.2': 4,
  '2.1.3': 4,
  '2.1.4': 3,
  '2.1.5': 2,
  '2.2.1': 6,
  '2.2.2': 6,
  '2.3.1': 6,
};
const SPEC_REFS = Object.entries(POINTS).flatMap(([code, n]) =>
  n === 0 ? [code] : Array.from({ length: n }, (_, i) => `${code}(${'abcdefghij'[i]})`),
);

function leaves(nodes, depth = 1, found = []) {
  for (const node of nodes) {
    if (node.children) leaves(node.children, depth + 1, found);
    else found.push({ node, depth });
  }
  return found;
}

test('the A-Level Computer Science subject offers OCR H446', () => {
  assert.ok(subject, 'content/subjects should hold alevel-computer-science');
  assert.equal(subject.data.level, 'A-Level');
  assert.deepEqual(subject.data.boards, [{ board: 'ocr', spec_code: 'H446' }]);
});

test('the H446 tree exists, links to the subject and says the board is provisional', () => {
  assert.ok(tree, 'content/topic-trees should hold alevel-computer-science-ocr-h446');
  assert.equal(tree.data.subject, 'alevel-computer-science');
  assert.equal(tree.data.board, 'ocr');
  assert.equal(tree.data.specification.code, 'H446');
  assert.match(tree.data.notes, /provisional/i);
});

test('the H446 tree is at most three levels deep', () => {
  for (const { node, depth } of leaves(tree.data.topics)) {
    assert.ok(depth <= 3, `${node.id} is at depth ${depth}`);
  }
});

test('every H446 specification point appears exactly once', () => {
  const refs = leaves(tree.data.topics).flatMap(({ node }) => node.spec_ref);
  assert.deepEqual([...refs].sort(), [...SPEC_REFS].sort());
});

test('every H446 leaf cites the specification with a quote at a checkable location', () => {
  for (const { node } of leaves(tree.data.topics)) {
    assert.equal(node.citations.length, 1, node.id);
    const [c] = node.citations;
    assert.equal(c.source_type, 'specification', node.id);
    assert.equal(c.url, SPEC_URL, node.id);
    assert.ok(c.quote && c.retrieved_at, `${node.id} has no quote`);
    const code = node.spec_ref[0].replace(/\(.\)$/, '');
    assert.ok(c.location.includes(code), `${node.id} location does not name ${code}`);
    assert.match(c.location, /PDF page \d+/, node.id);
  }
});

test('the H446 tree stays draft', () => {
  assert.equal(tree.data.verification.status, 'draft');
});

test('every A-Level Computer Science item links to an H446 leaf and stays draft', () => {
  const ids = new Set(leaves(tree.data.topics).map(({ node }) => node.id));
  const items = content.items.filter(({ data }) => data.topic.startsWith('alevel-cs-'));
  assert.ok(items.length >= 110, `only ${items.length} items`);
  for (const { data } of items) {
    assert.ok(ids.has(data.topic), `${data.id} -> ${data.topic}`);
    assert.equal(data.verification.status, 'draft', data.id);
    assert.ok(data.hint && data.explanation, `${data.id} needs a hint and an explanation`);
    assert.ok(
      data.citations.every((c) => c.quote && c.url === SPEC_URL),
      data.id,
    );
  }
});
