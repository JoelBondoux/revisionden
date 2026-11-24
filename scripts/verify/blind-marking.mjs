// Pipeline step 3 for extended answers (docs/VERIFICATION.md section 3). There is no single
// answer to check blind, so the writer provides three exemplar answers (top, middle and low
// band) with their intended levels, and a model from a DIFFERENT provider marks them against the
// mark scheme without seeing those levels. It must match all three exactly, confidently, citing
// the scheme for every mark. Mark-point schemes compare total marks instead of levels.
import { validateMarking } from '../../packages/core/src/double-marking.ts';
import { writerProviderOf } from './blind-answer.mjs';
import { createModelMarker } from './marking.mjs';
import { stamp } from './record.mjs';

const BANDS = ['top', 'middle', 'low'];

/** A content mark scheme (content/mark-schemes) in the marking rules format (packages/core). */
export function toMarkingScheme(scheme) {
  if (scheme.type === 'levels') {
    return {
      type: 'levels',
      levels: scheme.levels.map((l) => ({
        level: l.level,
        marks: l.marks,
        descriptor: l.descriptor,
      })),
    };
  }
  return {
    type: 'points',
    points: scheme.points.map((p) => ({ code: p.code, description: p.description })),
  };
}

/** Runs blind marking for one extended-answer item: { id, result, check }. */
export async function runBlindMarking(item, markScheme, provider, { now = () => new Date() } = {}) {
  const writer = writerProviderOf(item);
  if (provider.provider === writer) {
    throw new Error(
      `blind marking must come from a different provider than the writer (${writer})`,
    );
  }
  const record = (result, notes, version = provider.model) => ({
    id: item.id,
    result,
    check: {
      name: 'blind-marking',
      result,
      tool: `${provider.provider}:${provider.model}`,
      tool_version: version,
      at: stamp(now()),
      notes,
    },
  });
  const exemplars = BANDS.map((band) => (item.exemplars ?? []).find((e) => e.band === band));
  if (exemplars.some((e) => !e)) {
    return record('fail', 'blind marking needs a top, middle and low exemplar');
  }

  const scheme = toMarkingScheme(markScheme);
  const byLevel = scheme.type === 'levels';
  const show = (n) => (byLevel ? `L${n}` : `${n} marks`);
  let version = provider.model;
  const wrapped = {
    ...provider,
    complete: async (request) => {
      const out = await provider.complete(request);
      version = out.modelVersion;
      return out;
    },
  };
  const marker = createModelMarker(wrapped);
  let ok = true;
  const notes = [];
  for (const e of exemplars) {
    // Only the question, the exemplar answer and the scheme: never the intended level or band.
    const marking = await marker.mark({ question: item.prompt, answer: e.answer, scheme });
    const given = byLevel ? marking.level : marking.marks;
    const problems = validateMarking(marking, scheme);
    let note = `${e.band}: intended ${show(e.level)}, marked ${show(given)}`;
    if (marking.confidence !== 'high') note += ` (confidence ${marking.confidence})`;
    if (problems.length) note += ` (${problems.join('; ')})`;
    ok &&= given === e.level && marking.confidence === 'high' && problems.length === 0;
    notes.push(note);
  }
  return record(ok ? 'pass' : 'fail', notes.join('; '), version);
}
