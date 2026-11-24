#!/usr/bin/env node
// pnpm content:model-check --blind <provider> --review <provider> [--only <id>] [--write]
// Pipeline steps 3 and 4: blind answer by a second provider, then adversarial review.
// Providers: anthropic, openai, gemini. Keys and model ids come from the environment
// (ANTHROPIC_API_KEY + VERIFY_ANTHROPIC_MODEL, OPENAI_API_KEY + VERIFY_OPENAI_MODEL,
// GEMINI_API_KEY + VERIFY_GEMINI_MODEL); keep them in .dev.vars, never in git.
// This calls real models and costs money: it never runs in CI.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadContent } from '../content/validate.mjs';
import { runAdversarialReview } from './adversarial-review.mjs';
import { runBlindAnswer } from './blind-answer.mjs';
import { runBlindMarking } from './blind-marking.mjs';
import { replaceInFile } from './content-files.mjs';
import { providerFromEnv } from './providers.mjs';
import { withCheck } from './record.mjs';
import { REPO_ROOT } from './sources.mjs';

export async function run(argv, deps = {}) {
  const {
    out = console.log,
    err = console.error,
    now,
    providerFor = (n) => providerFromEnv(n),
  } = deps;
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        content: { type: 'string' },
        only: { type: 'string' },
        blind: { type: 'string' },
        review: { type: 'string' },
        write: { type: 'boolean' },
      },
    }));
  } catch (e) {
    err(e.message);
    return 2;
  }
  if (!values.blind && !values.review) {
    err('Give --blind <provider> and/or --review <provider> (anthropic, openai or gemini).');
    return 2;
  }
  const steps = [
    ...(values.blind
      ? [{ name: 'blind-answer', run: runBlindAnswer, provider: providerFor(values.blind) }]
      : []),
    ...(values.review
      ? [
          {
            name: 'adversarial-review',
            run: runAdversarialReview,
            provider: providerFor(values.review),
          },
        ]
      : []),
  ];
  const root = resolve(values.content ?? `${REPO_ROOT}/content`);
  const content = await loadContent(root);
  const schemes = new Map(content.markSchemes.map(({ data }) => [data.id, data]));
  // Extended answers have no single answer: they get blind marking of their exemplars instead.
  const blindMarking = (item, provider, opts) => {
    const scheme = schemes.get(item.mark_scheme_ref);
    if (!scheme) throw new Error(`mark scheme ${item.mark_scheme_ref} does not exist`);
    return runBlindMarking(item, scheme, provider, opts);
  };
  const entries = content.items.filter(
    ({ data }) => data.verification.status === 'draft' && (!values.only || data.id === values.only),
  );
  if (entries.length === 0) {
    err('No draft items to check.');
    return 1;
  }

  let ok = true;
  for (const { file, data } of entries) {
    let updated = data;
    for (const step of steps) {
      try {
        const essay = step.name === 'blind-answer' && data.type === 'extended_answer';
        const run = essay ? blindMarking : step.run;
        const r = await run(data, step.provider, { now });
        out(
          `${r.result === 'pass' ? 'pass' : 'FAIL'}  ${data.id}  ${r.check.name}  ${r.check.notes}`,
        );
        ok &&= r.result === 'pass';
        updated = withCheck(updated, r.check);
      } catch (e) {
        out(`ERROR ${data.id}  ${step.name}  ${e.message}`);
        ok = false;
      }
    }
    if (values.write && updated !== data) await replaceInFile(root, file, updated);
  }
  return ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
