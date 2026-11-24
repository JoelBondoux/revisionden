// AI marking against an official mark scheme: the prompt, the output schema and a marker backed
// by a model provider (providers.mjs). Used by the blind-marking check and the evals harness.
// Only the question, the answer and the mark scheme are sent (docs/AI.md).

export const MARKING_SCHEMA = {
  type: 'object',
  properties: {
    marks: { type: 'integer' },
    level: { type: 'integer', description: 'The level, for level-marked schemes; else 0.' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    awards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion: { type: 'string', description: 'Mark point code (M1) or level (L3).' },
          marks: { type: 'integer' },
          evidence: { type: 'string', description: 'Words from the answer that meet it.' },
        },
        required: ['criterion', 'marks', 'evidence'],
        additionalProperties: false,
      },
    },
    feedback: { type: 'string', description: 'What went well and up to three next steps.' },
  },
  required: ['marks', 'level', 'confidence', 'awards', 'feedback'],
  additionalProperties: false,
};

const SYSTEM = [
  'You are an experienced GCSE and A-Level examiner marking a student answer against the official',
  'mark scheme given. Mark only against that scheme. For every mark you award, cite the criterion',
  'it meets (a mark point code such as M1, or the level as L3) and quote the evidence from the',
  'answer. Give "low" or "medium" confidence if the answer is hard to place. Never rewrite the',
  "student's answer.",
].join(' ');

function schemeText(scheme) {
  if (scheme.type === 'levels') {
    return scheme.levels
      .map(
        (l) =>
          `L${l.level}: ${l.marks[0]} to ${l.marks[1]} marks${l.descriptor ? `. ${l.descriptor}` : ''}`,
      )
      .join('\n');
  }
  return scheme.points
    .map((p) => `${p.code}${p.description ? `: ${p.description}` : ''}`)
    .join('\n');
}

/** Only the question, the student's answer and the mark scheme are sent (docs/AI.md). */
export function markingPrompt({ question, answer, scheme }) {
  return {
    system: SYSTEM,
    prompt: `Question:\n${question}\n\nMark scheme:\n${schemeText(scheme)}\n\nStudent answer:\n${answer}`,
  };
}

/** A marker (see packages/core double-marking) backed by a model provider (scripts/verify). */
export function createModelMarker(provider) {
  return {
    id: `${provider.provider}:${provider.model}`,
    async mark(request) {
      const { output } = await provider.complete({
        ...markingPrompt(request),
        schema: MARKING_SCHEMA,
        schemaName: 'marking',
      });
      const marking = { ...output };
      delete marking.feedback;
      if (request.scheme.type !== 'levels') delete marking.level;
      return marking;
    },
  };
}
