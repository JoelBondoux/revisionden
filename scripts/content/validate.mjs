// Validates the content folder: schemas, unique ids, links between files, and maths answers.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createValidators } from './schemas.mjs';

const FOLDERS = {
  subjects: 'subjects',
  topicTrees: 'topic-trees',
  items: 'items',
  markSchemes: 'mark-schemes',
};
const SCHEMA_FOR = {
  subjects: 'subject',
  topicTrees: 'topicTree',
  items: 'item',
  markSchemes: 'markScheme',
};
const MATHS_TYPES = new Set(['numeric', 'worked_maths']);

async function jsonFiles(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith('.json'))
    .map((e) => join(e.parentPath ?? e.path, e.name))
    .sort();
}

/** Reads every JSON file under the content folders. Item files hold arrays of items. */
export async function loadContent(root) {
  const content = { subjects: [], topicTrees: [], items: [], markSchemes: [], loadErrors: [] };
  for (const [kind, folder] of Object.entries(FOLDERS)) {
    for (const path of await jsonFiles(join(root, folder))) {
      const file = relative(root, path);
      let data;
      try {
        data = JSON.parse(await readFile(path, 'utf8'));
      } catch (err) {
        content.loadErrors.push({ file, message: `invalid JSON: ${err.message}` });
        continue;
      }
      if (kind !== 'items') {
        content[kind].push({ file, data });
      } else if (!Array.isArray(data)) {
        content.loadErrors.push({ file, message: 'must contain a JSON array of items' });
      } else {
        content.items.push(...data.map((item) => ({ file, data: item })));
      }
    }
  }
  return content;
}

function* walkTopics(nodes) {
  for (const node of nodes ?? []) {
    yield node;
    yield* walkTopics(node.children);
  }
}

function schemaErrors(content, validators) {
  const errors = [];
  for (const [kind, schema] of Object.entries(SCHEMA_FOR)) {
    for (const { file, data } of content[kind]) {
      const validate = validators[schema];
      if (!validate(data)) {
        for (const e of validate.errors) {
          const where = e.instancePath || '(root)';
          const extra = e.params?.missingProperty ?? e.params?.additionalProperty ?? '';
          errors.push({ file, id: data?.id, message: `${where} ${e.message} ${extra}`.trim() });
        }
      }
    }
  }
  return errors;
}

function linkErrors(content) {
  const errors = [];
  const seen = new Map();
  const claim = (id, file) => {
    if (seen.has(id)) {
      errors.push({ file, id, message: `duplicate id ${id} (also in ${seen.get(id)})` });
    } else {
      seen.set(id, file);
    }
  };
  const subjects = new Set();
  const topics = new Map();
  const markSchemes = new Set();

  for (const { file, data } of content.subjects) {
    claim(data.id, file);
    subjects.add(data.id);
  }
  for (const { file, data } of content.markSchemes) {
    claim(data.id, file);
    markSchemes.add(data.id);
  }
  for (const { file, data } of content.topicTrees) {
    claim(data.id, file);
    if (!subjects.has(data.subject)) {
      errors.push({ file, id: data.id, message: `subject ${data.subject} does not exist` });
    }
    for (const node of walkTopics(data.topics)) {
      claim(node.id, file);
      topics.set(node.id, { leaf: !node.children });
    }
  }
  for (const { file, data: item } of content.items) {
    claim(item.id, file);
    const topic = topics.get(item.topic);
    const fail = (message) => errors.push({ file, id: item.id, message });
    if (!topic) fail(`topic ${item.topic} does not exist`);
    else if (!topic.leaf) fail(`topic ${item.topic} must be a leaf topic`);
    if (item.mark_scheme_ref && !markSchemes.has(item.mark_scheme_ref)) {
      fail(`mark scheme ${item.mark_scheme_ref} does not exist`);
    }
    if (item.type === 'multiple_choice' && item.answer.option >= item.options.length) {
      fail(`answer option ${item.answer.option} is not one of the ${item.options.length} options`);
    }
    if (MATHS_TYPES.has(item.type) && !item.checked_by.includes('maths-engine')) {
      fail('checked_by must include maths-engine for maths items');
    }
    if (item.type === 'worked_maths') {
      const wants = item.verify.method === 'solve' ? 'solutions' : 'expression';
      if (!(wants in item.answer))
        fail(`verify method ${item.verify.method} needs answer.${wants}`);
    }
  }
  return errors;
}

/** The checks to send to the maths engine (services/maths, app.content_check). */
export function mathsChecks(items) {
  const checks = [];
  for (const item of items) {
    if (item.type === 'numeric') {
      const check = {
        id: item.id,
        kind: 'value',
        expression: item.verify.expression,
        answer: item.answer.value,
      };
      if (item.answer.tolerance !== undefined) check.tolerance = item.answer.tolerance;
      checks.push(check);
    } else if (item.type === 'worked_maths') {
      const { verify, answer } = item;
      let expected;
      if (verify.method === 'solve') {
        checks.push({
          id: item.id,
          kind: 'solve',
          equation: verify.equation,
          variable: verify.variable ?? 'x',
          solutions: answer.solutions,
        });
        expected = { solutions: answer.solutions };
      } else {
        const check = {
          id: item.id,
          kind: 'expression',
          expression: verify.expression,
          answer: answer.expression,
        };
        if (verify.form) check.form = verify.form;
        checks.push(check);
        expected = { expression: verify.expression };
        if (verify.form) expected.form = verify.form;
      }
      if (item.steps) {
        checks.push({ id: `${item.id}#steps`, kind: 'working', lines: item.steps, expected });
      }
    }
  }
  return checks;
}

async function mathsErrors(content, checkMaths) {
  const fileOf = new Map(content.items.map(({ file, data }) => [data.id, file]));
  const results = await checkMaths(mathsChecks(content.items.map((i) => i.data)));
  return results
    .filter((r) => !r.ok)
    .map((r) => {
      const [id, part] = r.id.split('#');
      const label = part === 'steps' ? 'model solution' : 'answer';
      return { file: fileOf.get(id), id, message: `maths engine: ${r.error} (${label})` };
    });
}

/**
 * Returns a list of { file, id, message } problems; empty means valid.
 * checkMaths(checks) => Promise<results>, or null to skip the maths engine.
 */
export async function validateContent(content, { checkMaths, validators = createValidators() }) {
  const errors = [...(content.loadErrors ?? []), ...schemaErrors(content, validators)];
  if (errors.length) return errors;
  errors.push(...linkErrors(content));
  if (errors.length || !checkMaths) return errors;
  return mathsErrors(content, checkMaths);
}
