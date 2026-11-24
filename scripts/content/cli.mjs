#!/usr/bin/env node
// pnpm content:validate [--content <dir>] [--no-maths]
// Validates content/ and checks every maths answer with the Python maths engine.
// MATHS_PYTHON picks the Python that has services/maths/requirements.txt installed.
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { loadContent, validateContent } from './validate.mjs';
import { createPythonChecker } from './maths-engine.mjs';

const DEFAULT_CONTENT = join(dirname(fileURLToPath(import.meta.url)), '../../content');

export async function run(argv, deps = {}) {
  const {
    out = console.log,
    err = console.error,
    createChecker = () => createPythonChecker({ python: process.env.MATHS_PYTHON ?? 'python3' }),
  } = deps;
  let values;
  try {
    ({ values } = parseArgs({
      args: argv,
      options: { content: { type: 'string' }, 'no-maths': { type: 'boolean' } },
    }));
  } catch (e) {
    err(e.message);
    return 2;
  }
  const root = resolve(values.content ?? DEFAULT_CONTENT);
  const content = await loadContent(root);
  let errors;
  try {
    errors = await validateContent(content, {
      checkMaths: values['no-maths'] ? null : createChecker(),
    });
  } catch (e) {
    err(`Content validation could not finish: ${e.message}`);
    return 2;
  }
  for (const e of errors) err(`${e.file}: ${e.id ? `${e.id}: ` : ''}${e.message}`);
  if (errors.length) {
    err(`Content invalid: ${errors.length} problem(s).`);
    return 1;
  }
  if (values['no-maths']) err('Warning: maths answers were NOT checked (--no-maths).');
  out(
    `Content valid: ${content.subjects.length} subjects, ${content.topicTrees.length} topic trees, ` +
      `${content.items.length} items, ${content.markSchemes.length} mark schemes.`,
  );
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
