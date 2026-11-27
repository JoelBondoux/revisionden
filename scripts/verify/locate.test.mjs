import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLocation, locateQuote } from './locate.mjs';
import { htmlToText } from './extract.mjs';

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
  assert.deepEqual(r, {
    found: true,
    page: 3,
    locationConfirmed: true,
    reason: null,
    match: 'exact',
    confidence: 1,
  });
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
    match: null,
    confidence: null,
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

test('a quote that appears more than once passes if any copy is at the stated location', () => {
  const pages = [
    'Foundation tier A17 solve linear equations in one unknown',
    'Higher tier A17 solve linear equations in one unknown',
  ];
  const r = locateQuote({ quote: 'solve linear equations', location: 'page 2, A17' }, pages);
  assert.equal(r.locationConfirmed, true);
  assert.equal(r.page, 2);
});

test('when no copy is at the stated location, the reason names the first copy', () => {
  const pages = ['A17 solve linear equations', 'A17 solve linear equations', 'other'];
  const r = locateQuote({ quote: 'solve linear equations', location: 'page 3' }, pages);
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /found on page 1, not page 3/);
});

test('a quote split by PDF spacing is a near match (letters), never an exact one', () => {
  const pages = ['A25 deduce expressions to calculate the n th term of linear sequences'];
  const r = locateQuote({ quote: 'calculate the nth term', location: 'A25' }, pages);
  assert.equal(r.found, true);
  assert.equal(r.locationConfirmed, true);
  assert.equal(r.match, 'letters');
});

test('an exact match says so, with full confidence', () => {
  const r = locateQuote({ quote: 'nth term', location: 'A25' }, ['A25 the nth term']);
  assert.equal(r.match, 'exact');
  assert.equal(r.confidence, 1);
});

test('ignoring spacing never changes the letters: a different word still fails', () => {
  const r = locateQuote({ quote: 'calculate the 9th term', location: 'A25' }, [
    'A25 calculate the n th term',
  ]);
  assert.equal(r.found, false);
});

const PDFTOTEXT = JSON.parse(
  readFileSync(new URL('./fixtures/pdftotext-cases.json', import.meta.url), 'utf8'),
).cases;

for (const c of PDFTOTEXT) {
  test(`pdftotext case: ${c.case} is found as a near match at its location`, () => {
    const pages = [...Array(c.pdf_page - 1).fill(''), c.extracted_text];
    const r = locateQuote({ quote: c.quote, location: c.location }, pages);
    assert.equal(r.found, true, r.reason);
    assert.equal(r.locationConfirmed, true, r.reason);
    assert.notEqual(r.match, 'exact');
    assert.ok(r.confidence > 0 && r.confidence <= 1);
  });
}

test('a dropped line-end hyphen is a letters match with full confidence', () => {
  const r = locateQuote({ quote: 'a position-to-term rule', location: 'A23' }, [
    'A23 either a term-to-term or a position-toterm rule',
  ]);
  assert.equal(r.match, 'letters');
});

test('reordered or interrupted words are a words match with a confidence below 1', () => {
  const pages = [
    'G23 know and apply Area = angles of any triangle 1 ab sin C to calculate the area, sides or 2',
  ];
  const r = locateQuote(
    { quote: 'to calculate the area, sides or angles of any triangle', location: 'G23' },
    pages,
  );
  assert.equal(r.match, 'words');
  assert.ok(r.confidence < 1 && r.confidence >= 0.5, String(r.confidence));
});

test('a word that is not in the source is still not found, even by the word fallback', () => {
  const pages = ['N7 calculate with roots, and with integer and fractional indices'];
  const r = locateQuote(
    { quote: 'calculate with roots, and with integer and decimal indices', location: 'N7' },
    pages,
  );
  assert.equal(r.found, false);
});

test('words scattered far apart are not a match', () => {
  const filler = Array(80).fill('other').join(' ');
  const pages = [`N7 calculate ${filler} with roots ${filler} and indices`];
  const r = locateQuote({ quote: 'calculate with roots and indices', location: 'N7' }, pages);
  assert.equal(r.found, false);
});

// UK legislation pages (legislation.gov.uk, lead's ruling for S4) have no pages or spec codes;
// a "Part III" location must be the nearest Part heading before the quote. Part headings are
// heading elements on the page, as on legislation.gov.uk (<h3 class="LegSchedulePart">).
const partHeading = (no, title) =>
  `<h3 class="LegSchedulePart"><span class="LegPartNo">Part ${no}<span>U.K.</span></span>` +
  `<span class="LegPartTitle">${title}</span></h3>`;
const act = [
  htmlToText(
    `<h2>Schedule 1</h2>${partHeading('I', 'Measurement of Length')}<p>Metric units</p>` +
      '<p>Kilometre = 1000 metres.</p><p>Centimetre = 1/100 metre.</p>' +
      `${partHeading('III', 'Measurement of Volume')}<p>Metric units</p>` +
      '<p>Cubic centimetre = 1/1000 cubic decimetre.</p><p>LITRE = a cubic decimetre.</p>' +
      `<p>Millilitre = 1/1000 litre.</p>${partHeading('V', 'Measurement of Mass')}` +
      '<p>Gram = 1/1000 kilogram.</p>',
  ),
];

test('reads a legislation Part from a location', () => {
  assert.deepEqual(parseLocation('Schedule 1, Part III (Measurement of Volume)').parts, ['III']);
  assert.deepEqual(parseLocation('page 4').parts, []);
});

test('a legislation quote passes under the Part heading that comes before it', () => {
  const r = locateQuote(
    {
      quote: 'Millilitre = 1/1000 litre.',
      location: 'Schedule 1, Part III (Measurement of Volume)',
    },
    act,
    { paged: false },
  );
  assert.equal(r.found, true);
  assert.equal(r.locationConfirmed, true);
});

test('a legislation quote fails under the wrong Part', () => {
  const r = locateQuote(
    { quote: 'Gram = 1/1000 kilogram.', location: 'Schedule 1, Part III' },
    act,
    {
      paged: false,
    },
  );
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /Part V, not Part III/);
});

test('a Part heading far before the quote still counts (Codex on #435)', () => {
  const long = [
    htmlToText(
      `${partHeading('III', 'Measurement of Volume')}<p>${'Some intervening text. '.repeat(120)}</p>` +
        '<p>Millilitre = 1/1000 litre.</p>',
    ),
  ];
  const r = locateQuote(
    { quote: 'Millilitre = 1/1000 litre.', location: 'Schedule 1, Part III' },
    long,
    { paged: false },
  );
  assert.equal(r.locationConfirmed, true);
});

test('a "See Part III" cross-reference in the text is not a Part heading (Codex on #435)', () => {
  const page = [
    htmlToText(
      `${partHeading('V', 'Measurement of Mass')}<p>See Part III for volume units.</p>` +
        '<p>Gram = 1/1000 kilogram.</p>',
    ),
  ];
  const right = locateQuote(
    { quote: 'Gram = 1/1000 kilogram.', location: 'Schedule 1, Part V' },
    page,
    { paged: false },
  );
  assert.equal(right.locationConfirmed, true);
  const wrong = locateQuote(
    { quote: 'Gram = 1/1000 kilogram.', location: 'Schedule 1, Part III' },
    page,
    { paged: false },
  );
  assert.equal(wrong.locationConfirmed, false);
  assert.match(wrong.reason, /Part V, not Part III/);
});

test('a Part named only in running text, with no heading, does not confirm a Part', () => {
  const r = locateQuote(
    { quote: 'Gram = 1/1000 kilogram.', location: 'Schedule 1, Part III' },
    ['See Part III for volume units. Gram = 1/1000 kilogram.'],
    { paged: false },
  );
  assert.equal(r.locationConfirmed, false);
  assert.match(r.reason, /no Part heading before the quote/);
});
