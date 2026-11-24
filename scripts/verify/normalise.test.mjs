import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normaliseText, findQuote } from './normalise.mjs';

test('collapses runs of spaces, tabs and new lines into one space', () => {
  assert.equal(
    normaliseText('solve  linear\n\tequations \r\n in one'),
    'solve linear equations in one',
  );
});

test('expands ligatures that PDFs often contain', () => {
  assert.equal(
    normaliseText('\ufb01nd the e\ufb00ect of \ufb02ow, \ufb03x and \ufb04y'),
    'find the effect of flow, ffix and ffly',
  );
});

test('turns curly quotes, dashes and non-breaking spaces into plain characters', () => {
  assert.equal(
    normaliseText('\u2018a\u2019 \u201cb\u201d c \u2013 d \u2014 e\u00a0f'),
    '\'a\' "b" c - d - e f',
  );
});

test('removes soft hyphens and joins words split across a line break', () => {
  assert.equal(
    normaliseText('alge\u00adbraically and equa-\ntions'),
    'algebraically and equations',
  );
});

test('keeps a hyphen that is part of the text', () => {
  assert.equal(normaliseText('a two-way table'), 'a two-way table');
});

test('treats the multiplication sign and minus sign as the source wrote them, but unifies minus with hyphen', () => {
  assert.equal(normaliseText('x \u2212 3'), 'x - 3');
});

test('keeps letter case, so a quote must match exactly', () => {
  assert.equal(normaliseText('Solve'), 'Solve');
  assert.equal(findQuote('solve linear equations', 'We Solve Linear Equations'), -1);
});

test('finds a quote after normalising both sides', () => {
  const source = 'Students should be taught to:\n solve linear equa-\ntions in one unknown';
  assert.ok(findQuote('solve linear equations in one unknown', source) > 0);
});

test('does not find a quote that is not in the source', () => {
  assert.equal(findQuote('solve quadratic equations', 'solve linear equations'), -1);
});

test('an empty quote never counts as found', () => {
  assert.equal(findQuote('   ', 'anything'), -1);
});

test('ignores spaces that PDFs put inside brackets and before punctuation', () => {
  assert.equal(
    normaliseText('equations ( including those ) by factorising , and formula ; find it .'),
    'equations (including those) by factorising, and formula; find it.',
  );
  assert.ok(findQuote('use the symbols =, ≠, <, >', 'use the symbols   = , ≠,   <, > , ≤') >= 0);
});

test('still keeps the words themselves exact', () => {
  assert.equal(findQuote('by factorising', 'by factor ising'), -1);
});
