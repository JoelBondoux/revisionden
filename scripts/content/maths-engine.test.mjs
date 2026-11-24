// Runs the real Python maths engine. Needs: pip install -r services/maths/requirements.txt
// Set MATHS_PYTHON to the Python that has those packages (default python3).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPythonChecker } from './maths-engine.mjs';

const python = process.env.MATHS_PYTHON ?? 'python3';

test('the Python engine confirms right answers and rejects wrong ones', async () => {
  const check = createPythonChecker({ python });
  const results = await check([
    { id: 'right', kind: 'solve', equation: '3x^2 + 5x - 2 = 0', solutions: ['1/3', '-2'] },
    { id: 'wrong', kind: 'value', expression: '3/4 * 120', answer: '80' },
  ]);
  assert.deepEqual(
    results.map((r) => [r.id, r.ok]),
    [
      ['right', true],
      ['wrong', false],
    ],
  );
});

test('an empty list of checks does not start Python', async () => {
  const check = createPythonChecker({ python: 'definitely-not-a-python' });
  assert.deepEqual(await check([]), []);
});

test('a missing Python gives a clear error', async () => {
  const check = createPythonChecker({ python: 'definitely-not-a-python' });
  await assert.rejects(
    check([{ id: 'a', kind: 'value', expression: '1', answer: '1' }]),
    /could not run the maths engine/,
  );
});

test('a failing engine process gives a clear error', async () => {
  const check = createPythonChecker({ python, args: ['-c', 'import sys; sys.exit(3)'] });
  await assert.rejects(
    check([{ id: 'a', kind: 'value', expression: '1', answer: '1' }]),
    /maths engine exited with code 3/,
  );
});
