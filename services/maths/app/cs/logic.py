"""Boolean logic in OCR's notation (H446 1.4.3; appendix 5d, "Boolean Algebra").

OCR writes ∧, ∨, ¬, exclusive disjunction and ≡ in questions, and accepts AND, ., OR, +, ~,
NOT, XOR, ⊕ and ↔ from learners. ``parse`` reads all of them (Ʌ and ˅, the letters OCR's
specification uses for ∧ and ∨, too). Letters are single capital variables; 0 and 1 are
constants. Binding, tightest first: NOT, AND, XOR, OR, ≡.

Truth tables are computed by our own evaluator; ``simplify`` uses SymPy's Quine-McCluskey
(``simplify_logic``) and is checked against the evaluator, so the two methods must agree.
"""
import re
from dataclasses import dataclass
from itertools import product

from sympy import Symbol, false, true
from sympy.logic.boolalg import And, Not, Or, simplify_logic

_SYMBOLS = {
    "∧": "AND", "Ʌ": "AND", ".": "AND", "&": "AND",
    "∨": "OR", "˅": "OR", "+": "OR", "|": "OR",
    "¬": "NOT", "~": "NOT", "!": "NOT",
    "⊕": "XOR", "⊻": "XOR",
    "≡": "EQ", "↔": "EQ",
    "(": "(", ")": ")",
}
_WORDS = {"AND", "OR", "NOT", "XOR"}
_TOKEN = re.compile(r"\s*(?:([A-Za-z]+)|([01])|(.))")


def _tokens(text: str) -> list[tuple[str, str]]:
    tokens = []
    for word, digit, other in _TOKEN.findall(text.strip()):
        if word:
            upper = word.upper()
            if upper in _WORDS:
                tokens.append((upper, upper))
            elif len(word) == 1:
                tokens.append(("VAR", upper))
            else:
                raise ValueError(f"{word!r} is not a single-letter variable or an operator")
        elif digit:
            tokens.append(("CONST", digit))
        elif other in _SYMBOLS:
            tokens.append((_SYMBOLS[other], other))
        elif not other.isspace():
            raise ValueError(f"cannot read {other!r}")
    return tokens


class _Parser:
    LEVELS = ("EQ", "OR", "XOR", "AND")

    def __init__(self, tokens):
        self.tokens, self.at = tokens, 0

    def peek(self):
        return self.tokens[self.at][0] if self.at < len(self.tokens) else None

    def take(self):
        token = self.tokens[self.at]
        self.at += 1
        return token

    def binary(self, level: int):
        if level == len(self.LEVELS):
            return self.unary()
        op = self.LEVELS[level]
        left = self.binary(level + 1)
        while self.peek() == op:
            self.take()
            left = (op.lower(), left, self.binary(level + 1))
        return left

    def unary(self):
        kind = self.peek()
        if kind == "NOT":
            self.take()
            return ("not", self.unary())
        if kind == "(":
            self.take()
            inner = self.binary(0)
            if self.peek() != ")":
                raise ValueError("a bracket is not closed")
            self.take()
            return inner
        if kind == "VAR":
            return ("var", self.take()[1])
        if kind == "CONST":
            return ("const", int(self.take()[1]))
        raise ValueError("an operator is missing a letter or bracket next to it")


def parse(text: str) -> tuple:
    tokens = _tokens(text)
    if not tokens:
        raise ValueError("the expression is empty")
    parser = _Parser(tokens)
    tree = parser.binary(0)
    if parser.at != len(tokens):
        raise ValueError("two letters or brackets need an operator between them")
    return tree


def _letters(tree: tuple, found: set) -> set:
    if tree[0] == "var":
        found.add(tree[1])
    for child in tree[1:]:
        if isinstance(child, tuple):
            _letters(child, found)
    return found


def variables(text: str) -> list[str]:
    return sorted(_letters(parse(text), set()))


def evaluate(tree: tuple, values: dict) -> int:
    kind = tree[0]
    if kind == "var":
        return values[tree[1]]
    if kind == "const":
        return tree[1]
    if kind == "not":
        return 1 - evaluate(tree[1], values)
    a, b = evaluate(tree[1], values), evaluate(tree[2], values)
    return {"and": a & b, "or": a | b, "xor": a ^ b, "eq": int(a == b)}[kind]


def _table(tree: tuple, letters: list[str]) -> list[tuple[tuple[int, ...], int]]:
    return [(row, evaluate(tree, dict(zip(letters, row))))
            for row in product((0, 1), repeat=len(letters))]


def truth_table(text: str) -> list[tuple[tuple[int, ...], int]]:
    """Rows in binary counting order of the letters (A first), each with the output."""
    tree = parse(text)
    return _table(tree, sorted(_letters(tree, set())))


def equivalent(a: str, b: str) -> bool:
    ta, tb = parse(a), parse(b)
    letters = sorted(_letters(ta, set()) | _letters(tb, set()))
    return _table(ta, letters) == _table(tb, letters)


def _to_sympy(tree: tuple):
    kind = tree[0]
    if kind == "var":
        return Symbol(tree[1])
    if kind == "const":
        return true if tree[1] else false
    if kind == "not":
        return Not(_to_sympy(tree[1]))
    a, b = _to_sympy(tree[1]), _to_sympy(tree[2])
    if kind == "and":
        return And(a, b)
    if kind == "or":
        return Or(a, b)
    if kind == "xor":
        return Or(And(a, Not(b)), And(Not(a), b))
    return Or(And(a, b), And(Not(a), Not(b)))


def _literal_text(lit) -> str:
    return f"¬{lit.args[0]}" if isinstance(lit, Not) else str(lit)


def _term_text(term) -> str:
    literals = term.args if isinstance(term, And) else (term,)
    return " ∧ ".join(sorted((_literal_text(x) for x in literals), key=lambda s: s.lstrip("¬")))


def simplify(text: str) -> str:
    """The shortest sum of products, in OCR notation (``0`` or ``1`` for a constant)."""
    tree = parse(text)
    outputs = {value for _, value in _table(tree, sorted(_letters(tree, set())))}
    result = simplify_logic(_to_sympy(tree), form="dnf", force=True)
    if outputs == {1}:
        answer = "1"
    elif outputs == {0}:
        answer = "0"
    else:
        terms = sorted((_term_text(t) for t in (result.args if isinstance(result, Or)
                                                 else (result,))), key=lambda s: (len(s), s))
        many = len(terms) > 1
        answer = " ∨ ".join(f"({t})" if many and " ∧ " in t else t for t in terms)
    if not equivalent(answer, text):  # the two methods must agree
        raise ArithmeticError(f"simplify disagrees with the truth table for {text!r}")
    return answer


def _count(tree: tuple) -> int:
    if tree[0] == "var":
        return 1
    return sum(_count(c) for c in tree[1:] if isinstance(c, tuple))


def literal_count(text: str) -> int:
    """How many letters are written (¬A counts as one)."""
    return _count(parse(text))


def is_simplest(given: str, original: str) -> bool:
    """Right value, and no more letters than the shortest sum of products."""
    try:
        return equivalent(given, original) and literal_count(given) <= literal_count(
            simplify(original))
    except ValueError:
        return False


@dataclass(frozen=True)
class KarnaughMap:
    rows: tuple[str, list[str]]
    cols: tuple[str, list[str]]
    cells: list[list[int]]


_GRAY = {1: ["0", "1"], 2: ["00", "01", "11", "10"]}


def karnaugh_map(text: str) -> KarnaughMap:
    """Rows and columns in Gray code order: A by B, A by BC, or AB by CD."""
    tree = parse(text)
    letters = sorted(_letters(tree, set()))
    if not 2 <= len(letters) <= 4:
        raise ValueError("a Karnaugh map here takes 2 to 4 letters")
    split = 1 if len(letters) < 4 else 2
    row_letters, col_letters = letters[:split], letters[split:]
    row_codes, col_codes = _GRAY[len(row_letters)], _GRAY[len(col_letters)]
    cells = [[evaluate(tree, {**dict(zip(row_letters, map(int, r))),
                              **dict(zip(col_letters, map(int, c)))}) for c in col_codes]
             for r in row_codes]
    return KarnaughMap(("".join(row_letters), row_codes), ("".join(col_letters), col_codes), cells)


_SIGN = {"and": "∧", "or": "∨", "xor": "⊕", "eq": "≡"}
_BRACKET = {"and": {"or", "xor", "eq"}, "or": {"and", "xor", "eq"}, "xor": {"and", "or", "eq"},
            "eq": {"and", "or", "xor", "eq"}}


def _write(tree: tuple) -> str:
    kind = tree[0]
    if kind == "var":
        return tree[1]
    if kind == "const":
        return str(tree[1])
    if kind == "not":
        inner = _write(tree[1])
        return f"¬{inner}" if tree[1][0] in ("var", "const", "not") else f"¬({inner})"
    parts = [f"({_write(c)})" if c[0] in _BRACKET[kind] else _write(c) for c in tree[1:]]
    return f" {_SIGN[kind]} ".join(parts)


def to_ocr(text: str) -> str:
    """An expression in OCR's notation, with each AND group bracketed inside an OR."""
    return _write(parse(text))


def half_adder(a: int, b: int) -> tuple[int, int]:
    """(sum, carry): sum = A ⊕ B, carry = A ∧ B."""
    return a ^ b, a & b


def full_adder(a: int, b: int, carry_in: int) -> tuple[int, int]:
    """(sum, carry out), built from two half adders and an OR gate."""
    s1, c1 = half_adder(a, b)
    s2, c2 = half_adder(s1, carry_in)
    return s2, c1 | c2
