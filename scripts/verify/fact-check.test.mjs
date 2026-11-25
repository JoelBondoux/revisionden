import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JUDGE_SYSTEM, factJudgePrompt, factStatementPrompt, runFactCheck } from './fact-check.mjs';
import { draftItem, quoted } from './test-content.mjs';

// Made-up facts for tests only; not RevisionDen educational content.
const AT = () => new Date('2026-11-25T12:00:00Z');

function fakeProvider(provider, outputs) {
  const requests = [];
  let i = 0;
  return {
    provider,
    model: `${provider}-fixture-model`,
    requests,
    async complete(req) {
      requests.push(req);
      const output = outputs[Math.min(i, outputs.length - 1)];
      i += 1;
      return { output, modelVersion: `${provider}-fixture-model-001` };
    },
  };
}

const fakeMaths = (ok) => {
  const calls = [];
  return {
    calls,
    maths: async (checks) => (calls.push(...checks), checks.map((c) => ({ id: c.id, ok }))),
  };
};

const fact = {
  statement: 'Fixture fact statement.',
  ask: 'Fixture question about the fact?',
  engine: { kind: 'identity', equation: 'a + b = b + a' },
};

const item = (facts, checks = []) =>
  draftItem('fixture-fact-item', [quoted()], {
    facts,
    verification: { status: 'draft', version: 1, checks },
  });

const stated = (statement, confidence = 'high') => ({ statement, confidence, reasoning: 'r' });
const judged = (same, confidence = 'high') => ({ same, confidence, reason: 'fixture reason' });

test('the blind statement prompt asks the neutral question, never our wording', () => {
  const { prompt } = factStatementPrompt(fact);
  assert.match(prompt, /Fixture question about the fact\?/);
  assert.doesNotMatch(prompt, /Fixture fact statement/);
});

test('a fact passes on an official citation only when the judge confirms the quote states it', async () => {
  const stater = fakeProvider('openai', [stated('x')]);
  const judge = fakeProvider('gemini', [judged(true)]);
  const { maths, calls } = fakeMaths(true);
  const checks = [{ name: 'quote-check', result: 'pass', tool: 't', tool_version: '1', at: 'x' }];
  const r = await runFactCheck(item([{ ...fact, citation: 1 }], checks), {
    stater,
    judge,
    maths,
    now: AT,
  });
  assert.equal(r.result, 'pass');
  assert.equal(stater.requests.length, 0);
  assert.equal(calls.length, 0);
  assert.match(judge.requests[0].prompt, /solve linear equations/);
  assert.match(judge.requests[0].prompt, /Fixture fact statement\./);
  assert.match(r.check.notes, /fact 1: official \(citation 1, the quote states it\)/);
});

test('a cited quote that does not state the fact falls back to proof and blind statement', async () => {
  const stater = fakeProvider('openai', [stated('Same fact.')]);
  const judge = fakeProvider('gemini', [judged(false), judged(true)]);
  const checks = [{ name: 'quote-check', result: 'pass', tool: 't', tool_version: '1', at: 'x' }];
  const r = await runFactCheck(item([{ ...fact, citation: 1 }], checks), {
    stater,
    judge,
    maths: fakeMaths(true).maths,
    now: AT,
  });
  assert.equal(stater.requests.length, 1);
  assert.equal(r.result, 'pass');
  assert.match(r.check.notes, /citation 1 does not state it; maths engine proof pass/);
});

test('a citation counts only once the quote check has passed', async () => {
  const stater = fakeProvider('openai', [stated('Fixture fact statement.')]);
  const judge = fakeProvider('gemini', [judged(true)]);
  const r = await runFactCheck(item([{ ...fact, citation: 1 }]), {
    stater,
    judge,
    maths: fakeMaths(true).maths,
    now: AT,
  });
  assert.equal(stater.requests.length, 1);
  assert.equal(r.result, 'pass');
});

test('otherwise a fact needs both a maths engine proof and a matching blind statement', async () => {
  const stater = fakeProvider('openai', [stated('Same fact, other words.')]);
  const judge = fakeProvider('gemini', [judged(true)]);
  const { maths, calls } = fakeMaths(true);
  const r = await runFactCheck(item([fact]), { stater, judge, maths, now: AT });
  assert.equal(r.result, 'pass');
  assert.deepEqual(calls, [
    { id: 'fixture-fact-item#1', kind: 'identity', equation: 'a + b = b + a' },
  ]);
  assert.match(judge.requests[0].prompt, /Fixture fact statement\./);
  assert.match(judge.requests[0].prompt, /Same fact, other words\./);
  assert.deepEqual(r.check, {
    name: 'fact-check',
    result: 'pass',
    tool: 'openai:openai-fixture-model + gemini:gemini-fixture-model + maths-engine',
    tool_version: 'openai-fixture-model-001; gemini-fixture-model-001',
    at: '2026-11-25T12:00:00Z',
    notes: 'fact 1: maths engine proof pass; blind statement matches ("Same fact, other words.")',
  });
});

test('a fact the maths engine cannot prove fails, labelled for a person', async () => {
  const noEngine = { statement: fact.statement, ask: fact.ask };
  const r = await runFactCheck(item([noEngine]), {
    stater: fakeProvider('openai', [stated('Same fact.')]),
    judge: fakeProvider('gemini', [judged(true)]),
    maths: fakeMaths(true).maths,
    now: AT,
  });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /fact 1: no maths engine proof; blind statement matches/);
});

test('a failed proof, a different statement or an unsure answer fails the fact', async () => {
  const cases = [
    {
      ok: false,
      statement: stated('Same.'),
      verdict: judged(true),
      why: /maths engine proof fails/,
    },
    {
      ok: true,
      statement: stated('Other.'),
      verdict: judged(false),
      why: /blind statement differs/,
    },
    {
      ok: true,
      statement: stated('Same.', 'low'),
      verdict: judged(true),
      why: /statement confidence low/,
    },
    {
      ok: true,
      statement: stated('Same.'),
      verdict: judged(true, 'medium'),
      why: /judge confidence medium/,
    },
  ];
  for (const c of cases) {
    const r = await runFactCheck(item([fact]), {
      stater: fakeProvider('openai', [c.statement]),
      judge: fakeProvider('gemini', [c.verdict]),
      maths: fakeMaths(c.ok).maths,
      now: AT,
    });
    assert.equal(r.result, 'fail');
    assert.match(r.check.notes, c.why);
  }
});

test('every fact must pass', async () => {
  const r = await runFactCheck(item([fact, { statement: 'Second.', ask: 'Second?' }]), {
    stater: fakeProvider('openai', [stated('Same.')]),
    judge: fakeProvider('gemini', [judged(true)]),
    maths: fakeMaths(true).maths,
    now: AT,
  });
  assert.equal(r.result, 'fail');
  assert.match(r.check.notes, /fact 1: maths engine proof pass.*fact 2: no maths engine proof/);
});

test('the blind statement must come from a third provider', async () => {
  const blindByOpenAI = [
    { name: 'blind-answer', result: 'pass', tool: 'openai:x', tool_version: '1', at: 'x' },
  ];
  const opts = {
    judge: fakeProvider('gemini', [judged(true)]),
    maths: fakeMaths(true).maths,
    now: AT,
  };
  await assert.rejects(
    runFactCheck(item([fact]), { ...opts, stater: fakeProvider('anthropic', [stated('x')]) }),
    /different provider from the writer/,
  );
  await assert.rejects(
    runFactCheck(item([fact], blindByOpenAI), {
      ...opts,
      stater: fakeProvider('openai', [stated('x')]),
    }),
    /different provider from the blind answer/,
  );
  await assert.rejects(
    runFactCheck(item([fact]), {
      ...opts,
      stater: fakeProvider('openai', [stated('x')]),
      judge: fakeProvider('openai', [judged(true)]),
    }),
    /judge must be a different provider from the statement/,
  );
});

test('an item without facts has nothing to fact-check', async () => {
  await assert.rejects(
    runFactCheck(draftItem('fixture-plain'), {
      stater: fakeProvider('openai', []),
      judge: fakeProvider('gemini', []),
      maths: fakeMaths(true).maths,
      now: AT,
    }),
    /has no facts to check/,
  );
});

test('the judge compares meaning, not wording: implied conditions and extra explanation are fine', () => {
  assert.match(JUDGE_SYSTEM, /meaning, not wording/);
  assert.match(JUDGE_SYSTEM, /non-vertical/);
  assert.match(JUDGE_SYSTEM, /explanation|example/);
  assert.match(JUDGE_SYSTEM, /further related facts/);
});

test('the judge still refuses a contradiction, a missing part or condition, or a narrower case', () => {
  for (const rule of [/contradicts/, /leaves out part of A|leaves out a condition/, /narrower/]) {
    assert.match(JUDGE_SYSTEM, rule);
  }
  assert.match(JUDGE_SYSTEM, /If you are unsure/);
});

test('the judge prompt shows both statements, ours as A', () => {
  const { system, prompt } = factJudgePrompt('OUR FACT', 'THEIR FACT');
  assert.equal(system, JUDGE_SYSTEM);
  assert.ok(prompt.indexOf('OUR FACT') < prompt.indexOf('THEIR FACT'));
  assert.match(prompt, /Statement A[\s\S]*Statement B/);
});
