import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLocation, locateQuote } from './locate.mjs';

test('reads page numbers from a location', () => {
  assert.deepEqual(parseLocation('page 12').pages, [12]);
  assert.deepEqual(parseLocation('p. 7, section 2').pages, [7]);
  assert.deepEqual(parseLocation('pages 12-14').pages, [12, 13, 14]);
  assert.deepEqual(parseLocation('pp. 3\u20134').pages, [3, 4]);
  assert.deepEqual(parseLocation('Page 9 and page 11').pages, [9, 11]);
});

test('reads specification point codes from a location', () => {
  assert.deepEqual(parseLocation('Subject content, reference N7').codes, ['N7']);
  assert.deepEqual(parseLocation('Specification point 4.2.1a').codes, ['4.2.1a']);
  assert.deepEqual(parseLocation('Section 3.1, A17 and G4').codes, ['3.1', 'A17', 'G4']);
  assert.deepEqual(parseLocation('Subject content').codes, []);
});

test('page numbers are not mistaken for codes', () => {
  assert.deepEqual(parseLocation('page 12').codes, []);
});

const spec = [
  'Contents and introduction',
  'Number N6 calculate with roots, and with integer and fractional indices N7 something else',
  'Algebra A17 solve linear equations in one unknown algebraically',
];

test('passes when the quote is on the stated page', () => {
  const r = locateQuote(
    { quote: 'solve linear equations in one unknown', location: 'page 3' },
    spec,
  );
  assert.deepEqual(r, { found: true, page: 3, locationConfirmed: true, reason: null });
});

test('fails when the quote is on a different page from the stated one', () => {
  const r = locateQuote(
    { quote: 'solve linear equations in one unknown', location: 'page 2' },
    spec,
  );
  assert.equal(r.found, true);
  assert.equal(r.page, 3);
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /found on page 3, not page 2/);
});

test('passes when the stated code appears just before the quote', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'reference A17' }, spec);
  assert.equal(r.locationConfirmed, true);
});

test('fails when the stated code is not next to the quote', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'reference N6' }, spec, {
    window: 20,
  });
  assert.equal(r.found, true);
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /the nearest code before the quote is A17, not N6/);
});

test('a code must match as a whole word (A1 is not A17)', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'reference A1' }, spec);
  assert.equal(r.locationConfirmed, false);
});

test('fails when the location has no page or code to check', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'Subject content' }, spec);
  assert.equal(r.found, true);
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /no page number or specification code/);
});

test('fails when the quote is not in the source at all', () => {
  const r = locateQuote({ quote: 'differentiate polynomials', location: 'page 3' }, spec);
  assert.deepEqual(r, {
    found: false,
    page: null,
    locationConfirmed: false,
    reason: 'quote not found in the source',
  });
});

test('finds a quote that runs from one page onto the next', () => {
  const pages = ['end of page one says solve linear', 'equations in one unknown on page two'];
  const r = locateQuote(
    { quote: 'solve linear equations in one unknown', location: 'pages 1-2' },
    pages,
  );
  assert.equal(r.found, true);
  assert.equal(r.page, 1);
  assert.equal(r.locationConfirmed, true);
});

test('a web page has no page numbers, so a page location cannot be confirmed there', () => {
  const r = locateQuote({ quote: 'solve linear', location: 'page 4' }, ['A17 solve linear'], {
    paged: false,
  });
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /web page has no page numbers/);
});

test('a page location may use the printed page number instead of the PDF page number', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'page 5' }, spec, {
    labels: [null, '4', '5'],
  });
  assert.equal(r.locationConfirmed, true);
  assert.equal(r.page, 3);
});

test('the wrong printed page number still fails', () => {
  const r = locateQuote({ quote: 'solve linear equations', location: 'page 4' }, spec, {
    labels: [null, '4', '5'],
  });
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /found on page 3 \(printed page 5\), not page 4/);
});

test('a code that comes just after the quote does not confirm the location', () => {
  const pages = ['N7 calculate with roots, and with integer indices N8 calculate exactly'];
  const r = locateQuote({ quote: 'calculate with roots', location: 'N8' }, pages);
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /the nearest code before the quote is N7, not N8/);
});

test('the nearest code before the quote must be the stated one, not an earlier one', () => {
  const pages = ['N6 use powers N7 calculate with roots'];
  const r = locateQuote({ quote: 'calculate with roots', location: 'N6' }, pages);
  assert.equal(r.locationConfirmed, false);
});

test('a section code also confirms a quote from one of its subsections', () => {
  const pages = ['4.2 Topic 4.2.1 Sub topic 4.2.1.3 fixture quoted words here'];
  const r = locateQuote({ quote: 'fixture quoted words', location: 'section 4.2.1' }, pages);
  assert.equal(r.locationConfirmed, true);
});

test('a code inside the quote itself confirms the location', () => {
  const pages = ['N7 calculate with roots'];
  const r = locateQuote({ quote: 'N7 calculate with roots', location: 'N7' }, pages);
  assert.equal(r.locationConfirmed, true);
});
