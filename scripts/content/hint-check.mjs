// A hint is a nudge toward the method, never the answer (docs/VERIFICATION.md, "Hints"). This
// refuses a hint that contains the item's final answer: the accepted text (ignoring spaces, case
// and the minus sign used), or for numeric answers any number in the hint equal to it or within
// 0.5% of it (1/2 for 0.5, 1.333 for 4/3), unless that number is already in the question.

const MINUS = /[−‒–—﹣－]/g;
// Lower case, one minus sign, single spaces, and no spaces next to symbols ("3n + 2" = "3n+2"),
// so word boundaries survive ("try 3n+2" still has a space before the answer).
const squash = (text) =>
  String(text)
    .replace(MINUS, '-')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s*([^a-z0-9\s])\s*/g, '$1')
    .trim();

/** `needle` occurs in `hay` (both squashed) not glued to a letter or digit on either side. */
function containsAnswer(hay, needle) {
  const h = squash(hay);
  const n = squash(needle);
  if (!n) return false;
  for (let at = h.indexOf(n); at !== -1; at = h.indexOf(n, at + 1)) {
    const before = h[at - 1];
    const after = h[at + n.length];
    const glued = (c) => c !== undefined && /[a-z0-9]/.test(c);
    // A leading letter or digit in the answer may not continue a word; a sign may.
    if (!(glued(before) && /[a-z0-9]/.test(n[0])) && !(glued(after) && /[a-z0-9]/.test(n.at(-1)))) {
      return true;
    }
  }
  return false;
}

const NUMBER = /-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/g;

/** Every number written in `text`, as a value: decimals and simple fractions. */
function numbersIn(text) {
  const values = [];
  for (const match of String(text).replace(MINUS, '-').matchAll(NUMBER)) {
    const [top, bottom] = match[0].replace(/\s+/g, '').split('/');
    const value = bottom === undefined ? Number(top) : Number(top) / Number(bottom);
    if (Number.isFinite(value)) values.push(value);
  }
  return values;
}

const close = (a, b) => a === b || (b !== 0 && Math.abs(a - b) <= Math.abs(b) * 0.005);

/** The texts that would give the answer away, and the numeric value if it is a number. */
function answerOf(item) {
  const { answer = {} } = item;
  switch (item.type) {
    case 'numeric':
      return { texts: [answer.value], value: numbersIn(answer.value)[0] };
    case 'short_answer':
      return { texts: answer.accepted ?? [] };
    case 'worked_maths':
      return { texts: [answer.expression, ...(answer.solutions ?? [])].filter(Boolean) };
    case 'multiple_choice':
      return { texts: [item.options?.[answer.option]].filter(Boolean) };
    case 'flashcard':
      return { texts: [item.back].filter(Boolean) };
    default:
      return { texts: [] };
  }
}

/** Problems with an item's hint; empty when it has none or it gives nothing away. */
export function hintErrors(item) {
  if (!item.hint) return [];
  const question = [item.prompt, item.front].filter(Boolean).join(' ');
  const { texts, value } = answerOf(item);
  const given = texts.find((t) => containsAnswer(item.hint, t) && !containsAnswer(question, t));
  if (given !== undefined) return [`hint gives away the answer (${given})`];
  if (value !== undefined) {
    const inQuestion = numbersIn(question);
    const leak = numbersIn(item.hint).find(
      (n) => close(n, value) && !inQuestion.some((q) => close(q, value)),
    );
    if (leak !== undefined)
      return [`hint gives away the answer (${leak} equals ${item.answer.value})`];
  }
  return [];
}
