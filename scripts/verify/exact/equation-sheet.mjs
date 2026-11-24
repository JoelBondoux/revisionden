// Equation-sheet checks (docs/VERIFICATION.md step 5).
// - checkSheet: every equation on a sheet is dimensionally consistent, given its symbols' units.
// - checkItemEquation: an item that uses a sheet equation names one that exists on a verified
//   sheet, and writes it in an equivalent form (same sides, any order of factors or 1/2 vs 0.5).
// Sheets (content/equation-sheets/*.json) are sourced content with citations; this file only
// checks them. Rearranged equations (a = F / m for F = m a) are not matched: a person checks those.
import { parseUnit } from './units.mjs';

const NONE = [0, 0, 0, 0, 0, 0, 0, 0];
const CONSTANTS = { '\u03c0': Math.PI, pi: Math.PI };
const IDENT = /^\u0394?[A-Za-z\u0391-\u03c9](?:_\{[^}]+\}|_[A-Za-z0-9]+)?/;

function tokenize(text) {
  const tokens = [];
  let s = text.replace(/[\u00d7\u00b7]/g, '*').replace(/\u2212/g, '-');
  while ((s = s.trimStart())) {
    let m;
    if ((m = s.match(/^\d+(?:\.\d+)?/))) tokens.push({ type: 'num', value: Number(m[0]) });
    else if ((m = s.match(/^sqrt(?=\s*\()/))) tokens.push({ type: 'fn', value: 'sqrt' });
    else if ((m = s.match(IDENT))) tokens.push({ type: 'id', value: m[0] });
    else if ((m = s.match(/^[-+*/^()=]/))) tokens.push({ type: 'op', value: m[0] });
    else throw new Error(`cannot read "${s[0]}" in ${text}`);
    s = s.slice(m[0].length);
  }
  return tokens;
}

/** Parses an expression into a small syntax tree. Juxtaposition means multiply ("1/2 m v^2"). */
export function parseExpression(text) {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const isOp = (v) => peek()?.type === 'op' && peek().value === v;
  const fail = () => {
    throw new Error(`cannot read ${text}`);
  };
  const startsFactor = () => {
    const t = peek();
    return t && (t.type !== 'op' || t.value === '(');
  };
  function atom() {
    const t = tokens[i++];
    if (!t) fail();
    if (t.type === 'num') return { kind: 'num', value: t.value };
    if (t.type === 'id') return { kind: 'id', name: t.value };
    if (t.type === 'fn' || (t.type === 'op' && t.value === '(')) {
      if (t.type === 'fn' && !(peek()?.value === '(' && tokens[i++])) fail();
      const inner = expr();
      if (!isOp(')')) fail();
      i += 1;
      return t.type === 'fn' ? { kind: 'sqrt', arg: inner } : inner;
    }
    return fail();
  }
  function power() {
    const base = atom();
    if (!isOp('^')) return base;
    i += 1;
    return { kind: 'pow', base, exp: unary() };
  }
  function unary() {
    if (isOp('-')) {
      i += 1;
      return { kind: 'neg', arg: unary() };
    }
    return power();
  }
  function term() {
    let left = unary();
    for (;;) {
      if (isOp('*') || isOp('/')) {
        const op = tokens[i++].value;
        left = { kind: op === '*' ? 'mul' : 'div', left, right: unary() };
      } else if (startsFactor()) {
        left = { kind: 'mul', left, right: unary() };
      } else return left;
    }
  }
  function expr() {
    let left = term();
    while (isOp('+') || isOp('-')) {
      const op = tokens[i++].value;
      left = { kind: op === '+' ? 'add' : 'sub', left, right: term() };
    }
    return left;
  }
  const tree = expr();
  if (i !== tokens.length) fail();
  return tree;
}

function parseEquation(text) {
  const sides = text.split('=');
  if (sides.length !== 2) throw new Error(`cannot read ${text}: it needs one =`);
  return sides.map(parseExpression);
}

/** Numeric value of a tree for the given symbol values. */
export function evaluate(node, values) {
  const ev = (n) => evaluate(n, values);
  switch (node.kind) {
    case 'num':
      return node.value;
    case 'id':
      if (node.name in CONSTANTS) return CONSTANTS[node.name];
      if (!(node.name in values)) throw new Error(`no value for ${node.name}`);
      return values[node.name];
    case 'neg':
      return -ev(node.arg);
    case 'sqrt':
      return Math.sqrt(ev(node.arg));
    case 'pow':
      return ev(node.base) ** ev(node.exp);
    case 'mul':
      return ev(node.left) * ev(node.right);
    case 'div':
      return ev(node.left) / ev(node.right);
    case 'add':
      return ev(node.left) + ev(node.right);
    default:
      return ev(node.left) - ev(node.right);
  }
}

const same = (a, b) => a.every((d, i) => Math.abs(d - b[i]) < 1e-12);
const isConstant = (node) => {
  try {
    evaluate(node, {});
    return true;
  } catch {
    return false;
  }
};

/** Dimension vector of a tree; units maps each symbol to its unit ("m/s", "J/(kg K)"). */
export function dimensionsOf(node, units) {
  const dim = (n) => dimensionsOf(n, units);
  switch (node.kind) {
    case 'num':
      return NONE;
    case 'id':
      if (node.name in CONSTANTS) return NONE;
      if (!units[node.name]) throw new Error(`symbol ${node.name} has no unit`);
      return parseUnit(units[node.name]).dims;
    case 'neg':
      return dim(node.arg);
    case 'sqrt':
      return dim(node.arg).map((d) => d / 2);
    case 'pow': {
      if (!same(dim(node.exp), NONE) || !isConstant(node.exp)) {
        throw new Error('a power must be a plain number');
      }
      const p = evaluate(node.exp, {});
      return dim(node.base).map((d) => d * p);
    }
    case 'mul':
      return dim(node.left).map((d, i) => d + dim(node.right)[i]);
    case 'div':
      return dim(node.left).map((d, i) => d - dim(node.right)[i]);
    default: {
      const a = dim(node.left);
      if (!same(a, dim(node.right))) throw new Error('cannot add or subtract different units');
      return a;
    }
  }
}

/** Problems with a sheet: [{ equation, error }]; empty when every equation is consistent. */
export function checkSheet(sheet) {
  const problems = [];
  for (const eq of sheet.equations) {
    try {
      const [left, right] = parseEquation(eq.equation);
      if (!same(dimensionsOf(left, eq.symbols), dimensionsOf(right, eq.symbols))) {
        throw new Error('the two sides have different units');
      }
    } catch (e) {
      problems.push({ equation: eq.id, error: `${eq.equation}: ${e.message}` });
    }
  }
  return problems;
}

function symbolsIn(node, into = new Set()) {
  if (node.kind === 'id' && !(node.name in CONSTANTS)) into.add(node.name);
  for (const child of [node.arg, node.base, node.exp, node.left, node.right]) {
    if (child) symbolsIn(child, into);
  }
  return into;
}

const SAMPLES = [
  [1.37, 2.11, 0.83, 3.29, 1.91, 2.53],
  [0.71, 1.63, 2.97, 1.19, 3.07, 0.57],
];
const close = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));

function equivalent(a, b) {
  const names = [...symbolsIn(a[0], symbolsIn(a[1]))].sort();
  const other = [...symbolsIn(b[0], symbolsIn(b[1]))].sort();
  if (names.join() !== other.join()) return false;
  const sidesMatch = (x, y) =>
    SAMPLES.every((sample) => {
      const values = Object.fromEntries(names.map((n, k) => [n, sample[k % sample.length] + k]));
      return (
        close(evaluate(x[0], values), evaluate(y[0], values)) &&
        close(evaluate(x[1], values), evaluate(y[1], values))
      );
    });
  return sidesMatch(a, b) || sidesMatch(a, [b[1], b[0]]);
}

/** { ok } or { ok: false, error } for an item's exact.equation_sheet reference. */
export function checkItemEquation(item, sheets) {
  const ref = item.exact.equation_sheet;
  const sheet = sheets.find((s) => s.id === ref.sheet);
  if (!sheet) return { ok: false, error: `equation sheet ${ref.sheet} does not exist` };
  if (sheet.verification?.status !== 'verified') {
    return { ok: false, error: `equation sheet ${sheet.id} is not verified yet` };
  }
  const eq = sheet.equations.find((e) => e.id === ref.equation);
  if (!eq) return { ok: false, error: `no equation ${ref.equation} on ${sheet.id}` };
  if (ref.as_written) {
    try {
      if (!equivalent(parseEquation(eq.equation), parseEquation(ref.as_written))) {
        return {
          ok: false,
          error: `${ref.as_written} does not match ${eq.id} on the sheet (${eq.equation})`,
        };
      }
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: true };
}
