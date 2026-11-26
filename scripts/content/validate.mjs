// Validates the content folder: schemas, unique ids, links between files, and maths answers.
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createValidators } from './schemas.mjs';
import { learnLinkErrors } from './learn-links.mjs';
import { controlCharacters } from '../verify/record.mjs';
import {
  roundingOf,
  showsRounding,
  inForm,
  standardForm,
  withMinus,
} from '../../packages/core/src/answer-format.ts';

const FOLDERS = {
  subjects: 'subjects',
  topicTrees: 'topic-trees',
  items: 'items',
  markSchemes: 'mark-schemes',
  diagrams: 'diagrams',
  learnLinks: 'learn-links',
};
const SCHEMA_FOR = {
  subjects: 'subject',
  topicTrees: 'topicTree',
  items: 'item',
  markSchemes: 'markScheme',
  diagrams: 'diagram',
  learnLinks: 'learnLinks',
};
const MAX_QUOTE_WORDS = 50;
const FORBIDDEN_FILES = /\.(pdf|png|jpe?g|gif|webp|bmp|tiff?|heic|docx?)$/i;
const MATHS_TYPES = new Set(['numeric', 'worked_maths', 'area_model']);

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
    learnLinks: [],
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
  const schemeLevels = new Map();
  for (const { file, data } of content.markSchemes) {
    claim(data.id, file);
    markSchemes.add(data.id);
    if (data.levels) schemeLevels.set(data.id, new Set(data.levels.map((l) => l.level)));
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
    if (item.exemplars) {
      const scheme = schemeLevels.get(item.mark_scheme_ref);
      for (const e of item.exemplars) {
        if (scheme && !scheme.has(e.level)) {
          fail(`exemplar level ${e.level} is not in ${item.mark_scheme_ref}`);
        }
      }
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
    if (item.type === 'numeric') [...roundingErrors(item), ...formErrors(item)].forEach(fail);
    if (item.type === 'worked_maths') workedFormErrors(item).forEach(fail);
    if (item.type === 'area_model') areaModelErrors(item).forEach(fail);
    if (item.type === 'worked_maths') {
      const wants = item.verify.method === 'solve' ? 'solutions' : 'expression';
      if (!(wants in item.answer))
        fail(`verify method ${item.verify.method} needs answer.${wants}`);
    }
  }
  return errors;
}

// Area model items (lesson pilot W8). The same rules as packages/core/src/interactive/area-model.ts
// (scope A: b and c positive and the quadratic factorises); kept here so the CLI needs no build.
const areaPairs = (c) => {
  const pairs = [];
  for (let p = 1; p * p <= c; p += 1) if (c % p === 0) pairs.push([p, c / p]);
  return pairs;
};
const areaQuadratic = ({ b, c }) => `x^2 + ${b === 1 ? 'x' : `${b}x`} + ${c}`;

/** The pair must split the middle term (multiply to c, add to b), smaller number first. */
function areaModelErrors(item) {
  const { quadratic, answer } = item;
  const [p, q] = answer.pair;
  const right = areaPairs(quadratic.c).find(([a, b]) => a + b === quadratic.b);
  if (!right) return [`${areaQuadratic(quadratic)} does not factorise with whole numbers`];
  if (p > q) return [`answer pair ${p}, ${q} must be written smaller number first`];
  if (p !== right[0] || q !== right[1]) {
    return [
      `answer pair ${p}, ${q} does not make ${areaQuadratic(quadratic)}: use ${right[0]}, ${right[1]}`,
    ];
  }
  return [];
}

// Words for an accuracy ("2 decimal places", "3 s.f.", "the nearest whole number").
const ACCURACY = /decimal place|significant figure|nearest whole number|\bd\.p\.|\bs\.f\./i;
// The question asks for the answer itself to be rounded: "give / write your answer (correct) to",
// "give the positive solution correct to", "round 7.8463 to", "your answer to 1 d.p.". Accuracy
// words about the working or a given measurement ("by rounding each number to 1 significant
// figure", "a mass is 4.6 kg, correct to 1 decimal place") do not count.
const ASKS_FOR_ROUNDING =
  /\b(?:give|write|leave|round|answers?)\b[^.?!]*?\bto\b[^.?!]*?(?:decimal place|significant figure|nearest whole number|\bd\.p\.|\bs\.f\.)/i;

/** A rounded numeric answer: the question says so, the answer says how, and its value is written so. */
function roundingErrors(item) {
  const rounding = roundingOf(item.answer);
  if (!rounding) {
    // A decimal point (7.8463) is not the end of a sentence.
    return ASKS_FOR_ROUNDING.test(item.prompt.replace(/(\d)\.(?=\d)/g, '$1'))
      ? ['the question asks for rounding: set answer.decimal_places or answer.significant_figures']
      : [];
  }
  const errors = [];
  if (!ACCURACY.test(item.prompt)) {
    errors.push('answer asks for rounding but the question does not say what to round to');
  }
  if (!showsRounding(item.answer.value, rounding)) {
    const how =
      rounding.decimal_places !== undefined
        ? `${rounding.decimal_places} decimal places`
        : `${rounding.significant_figures} significant figures`;
    errors.push(`answer.value ${item.answer.value} is not written to ${how}`);
  }
  return errors;
}

// The question asks for the answer in a form: "give / write / express your answer ... in its
// simplest form", "... as a fraction", "... in standard form", "write 360 in index form". Words
// about the question ("0.00045 is written in standard form as A × 10^n. Find n") do not count.
// The most specific form wins: "as an improper fraction in its simplest form" is an improper
// fraction, and "as a fraction in its simplest form" a simplest fraction.
const ASKS_FOR_FORM = [
  ['improper_fraction', /improper fraction/],
  ['simplest_fraction', /simplest form|lowest terms/],
  ['standard_form', /standard form/],
  ['index_form', /index form/],
  ['fraction', /\bas an? (?:improper )?fraction/],
].map(([form, words]) => [
  form,
  new RegExp(`\\b(?:give|write|express|leave|answers?)\\b[^.?!]*?(?:${words.source})`, 'i'),
]);
const FRACTION_FORMS = new Set(['fraction', 'simplest_fraction', 'improper_fraction']);

/** The form a question asks its answer in, or null. */
function askedForm(prompt) {
  // A decimal point (0.375) or the dots of a recurring decimal (0.2727...) end no sentence.
  const text = prompt.replace(/(\d)\.(?=\d)/g, '$1').replace(/\.{3}|…/g, '');
  return ASKS_FOR_FORM.find(([, asks]) => asks.test(text))?.[0] ?? null;
}

/** A numeric answer in a form: the question asks for it, the answer says so, and is in it. */
function formErrors(item) {
  const asked = askedForm(item.prompt);
  const { form } = item.answer;
  const errors = [];
  if (asked && form !== asked) {
    errors.push(`the question asks for ${asked.replace('_', ' ')}: set answer.form to "${asked}"`);
  }
  if (!form) return errors;
  if (!asked) errors.push(`answer.form is ${form} but the question does not ask for it`);
  if (!inForm(item.answer.value, form)) {
    errors.push(`answer.value ${item.answer.value} is not written as a ${form}`);
  }
  const rounded = ['tolerance', 'decimal_places', 'significant_figures'].some(
    (key) => item.answer[key] !== undefined,
  );
  if (FRACTION_FORMS.has(form) && rounded) {
    errors.push('a fraction answer cannot also set tolerance or rounding');
  }
  return errors;
}

/**
 * A worked answer may set answer.form (not required: "simplest form" for 3x + 10 is no fraction
 * form); when it does, the answer is written in it and verify.form is not set as well.
 */
function workedFormErrors(item) {
  const { form, expression, solutions } = item.answer;
  if (!form) return [];
  const errors = [];
  if (item.verify.form) errors.push('set either answer.form or verify.form, not both');
  if (expression !== undefined && !inForm(expression, form)) {
    errors.push(`answer.expression ${expression} is not written as a ${form}`);
  }
  for (const solution of solutions ?? []) {
    if (!inForm(solution, form)) errors.push(`solution ${solution} is not written as a ${form}`);
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
  // Extended answers have no single answer: blind marking of three exemplars replaces it.
  const blind = data.type === 'extended_answer' ? 'blind-marking' : 'blind-answer';
  const checks = ['grounded-writing', 'quote-check', blind, 'adversarial-review', 'schema'];
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
  if (kind === 'items' && data.type === 'extended_answer') {
    const bands = new Set((data.exemplars ?? []).map((e) => e.band));
    if (!['top', 'middle', 'low'].every((b) => bands.has(b))) {
      fail('verified extended answers need exemplars for the top, middle and low bands');
    }
  }
  if (citationsOf(kind, data).some((c) => !c.quote)) {
    fail('verified content needs a quote in every citation');
  }
  if (!verification.reviewed_by) fail('verified content needs reviewed_by (a reviewer role)');
  const passed = (name) => verification.checks.some((c) => c.name === name && c.result === 'pass');
  // Decision 0009: a fact that fails the fact-check keeps the item for individual review, so a
  // failed fact-check is allowed only with needs_human_approval and a passing human-approval.
  const factFailAllowed = data.needs_human_approval === true && passed('human-approval');
  for (const c of verification.checks.filter((c) => c.result === 'fail')) {
    if (c.name === 'fact-check') {
      if (!factFailAllowed) {
        fail('a failed fact-check needs needs_human_approval and a passing human-approval check');
      }
    } else fail(`verified content has a failed ${c.name} check`);
  }
  if (kind === 'items' && data.facts?.length) {
    if (!verification.checks.some((c) => c.name === 'fact-check')) {
      fail('a verified item with facts needs a fact-check check (decision 0009)');
    }
  }
  for (const name of requiredChecks(kind, data)) {
    if (!passed(name)) fail(`verified content needs a passing ${name} check`);
  }
  if (data.needs_human_approval === true) {
    if (!passed('human-approval')) {
      fail('needs_human_approval items need a passing human-approval check');
    }
  } else if (kind === 'items' && data.type === 'extended_answer') {
    if (!passed('human-approval')) {
      fail('extended answers need a passing human-approval check (never batch sampling)');
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

/**
 * A numeric answer as the engine reads it. Standard form (6.4 × 10^8) goes as 640000000, or as
 * 6.4*10^8 when the answer must be in standard form, since the engine then checks the form too.
 */
function engineValue(answer) {
  const standard = standardForm(withMinus(answer.value));
  if (!standard) return answer.value;
  if (answer.form === 'standard_form') return `${standard.mantissa}*10^${standard.power}`;
  return standard.plain;
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
        answer: engineValue(item.answer),
      };
      for (const key of ['tolerance', 'decimal_places', 'significant_figures', 'form']) {
        if (item.answer[key] !== undefined) check[key] = item.answer[key];
      }
      checks.push(check);
    } else if (item.type === 'area_model') {
      const [p, q] = item.answer.pair;
      checks.push({
        id: item.id,
        kind: 'expression',
        expression: areaQuadratic(item.quadratic),
        answer: `(x + ${p})(x + ${q})`,
        form: 'factorised',
      });
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
          ...(answer.form ? { form: answer.form } : {}),
        });
        expected = { solutions: answer.solutions };
        if (answer.form) expected.form = answer.form;
      } else {
        const check = {
          id: item.id,
          kind: 'expression',
          expression: verify.expression,
          answer: answer.expression,
        };
        // One form for the engine: the answer form (T2) or the expression form (factorised).
        const form = answer.form ?? verify.form;
        if (form) check.form = form;
        if (answer.subject) check.subject = answer.subject;
        checks.push(check);
        expected = { expression: verify.expression };
        if (form) expected.form = form;
        if (answer.subject) expected.subject = answer.subject;
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
/** Control characters anywhere in any content file (they break the database sync). */
function controlCharacterErrors(content) {
  const errors = [];
  for (const list of Object.values(content)) {
    if (!Array.isArray(list)) continue;
    for (const { file, data } of list) {
      if (!file) continue;
      for (const { path, code } of controlCharacters(data)) {
        errors.push({ file, id: data?.id, message: `control character ${code} in ${path}` });
      }
    }
  }
  return errors;
}

export async function validateContent(content, { checkMaths, validators = createValidators() }) {
  const errors = [
    ...(content.loadErrors ?? []),
    ...controlCharacterErrors(content),
    ...schemaErrors(content, validators),
  ];
  if (errors.length) return errors;
  errors.push(...linkErrors(content), ...citationErrors(content), ...learnLinkErrors(content));
  if (errors.length || !checkMaths) return errors;
  return mathsErrors(content, checkMaths);
}
