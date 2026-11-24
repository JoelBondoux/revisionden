// Exact chemical equation checks (docs/VERIFICATION.md step 5): atoms and charge must balance and
// coefficients must be in lowest terms.
//
// Writing conventions the checker needs (record them with the content):
// - put spaces around the + between species: "Fe3+ + e- -> Fe2+";
// - a polyatomic ion with a charge above 1 uses ^ or a space: "SO4^2-" or "SO4 2-" ("NH4+" is fine);
// - state symbols (s), (l), (g), (aq) are allowed and ignored.

const ELEMENTS = new Set(
  (
    'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se ' +
    'Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb ' +
    'Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm ' +
    'Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'
  ).split(' '),
);
const SUPER = {
  '\u2070': '0',
  '\u00b9': '1',
  '\u00b2': '2',
  '\u00b3': '3',
  '\u2074': '4',
  '\u2075': '5',
  '\u2076': '6',
  '\u2077': '7',
  '\u2078': '8',
  '\u2079': '9',
  '\u207a': '+',
  '\u207b': '-',
};
const ARROW = /\s*(?:<=>|->|\u2192|\u21cc|\u27f6|\u21c4|=)\s*/;
const STATE = /\s*\((?:s|l|g|aq)\)$/;

function addAtoms(into, from, times = 1) {
  for (const [el, n] of Object.entries(from)) into[el] = (into[el] ?? 0) + n * times;
  return into;
}

/** Atom counts of a formula body with no charge, e.g. Ca(OH)2 or [Cu(H2O)6]. */
function countAtoms(body) {
  let i = 0;
  const group = (close) => {
    const atoms = {};
    while (i < body.length && body[i] !== close) {
      const ch = body[i];
      let part;
      if (ch === '(' || ch === '[') {
        i += 1;
        part = group(ch === '(' ? ')' : ']');
        if (body[i] !== (ch === '(' ? ')' : ']')) throw new Error(`${body}: unbalanced brackets`);
        i += 1;
      } else if (/[A-Z]/.test(ch)) {
        const symbol = /[a-z]/.test(body[i + 1] ?? '') ? body.slice(i, i + 2) : ch;
        if (!ELEMENTS.has(symbol)) throw new Error(`${symbol} is not an element`);
        i += symbol.length;
        part = { [symbol]: 1 };
      } else if (ch === ')' || ch === ']') {
        throw new Error(`${body}: unbalanced brackets`);
      } else {
        const lower = body.slice(i).match(/^[A-Z]?[a-z]+/)?.[0];
        throw new Error(lower ? `${lower} is not an element` : `${body}: cannot read "${ch}"`);
      }
      const count = body.slice(i).match(/^\d+/)?.[0];
      if (count) i += count.length;
      addAtoms(atoms, part, count ? Number(count) : 1);
    }
    return atoms;
  };
  const atoms = group(undefined);
  if (i < body.length) throw new Error(`${body}: unbalanced brackets`);
  return atoms;
}

/** { atoms, charge } of a species such as "Ca(OH)2(aq)", "SO4^2-", "Fe3+" or "e-". */
export function parseFormula(text) {
  let s = text.replace(/[\u2070-\u207b\u00b2\u00b3\u00b9]/g, (c) => SUPER[c] ?? c).trim();
  s = s.replace(STATE, '').trim();
  if (!s) throw new Error('empty formula');
  if (/^e-$/.test(s)) return { atoms: {}, charge: -1 };

  let charge = 0;
  const explicit = s.match(/(?:\^|\s+)(\d*)([+-])$/);
  const trailing = s.match(/(\d*)([+-])$/);
  if (explicit) {
    charge = Number(explicit[1] || 1) * (explicit[2] === '+' ? 1 : -1);
    s = s.slice(0, explicit.index);
  } else if (trailing) {
    const body = s.slice(0, trailing.index);
    // Digits before the sign are the charge for a single atom (Fe3+) or after ] ([Cu(H2O)6]2+);
    // otherwise they belong to the formula (NH4+).
    const digitsAreCharge = /^[A-Z][a-z]?$/.test(body) || body.endsWith(']');
    const magnitude = digitsAreCharge ? Number(trailing[1] || 1) : 1;
    charge = magnitude * (trailing[2] === '+' ? 1 : -1);
    s = digitsAreCharge ? body : s.slice(0, -1);
  }
  const atoms = {};
  for (const part of s.split(/\u00b7|\*|\.(?=\d|[A-Z])/)) {
    const m = part.trim().match(/^(\d*)(.*)$/);
    addAtoms(atoms, countAtoms(m[2]), m[1] ? Number(m[1]) : 1);
  }
  return { atoms, charge };
}

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function parseSpecies(text) {
  const m = text.trim().match(/^(\d+\/\d+|\d+)?\s*(.+)$/);
  const [n, d] = (m[1] ?? '1').split('/').map(Number);
  return { coefficient: n / (d ?? 1), num: n, den: d ?? 1, formula: m[2], ...parseFormula(m[2]) };
}

/** { left, right } species of an equation with exactly one arrow. */
export function parseEquation(text) {
  const sides = text.split(ARROW);
  if (sides.length !== 2) throw new Error('an equation needs one arrow between the two sides');
  const side = (s) =>
    s
      .trim()
      .split(/\s+\+\s+/)
      .map(parseSpecies);
  return { left: side(sides[0]), right: side(sides[1]) };
}

/** { ok } or { ok: false, error }. allowFractions: accept coefficients such as 1/2. */
export function checkEquation(text, { allowFractions = false } = {}) {
  let eq;
  try {
    eq = parseEquation(text);
  } catch (e) {
    return { ok: false, error: e.message };
  }
  const all = [...eq.left, ...eq.right];
  if (!allowFractions && all.some((s) => s.den !== 1)) {
    return { ok: false, error: 'fractional coefficients are not allowed here' };
  }
  const scale = all.reduce((l, s) => (l * s.den) / gcd(l, s.den), 1);
  const totals = (species) => {
    const atoms = {};
    let charge = 0;
    for (const s of species) {
      const times = (s.num * scale) / s.den;
      addAtoms(atoms, s.atoms, times);
      charge += s.charge * times;
    }
    return { atoms, charge };
  };
  const l = totals(eq.left);
  const r = totals(eq.right);
  const problems = [];
  for (const el of new Set([...Object.keys(l.atoms), ...Object.keys(r.atoms)])) {
    const a = (l.atoms[el] ?? 0) / scale;
    const b = (r.atoms[el] ?? 0) / scale;
    if (a !== b) problems.push(`${el}: ${a} on the left, ${b} on the right`);
  }
  if (l.charge !== r.charge) {
    problems.push(`charge: ${l.charge / scale} on the left, ${r.charge / scale} on the right`);
  }
  if (problems.length) return { ok: false, error: `not balanced: ${problems.join('; ')}` };
  if (!allowFractions) {
    const common = all.map((s) => s.num).reduce(gcd);
    if (common > 1) {
      return { ok: false, error: `coefficients are not in lowest terms (divide by ${common})` };
    }
  }
  return { ok: true };
}
