import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cleanText, withCheck } from './record.mjs';

const draft = { id: 'x', verification: { status: 'draft', version: 1, checks: [] } };

test('model output written into a check has control characters replaced, keeping tab and newline', () => {
  assert.equal(cleanText('a\u0000b\u000bc\rd\te\nf'), 'a b c d\te\nf');
  const out = withCheck(draft, {
    name: 'fact-check',
    result: 'fail',
    tool: 'x\u0000',
    tool_version: '1',
    at: '2026-11-25T00:00:00Z',
    notes: 'blind statement ("tan\u0000 90")',
  });
  assert.deepEqual(out.verification.checks[0], {
    name: 'fact-check',
    result: 'fail',
    tool: 'x ',
    tool_version: '1',
    at: '2026-11-25T00:00:00Z',
    notes: 'blind statement ("tan  90")',
  });
});
