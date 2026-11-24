#!/usr/bin/env node
// pnpm content:exact-check [--content <dir>] [--only <id>] [--write]
// Pipeline step 5 exact checks other than maths (maths stays with services/maths):
// units, chemical equation balancing and equation-sheet lookups, for the facts an item names in
// its `exact` block. Also checks every equation sheet in content/equation-sheets/.
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Ajv from 'ajv';
import { loadContent } from '../../content/validate.mjs';
import { replaceInFile } from '../content-files.mjs';
import { stamp, withCheck } from '../record.mjs';
import { REPO_ROOT } from '../sources.mjs';
import { checkEquation } from './chemistry.mjs';
import { checkItemEquation, checkSheet } from './equation-sheet.mjs';
import { checkUnit } from './units.mjs';

export const EXACT_TOOL = { name: 'revisionden-exact-check', version: '1.0.0' };

const SHEET_SCHEMA = {
  type: 'object',
  required: ['id', 'title', 'citations', 'verification', 'equations'],
  properties: {
    id: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
    title: { type: 'string', minLength: 1 },
    citations: { type: 'array', minItems: 1 },
    verification: { type: 'object', required: ['status', 'version', 'checks'] },
    equations: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'equation', 'symbols'],
        properties: {
          id: { type: 'string', pattern: '^[a-z0-9]+(-[a-z0-9]+)*$' },
          equation: { type: 'string', minLength: 3 },
          symbols: { type: 'object', additionalProperties: { type: 'string', minLength: 1 } },
        },
      },
    },
  },
};
const validateSheet = new Ajv({ allErrors: true, strict: false }).compile(SHEET_SCHEMA);

/** Structure problems with an equation sheet (citations use the common citation format). */
export function sheetErrors(sheet) {
  if (validateSheet(sheet)) return [];
  return validateSheet.errors.map((e) => `${e.instancePath || '(root)'} ${e.message}`);
}

function unitResult(item) {
  const unit = item.answer?.unit;
  if (!unit) return { ok: false, error: 'the item has exact.quantity but no answer.unit' };
  const r = checkUnit(unit, item.exact.quantity);
  return r.ok ? { ok: true, note: `${unit} is a unit of ${item.exact.quantity}` } : r;
}

/** One verification-record check per fact in the item's exact block. */
export function runExactChecks(item, { sheets, now = () => new Date() }) {
  const exact = item.exact ?? {};
  const runs = [];
  if (exact.quantity) runs.push(['units', unitResult(item)]);
  if (exact.chemical_equation) {
    const r = checkEquation(exact.chemical_equation, { allowFractions: exact.allow_fractions });
    runs.push([
      'chemical-equation',
      r.ok ? { ok: true, note: `${exact.chemical_equation} balances` } : r,
    ]);
  }
  if (exact.equation_sheet) {
    const r = checkItemEquation(item, sheets);
    const { sheet, equation } = exact.equation_sheet;
    runs.push(['equation-sheet', r.ok ? { ok: true, note: `${equation} is on ${sheet}` } : r]);
  }
  return runs.map(([name, r]) => ({
    name,
    result: r.ok ? 'pass' : 'fail',
    tool: EXACT_TOOL.name,
    tool_version: EXACT_TOOL.version,
    at: stamp(now()),
    notes: r.ok ? r.note : r.error,
  }));
}

async function loadSheets(root) {
  const dir = join(root, 'equation-sheets');
  let files = [];
  try {
    files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  } catch {
    return [];
  }
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'))));
}

export async function run(argv, deps = {}) {
  const { out = console.log, err = console.error, now } = deps;
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: {
        content: { type: 'string' },
        only: { type: 'string' },
        write: { type: 'boolean' },
      },
    }));
  } catch (e) {
    err(e.message);
    return 2;
  }
  const root = resolve(values.content ?? `${REPO_ROOT}/content`);
  const sheets = await loadSheets(root);
  let ok = true;
  for (const sheet of sheets) {
    const problems = [
      ...sheetErrors(sheet),
      ...checkSheet(sheet).map((p) => `${p.equation}: ${p.error}`),
    ];
    for (const p of problems) out(`FAIL  sheet ${sheet.id}  ${p}`);
    if (problems.length === 0) out(`pass  sheet ${sheet.id}  ${sheet.equations.length} equations`);
    ok &&= problems.length === 0;
  }
  for (const { file, data } of (await loadContent(root)).items) {
    if (values.only && data.id !== values.only) continue;
    const checks = runExactChecks(data, { sheets, now });
    for (const c of checks)
      out(`${c.result === 'pass' ? 'pass' : 'FAIL'}  ${data.id}  ${c.name}  ${c.notes}`);
    ok &&= checks.every((c) => c.result === 'pass');
    if (values.write && checks.length && data.verification.status !== 'verified') {
      await replaceInFile(root, file, checks.reduce(withCheck, data));
    }
  }
  return ok ? 0 : 1;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
