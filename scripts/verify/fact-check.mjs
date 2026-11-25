// Pipeline step 4b, the fact-check stage (decision 0009, docs/VERIFICATION.md). An item that rests
// on a standard maths fact no cited source states lists it in `facts`. Each fact passes if:
//   (a) an official citation's quote states it: the item's quote check passed (the quote is really
//       in the source) and the judge confirms the quote states the fact, not just its topic, or
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

// The judge compares meaning, not wording (S3-A run, 2026-11-25: it had refused equivalent
// statements of parallel lines and tan 90° that only added an implied condition). It still
// refuses anything that changes the fact.
export const JUDGE_SYSTEM = [
  'You compare two statements of a maths fact, A and B. Judge their meaning, not wording.',
  'They are the same when B states the whole of fact A. B may word it differently, use symbols, ' +
    'add an explanation, a reason or an example, give an equivalent form, or state a condition ' +
    "that A's own words already imply: for example 'non-vertical' for lines that have a " +
    "gradient, 'a ≠ 0' when A divides by a, 'for real constants', or the range of angles or " +
    'values A is about. B may also go on to state further related facts: that does not matter ' +
    'as long as B states all of A and nothing in B contradicts A.',
  'They are not the same when B contradicts A, states a different fact, leaves out part of A, ' +
    'leaves out a condition A needs, adds a condition that changes when the fact holds, or only ' +
    'covers a narrower case than A (one example, or one of the cases A names).',
  'If you are unsure, they are not the same.',
].join(' ');

/** The neutral question sent to the third provider. It never contains our statement. */
export function factStatementPrompt(fact) {
  return { system: STATER_SYSTEM, prompt: fact.ask };
}

/** The judge's prompt for our statement (A) and the blind statement (B). */
export const factJudgePrompt = (ours, theirs) => ({
  system: JUDGE_SYSTEM,
  prompt: `Statement A:\n${ours}\n\nStatement B:\n${theirs}\n\nDo A and B state the same fact?`,
});

const quoteJudgePrompt = (fact, quote) => ({
  system: JUDGE_SYSTEM,
  prompt:
    `Statement A (a maths fact):\n${fact}\n\nStatement B (a quote from an official exam board ` +
    `document):\n${quote}\n\nDoes B state the same fact as A? Mentioning the topic is not enough.`,
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
  let usedJudge = false;
  const notes = [];
  let allPass = true;

  for (const [i, fact] of item.facts.entries()) {
    const label = `fact ${i + 1}`;
    const quote = fact.citation ? item.citations?.[fact.citation - 1]?.quote : undefined;
    let prefix = '';
    if (quote && quotePassed) {
      const q = await judge.complete({
        ...quoteJudgePrompt(fact.statement, quote),
        schema: JUDGE_SCHEMA,
        schemaName: 'fact_quote_judgement',
      });
      versions.add(q.modelVersion);
      usedJudge = true;
      if (q.output.same && q.output.confidence === 'high') {
        notes.push(`${label}: official (citation ${fact.citation}, the quote states it)`);
        continue;
      }
      prefix = `citation ${fact.citation} does not state it; `;
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
      ...factJudgePrompt(fact.statement, s.output.statement),
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
      `${label}: ${prefix}${proof}; blind statement ${j.output.same ? 'matches' : 'differs'} ("${s.output.statement}")` +
        (problems.length ? `; ${problems.join('; ')}` : ''),
    );
    allPass &&= proved && matches;
  }

  const result = allPass ? 'pass' : 'fail';
  const tool = usedModels
    ? `${stater.provider}:${stater.model} + ${judge.provider}:${judge.model} + maths-engine`
    : `${judge.provider}:${judge.model} + revisionden-quote-check`;
  return {
    id: item.id,
    result,
    check: {
      name: 'fact-check',
      result,
      tool,
      tool_version: usedModels || usedJudge ? [...versions].join('; ') : '1.0.0',
      at: stamp(now()),
      notes: notes.join('; '),
    },
  };
}
