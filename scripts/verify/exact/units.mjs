// Exact unit checks (docs/VERIFICATION.md step 5): parses units, compares dimensions and converts.
// Dimensions: [length, mass, time, current, temperature, amount, luminosity, money].
// Unknown units are rejected, never guessed.

const D = (m = 0, kg = 0, s = 0, A = 0, K = 0, mol = 0, cd = 0, money = 0) => [
  m,
  kg,
  s,
  A,
  K,
  mol,
  cd,
  money,
];
const NONE = D();

const QUANTITY_DIMS = {
  length: D(1),
  area: D(2),
  volume: D(3),
  mass: D(0, 1),
  time: D(0, 0, 1),
  speed: D(1, 0, -1),
  velocity: D(1, 0, -1),
  acceleration: D(1, 0, -2),
  force: D(1, 1, -2),
  weight: D(1, 1, -2),
  momentum: D(1, 1, -1),
  energy: D(2, 1, -2),
  work: D(2, 1, -2),
  power: D(2, 1, -3),
  pressure: D(-1, 1, -2),
  density: D(-3, 1),
  frequency: D(0, 0, -1),
  current: D(0, 0, 0, 1),
  charge: D(0, 0, 1, 1),
  potential_difference: D(2, 1, -3, -1),
  resistance: D(2, 1, -3, -2),
  temperature: D(0, 0, 0, 0, 1),
  amount: D(0, 0, 0, 0, 0, 1),
  concentration: D(-3, 0, 0, 0, 0, 1),
  money: D(0, 0, 0, 0, 0, 0, 0, 1),
  ratio: NONE,
  angle: NONE,
};
export const QUANTITIES = Object.keys(QUANTITY_DIMS);

/** Dimension vector of a named quantity, or null. */
export const dimensionOf = (quantity) => QUANTITY_DIMS[quantity] ?? null;

// symbol: [factor to SI, dimension, takes a prefix?, has an offset?]
const UNITS = {
  m: [1, D(1), true],
  g: [1e-3, D(0, 1), true],
  t: [1000, D(0, 1), false],
  s: [1, D(0, 0, 1), true],
  min: [60, D(0, 0, 1), false],
  h: [3600, D(0, 0, 1), false],
  A: [1, D(0, 0, 0, 1), true],
  K: [1, D(0, 0, 0, 0, 1), false],
  '\u00b0C': [1, D(0, 0, 0, 0, 1), false, true],
  mol: [1, D(0, 0, 0, 0, 0, 1), true],
  cd: [1, D(0, 0, 0, 0, 0, 0, 1), false],
  N: [1, QUANTITY_DIMS.force, true],
  J: [1, QUANTITY_DIMS.energy, true],
  Wh: [3600, QUANTITY_DIMS.energy, true],
  eV: [1.602176634e-19, QUANTITY_DIMS.energy, true],
  W: [1, QUANTITY_DIMS.power, true],
  Pa: [1, QUANTITY_DIMS.pressure, true],
  Hz: [1, QUANTITY_DIMS.frequency, true],
  C: [1, QUANTITY_DIMS.charge, true],
  V: [1, QUANTITY_DIMS.potential_difference, true],
  ohm: [1, QUANTITY_DIMS.resistance, true],
  '\u03a9': [1, QUANTITY_DIMS.resistance, true],
  l: [1e-3, D(3), true],
  L: [1e-3, D(3), true],
  '£': [1, QUANTITY_DIMS.money, false],
  p: [0.01, QUANTITY_DIMS.money, false],
  '%': [0.01, NONE, false],
  '\u00b0': [Math.PI / 180, NONE, false],
};
const PREFIXES = {
  G: 1e9,
  M: 1e6,
  k: 1e3,
  d: 1e-1,
  c: 1e-2,
  m: 1e-3,
  '\u00b5': 1e-6,
  u: 1e-6,
  n: 1e-9,
};

const SUPERSCRIPTS = {
  '\u2070': '0',
  '\u00b9': '1',
  '\u00b2': '2',
  '\u00b3': '3',
  '\u2074': '4',
  '\u207b': '-',
};

function lookup(symbol) {
  if (UNITS[symbol]) return UNITS[symbol];
  const prefix = PREFIXES[symbol[0]];
  const base = UNITS[symbol.slice(1)];
  if (prefix && base?.[2]) return [prefix * base[0], base[1], false, base[3]];
  return null;
}

function parseFactor(token, sign, original) {
  const m = token.match(/^([^\d^-]+)\^?(-?\d+)?$/);
  const unit = m && lookup(m[1]);
  if (!unit) throw new Error(`unknown unit "${original}"`);
  const power = sign * Number(m[2] ?? 1);
  return {
    factor: unit[0] ** power,
    dims: unit[1].map((d) => d * power),
    offset: unit[3] === true,
  };
}

/** { factor, dims, offset } of a unit such as "m s^-1", "kg/m^3", "cm\u00b2" or "£". */
export function parseUnit(text) {
  const original = text;
  const plain = text
    .replace(/[\u2070\u00b9\u00b2\u00b3\u2074\u207b]/g, (c) => `^${SUPERSCRIPTS[c]}`)
    .replace(/\^\^/g, '^')
    .replace(/\^-\^/g, '^-')
    .replace(/\/\(([^()]*)\)/g, (_, inner) =>
      inner
        .trim()
        .split(/[\s*\u00b7]+/)
        .map((t) => `/${t}`)
        .join(''),
    )
    .trim();
  if (/[()]/.test(plain)) throw new Error(`unknown unit "${original}"`);
  if (!plain) throw new Error('empty unit');
  let factor = 1;
  let dims = NONE;
  let offset = false;
  plain.split('/').forEach((part, i) => {
    const tokens = part.split(/[\s*\u00b7]+|(?<=[a-zA-Z])\.(?=[a-zA-Z])/).filter(Boolean);
    if (tokens.length === 0) throw new Error(`unknown unit "${original}"`);
    for (const token of tokens) {
      const f = parseFactor(token, i === 0 ? 1 : -1, original);
      factor *= f.factor;
      dims = dims.map((d, k) => d + f.dims[k]);
      offset ||= f.offset;
    }
  });
  return { factor, dims, offset };
}

const equalDims = (a, b) => a.every((d, i) => d === b[i]);

export const sameDimension = (a, b) => equalDims(parseUnit(a).dims, parseUnit(b).dims);

/** Converts a value between units with the same dimension. */
export function convert(value, from, to) {
  const a = parseUnit(from);
  const b = parseUnit(to);
  if (!equalDims(a.dims, b.dims)) throw new Error(`cannot convert ${from} to ${to}`);
  if (a.offset || b.offset) throw new Error('cannot convert temperatures with an offset (\u00b0C)');
  return (value * a.factor) / b.factor;
}

const quantityOf = (dims) => QUANTITIES.find((q) => equalDims(QUANTITY_DIMS[q], dims)) ?? 'other';

/** { ok } or { ok: false, error } for an answer unit and the quantity the question asks for. */
export function checkUnit(unit, quantity) {
  const want = dimensionOf(quantity);
  if (!want) return { ok: false, error: `unknown quantity ${quantity}` };
  let got;
  try {
    got = parseUnit(unit);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  if (equalDims(got.dims, want)) return { ok: true };
  return { ok: false, error: `${unit} is a ${quantityOf(got.dims)} unit, not ${quantity}` };
}
