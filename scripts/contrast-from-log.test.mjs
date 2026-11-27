import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resultsFromLog } from '../e2e/scripts/contrast-from-log.mjs';

// W21b: the painted workflow prints each test's findings into its job log, so the known list can
// be made from what CI draws. A log line carries GitHub's timestamp in front.
const at = '2026-11-27T04:03:00.3354371Z ';

test('reads every result file a CI log printed, without the timestamps', () => {
  const log = [
    `${at}Run the painted sweep`,
    `${at}CONTRAST-RESULT tier2-phone-light-standard-%2Funlock.json`,
    `${at}{`,
    `${at}  "comic-pop|light|/unlock|text|\\".\\" has too few letter pixels to check": "x @ 0"`,
    `${at}}`,
    `${at}CONTRAST-END`,
    `${at}CONTRAST-RESULT tier2-desktop-dark-standard-%2Fabout.json`,
    `${at}{}`,
    `${at}CONTRAST-END`,
  ].join('\n');
  assert.deepEqual(resultsFromLog(log), {
    'tier2-phone-light-standard-%2Funlock.json': {
      'comic-pop|light|/unlock|text|"." has too few letter pixels to check': 'x @ 0',
    },
    'tier2-desktop-dark-standard-%2Fabout.json': {},
  });
});

test('a result cut off before its end is refused, so a broken log cannot shorten the list', () => {
  const log = `${at}CONTRAST-RESULT tier2-phone-light-standard-%2F.json\n${at}{\n`;
  assert.throws(() => resultsFromLog(log), /tier2-phone-light-standard-%2F\.json/);
});

test("applies CI's differences to the known list: its new rows in, the rows it no longer finds out", async () => {
  const { applyDiffs } = await import('../e2e/scripts/contrast-from-log.mjs');
  const known = {
    decision: '0012',
    tier1: { kept: 1 },
    tier2: { 'a|light|/x|text|"Old"': '1.20 @ 0', 'b|light|/x|text|"Stays"': '2.00 @ 0' },
  };
  const diffs = {
    'diff-tier2-phone-light-standard-%2Fx.json': {
      new: { 'a|light|/x|text|"New"': '3.10 @ 640' },
      fixed: ['a|light|/x|text|"Old"'],
    },
  };
  assert.deepEqual(applyDiffs(known, diffs), {
    decision: '0012',
    tier1: { kept: 1 },
    tier2: { 'a|light|/x|text|"New"': '3.10 @ 640', 'b|light|/x|text|"Stays"': '2.00 @ 0' },
  });
});
