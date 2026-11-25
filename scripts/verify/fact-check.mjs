// Pipeline step 4b, the fact-check stage (decision 0009, docs/VERIFICATION.md). An item that rests
// on a standard maths fact no cited source states lists it in `facts`. Each fact passes if:
//   (a) an official citation states it and the item's quote check passed (no model calls), or
//   (b) the maths engine proves it AND (c) a third provider, asked a neutral question without our
//       wording, states the same fact (judged by another provider, high confidence throughout).
// A fact that fails or cannot be proved leaves the item for individual human review.
import { writerProviderOf } from './blind-answer.mjs';
import { stamp } from './record.mjs';

export const STATEMENT_SCHEMA = {
  type: 'object',
  properties: {
    statement: { type: 'string', description: 'The fact, stated in one or two sentences.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reasoning: { type: 'string', description: 'Brief justification.' },
  },
  required: ['statement', 'confidence', 'reasoning'],
  additionalProperties: false,
};

export const JUDGE_SCHEMA = {
  type: 'object',
  properties: {
    same: { type: 'boolean', description: 'True only if both state the same mathematical fact.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    reason: { type: 'string' },
  },
  required: ['same', 'confidence', 'reason'],
  additionalProperties: false,
};

const STATER_SYSTEM =
  'You are checking a fact used in GCSE or A-Level maths revision. Answer the question with the ' +
  'standard mathematical fact, precisely, including any conditions it needs. Say "low" ' +
  'confidence if you are not sure or the question is ambiguous.';

const JUDGE_SYSTEM =
  'You compare two statements of a maths fact. Say they are the same only if they state the same ' +
  'mathematical fact with the same conditions; wording may differ. Any difference in meaning, a ' +
  'missing or extra condition, or doubt means not the same.';

/** The neutral question sent to the third provider. It never contains our statement. */
export function factStatementPrompt(fact) {
  return { system: STATER_SYSTEM, prompt: fact.ask };
}

const judgePrompt = (ours, theirs) => ({
  system: JUDGE_SYSTEM,
  prompt: `Statement A:\n${ours}\n\nStatement B:\n${theirs}\n\nDo A and B state the same fact?`,
});

const providerOf = (tool = '') => String(tool).split(':')[0];

function assertProviders(item, stater, judge) {
  const writer = writerProviderOf(item);
  if (stater.provider === writer) {
    throw new Error(
      `the blind statement must come from a different provider from the writer (${writer})`,
    );
  }
  const blind = item.verification?.checks?.find((c) => c.name === 'blind-answer')?.tool;
  if (blind && providerOf(blind) === stater.provider) {
    throw new Error(
      `the blind statement must come from a different provider from the blind answer (${providerOf(blind)})`,
    );
  }
  if (judge.provider === stater.provider) {
    throw new Error('the judge must be a different provider from the statement');
  }
}

/** Runs the fact-check for one item: { id, result, check }. */
export async function runFactCheck(item, { stater, judge, maths, now = () => new Date() }) {
  if (!item.facts?.length) throw new Error(`${item.id} has no facts to check`);
  assertProviders(item, stater, judge);
  const quotePassed = item.verification?.checks?.some(
    (c) => c.name === 'quote-check' && c.result === 'pass',
  );
  const versions = new Set();
  let usedModels = false;
  const notes = [];
  let allPass = true;

  for (const [i, fact] of item.facts.entries()) {
    const label = `fact ${i + 1}`;
    if (fact.citation && quotePassed && item.citations?.[fact.citation - 1]) {
      notes.push(`${label}: official (citation ${fact.citation})`);
      continue;
    }
    usedModels = true;
    let proof = 'no maths engine proof';
    let proved = false;
    if (fact.engine) {
      const [r] = await maths([{ id: `${item.id}#${i + 1}`, ...fact.engine }]);
      proved = Boolean(r?.ok);
      proof = `maths engine proof ${proved ? 'pass' : 'fails'}`;
    }
    const s = await stater.complete({
      ...factStatementPrompt(fact),
      schema: STATEMENT_SCHEMA,
      schemaName: 'fact_statement',
    });
    versions.add(s.modelVersion);
    const j = await judge.complete({
      ...judgePrompt(fact.statement, s.output.statement),
      schema: JUDGE_SCHEMA,
      schemaName: 'fact_judgement',
    });
    versions.add(j.modelVersion);
    const problems = [
      ...(s.output.confidence === 'high' ? [] : [`statement confidence ${s.output.confidence}`]),
      ...(j.output.confidence === 'high' ? [] : [`judge confidence ${j.output.confidence}`]),
    ];
    const matches = j.output.same && problems.length === 0;
    notes.push(
      `${label}: ${proof}; blind statement ${j.output.same ? 'matches' : 'differs'} ("${s.output.statement}")` +
        (problems.length ? `; ${problems.join('; ')}` : ''),
    );
    allPass &&= proved && matches;
  }

  const result = allPass ? 'pass' : 'fail';
  const tool = usedModels
    ? `${stater.provider}:${stater.model} + ${judge.provider}:${judge.model} + maths-engine`
    : 'revisionden-quote-check';
  return {
    id: item.id,
    result,
    check: {
      name: 'fact-check',
      result,
      tool,
      tool_version: usedModels ? [...versions].join('; ') : '1.0.0',
      at: stamp(now()),
      notes: notes.join('; '),
    },
  };
}
