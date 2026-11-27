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
