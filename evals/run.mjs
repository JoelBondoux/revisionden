#!/usr/bin/env node
// pnpm evals essay --golden <file> --markers anthropic,openai --live
// Runs the essay-marking golden set through double AI marking and checks the docs/AI.md bar.
// This calls real models and costs money: it needs --live and never runs in CI by default.
// Keys and model ids come from the environment, as for pnpm content:model-check.
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { providerFromEnv } from '../scripts/verify/providers.mjs';
import { PASS_BARS, createModelMarker, runEssayEval } from './marking.mjs';

const pct = (x) => `${(x * 100).toFixed(1)}%`;

export async function run(argv, deps = {}) {
  const {
    out = console.log,
    err = console.error,
    env = process.env,
    markerFor = (name) => createModelMarker(providerFromEnv(name, env)),
  } = deps;
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        golden: { type: 'string' },
        markers: { type: 'string', default: 'anthropic,openai' },
        live: { type: 'boolean' },
        'allow-ci': { type: 'boolean' },
      },
    });
  } catch (e) {
    err(e.message);
    return 2;
  }
  const { values, positionals } = parsed;
  if (positionals[0] !== 'essay' || !values.golden) {
    err('Usage: pnpm evals essay --golden <file> [--markers anthropic,openai] --live');
    return 2;
  }
  if (!values.live) {
    err('This evaluation calls real models and costs money: add --live to run it.');
    return 2;
  }
  if (env.CI && !values['allow-ci']) {
    err('Evaluations are not run in CI by default (add --allow-ci to force).');
    return 2;
  }
  const names = values.markers.split(',').map((s) => s.trim());
  if (names.length !== 2) {
    err('Give exactly two markers, for example --markers anthropic,openai.');
    return 2;
  }
  const golden = JSON.parse(await readFile(values.golden, 'utf8'));
  const report = await runEssayEval(golden, names.map(markerFor));
  const { score } = report;
  out(`Essay marking: ${score.total} answers`);
  out(
    `  within one level: ${pct(score.withinOneLevel)} (bar ${PASS_BARS.essay.withinOneLevel * 100}%)`,
  );
  out(`  flagged "check with your teacher": ${score.flagged}`);
  out(`  results without the AI label: ${score.unlabelled} (bar 0)`);
  out(`  disagreements given a mark: ${score.guessed} (bar 0)`);
  if (report.misses.length) out(`  misses: ${report.misses.join(', ')}`);
  out(report.passed ? 'PASS' : 'FAIL');
  return report.passed ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
