// Validates the content folder: schemas, unique ids, links between files, and maths answers.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createValidators } from './schemas.mjs';

const FOLDERS = {
  subjects: 'subjects',
  topicTrees: 'topic-trees',
  items: 'items',
  markSchemes: 'mark-schemes',
  diagrams: 'diagrams',
};
const SCHEMA_FOR = {
  subjects: 'subject',
  topicTrees: 'topicTree',
  items: 'item',
  markSchemes: 'markScheme',
  diagrams: 'diagram',
};
const MAX_QUOTE_WORDS = 50;
const FORBIDDEN_FILES = /\.(pdf|png|jpe?g|gif|webp|bmp|tiff?|heic|docx?)$/i;
const MATHS_TYPES = new Set(['numeric', 'worked_maths']);

async function filesUnder(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    return entries
      .filter((e) => e.isFile())
      .map((e) => join(e.parentPath ?? e.path, e.name))
      .sort();
  } catch {
    return [];
  }
}

const jsonFiles = async (dir) => (await filesUnder(dir)).filter((f) => f.endsWith('.json'));

/** Reads every JSON file under the content folders. Item files hold arrays of items. */
export async function loadContent(root) {
  const content = {
    subjects: [],
    topicTrees: [],
    items: [],
    markSchemes: [],
    diagrams: [],
    loadErrors: [],
  };
  for (const path of (await filesUnder(root)).filter((f) => FORBIDDEN_FILES.test(f))) {
    content.loadErrors.push({
      file: relative(root, path),
      message: 'do not commit copies of documents or raster images; link to the source instead',
    });
  }
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
    for (const { file, data } of content[kind] ?? []) {
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
  const diagrams = new Set();

  for (const { file, data } of content.subjects) {
    claim(data.id, file);
    subjects.add(data.id);
  }
  for (const { file, data } of content.markSchemes) {
    claim(data.id, file);
    markSchemes.add(data.id);
  }
  for (const { file, data } of content.diagrams ?? []) {
    claim(data.id, file);
    diagrams.add(data.id);
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
    if (item.diagram_ref && !diagrams.has(item.diagram_ref)) {
      fail(`diagram ${item.diagram_ref} does not exist`);
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

const wordCount = (text) => text.trim().split(/\s+/).length;

/** Every citations array in a piece of content, with the parts it belongs to. */
function citationsOf(kind, data) {
  if (kind === 'topicTrees') {
    return [...walkTopics(data.topics)].filter((n) => !n.children).flatMap((n) => n.citations);
  }
  return data.citations;
}

// Pipeline steps from docs/VERIFICATION.md section 3 that verified content must have passed.
function requiredChecks(kind, data) {
  if (kind !== 'items') return ['quote-check', 'schema'];
  const checks = [
    'grounded-writing',
    'quote-check',
    'blind-answer',
    'adversarial-review',
    'schema',
  ];
  if (MATHS_TYPES.has(data.type)) checks.push('maths-engine');
  // Exact checks (scripts/verify/exact) for the facts an item names in its exact block.
  if (data.exact?.quantity) checks.push('units');
  if (data.exact?.chemical_equation) checks.push('chemical-equation');
  if (data.exact?.equation_sheet) checks.push('equation-sheet');
  return checks;
}

function verificationErrors(kind, file, data) {
  const errors = [];
  const fail = (message) => errors.push({ file, id: data.id, message });
  const { verification } = data;
  if (verification.status !== 'verified') return errors;
  if (citationsOf(kind, data).some((c) => !c.quote)) {
    fail('verified content needs a quote in every citation');
  }
  if (!verification.reviewed_by) fail('verified content needs reviewed_by (a reviewer role)');
  for (const c of verification.checks.filter((c) => c.result === 'fail')) {
    fail(`verified content has a failed ${c.name} check`);
  }
  const passed = (name) => verification.checks.some((c) => c.name === name && c.result === 'pass');
  for (const name of requiredChecks(kind, data)) {
    if (!passed(name)) fail(`verified content needs a passing ${name} check`);
  }
  if (data.needs_human_approval === true) {
    if (!passed('human-approval')) {
      fail('needs_human_approval items need a passing human-approval check');
    }
  } else if (!passed('human-approval') && !passed('batch-sample')) {
    fail('verified content needs a passing human-approval or batch-sample check');
  }
  return errors;
}

function citationErrors(content) {
  const errors = [];
  for (const kind of ['items', 'topicTrees', 'markSchemes', 'diagrams']) {
    for (const { file, data } of content[kind] ?? []) {
      const fail = (message) => errors.push({ file, id: data.id, message });
      const citations = citationsOf(kind, data);
      for (const c of citations) {
        if (c.quote && wordCount(c.quote) > MAX_QUOTE_WORDS) {
          fail(`quote is ${wordCount(c.quote)} words; keep it to ${MAX_QUOTE_WORDS} or fewer`);
        }
        for (const part of c.supports.filter((p) => p.startsWith('distractor:'))) {
          const index = Number(part.split(':')[1]);
          if (data.type !== 'multiple_choice') fail('only multiple choice items have distractors');
          else if (index >= data.options.length) {
            fail(`${part} is not one of the ${data.options.length} options`);
          } else if (index === data.answer.option) fail(`${part} is the correct option`);
        }
      }
      const unofficial = citations.every((c) => c.source_type === 'other_authoritative');
      if (kind === 'items' && unofficial && data.needs_human_approval !== true) {
        fail('only other_authoritative citations: set needs_human_approval: true');
      }
      errors.push(...verificationErrors(kind, file, data));
    }
  }
  return errors;
}

const KIND_LABEL = {
  items: 'item',
  topicTrees: 'topic-tree',
  markSchemes: 'mark-scheme',
  diagrams: 'diagram',
};

function scopeIds(content, filter) {
  if (!filter) return null;
  const ids = new Set([filter]);
  for (const { data: t } of content.topicTrees) {
    const inTree = t.id === filter || t.subject === filter;
    if (inTree) ids.add(t.id);
    const visit = (nodes, inside) => {
      for (const n of nodes ?? []) {
        const here = inside || n.id === filter;
        if (here) ids.add(n.id);
        visit(n.children, here);
      }
    };
    visit(t.topics, inTree);
  }
  for (const { data: item } of content.items) {
    if (ids.has(item.topic)) {
      ids.add(item.id);
      if (item.mark_scheme_ref) ids.add(item.mark_scheme_ref);
      if (item.diagram_ref) ids.add(item.diagram_ref);
    }
  }
  return ids;
}

/**
 * One row per item, topic, topic tree, mark scheme and diagram: sources and review status.
 * filter: an item, topic, topic tree or subject id. detail: include every citation and check.
 */
export function auditReport(content, { filter, detail = false } = {}) {
  const rows = [];
  const scope = scopeIds(content, filter);
  const row = (kind, file, id, citations, verification, extra = {}) => {
    if (scope && !scope.has(id)) return;
    const quoted = citations.filter((c) => c.quote).length;
    rows.push({
      id,
      kind,
      file,
      status: verification.status,
      version: verification.version,
      citations: citations.length,
      quoted,
      needs_sourcing: quoted < citations.length,
      needs_human_approval: extra.needs_human_approval === true,
      sources: citations.map((c) => `${c.publisher} ${c.document_ref} ${c.location}`),
      ...(detail && {
        detail: {
          citations,
          verification,
          checks: verification.checks,
          reviewed_by: verification.reviewed_by ?? null,
        },
      }),
    });
  };
  for (const kind of Object.keys(KIND_LABEL)) {
    for (const { file, data } of content[kind] ?? []) {
      row(KIND_LABEL[kind], file, data.id, citationsOf(kind, data), data.verification, data);
      if (kind === 'topicTrees') {
        for (const leaf of [...walkTopics(data.topics)].filter((n) => !n.children)) {
          row('topic', file, leaf.id, leaf.citations, data.verification);
        }
      }
    }
  }
  return rows;
}

function versioned(content) {
  const byId = new Map();
  for (const kind of Object.keys(KIND_LABEL)) {
    for (const { file, data } of content[kind] ?? []) byId.set(data.id, { file, data });
  }
  return byId;
}

/** Verified content is immutable: an edit needs a higher version, and versions never go down. */
export function immutabilityErrors(baseline, current) {
  const errors = [];
  const before = versioned(baseline);
  for (const [id, { file, data }] of versioned(current)) {
    const old = before.get(id)?.data;
    if (!old) continue;
    const was = old.verification.version;
    const now = data.verification.version;
    if (now < was) {
      errors.push({ file, id, message: `version went down from ${was} to ${now}` });
    } else if (
      old.verification.status === 'verified' &&
      now === was &&
      JSON.stringify(old) !== JSON.stringify(data)
    ) {
      errors.push({
        file,
        id,
        message: `verified version ${was} was changed; edits need version ${was + 1}`,
      });
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
  errors.push(...linkErrors(content), ...citationErrors(content));
  if (errors.length || !checkMaths) return errors;
  return mathsErrors(content, checkMaths);
}
