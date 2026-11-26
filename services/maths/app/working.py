"""Checks ordered lines of working: which line first stops following from the one before?

A line is either an expression (``x^2 + 5x + 6``) or one or more equations joined by ``or``
or commas (``x = 1/3 or x = -2``).

- Two expressions follow when they are identical.
- Two equations in one unknown follow when they have the same solutions.
- Two equations in several letters (rearranging a formula) follow when one is a non-zero
  constant multiple of the other; when the answer declares a letter subject, the multiple may be
  any non-zero expression without that letter (dividing by ``a`` to make ``t`` the subject).
- Switching between an expression and an equation does not follow.

An expected answer may declare its ``subject`` (``t``, ``f^-1(x)``): a final line written as
``<subject> = RHS`` then answers with RHS. A subject in function notation, which is not a letter,
is read as its RHS, and follows from a line ``y = E`` when E is the same as RHS.
"""

import re
from dataclasses import dataclass
from itertools import product
from math import prod

from sympy import Expr, FiniteSet, Mul, Pow, S, Symbol, Union, expand, simplify, solveset

from app.equivalence import parse
from app.forms import FORMS, in_form
from app.notation import normalise

MAX_LINES = 50
# At most this many ways to read a final line of letter-to-letter alternatives (a = x).
MAX_READINGS = 64
ALTERNATIVES = re.compile(r"\s+or\s+|,")


@dataclass(frozen=True)
class Equation:
    lhs: Expr
    rhs: Expr

    @property
    def zero_form(self) -> Expr:
        return self.lhs - self.rhs


@dataclass(frozen=True)
class Line:
    text: str
    expression: Expr | None = None
    equations: tuple[Equation, ...] = ()
    states_subject: bool = False

    @property
    def is_equation(self) -> bool:
        return bool(self.equations)

    @property
    def symbols(self) -> set[Symbol]:
        if self.expression is not None:
            return set(self.expression.free_symbols)
        found: set[Symbol] = set()
        for eq in self.equations:
            found |= eq.zero_form.free_symbols
        return found


@dataclass(frozen=True)
class WorkingResult:
    first_wrong_line: int | None
    final_answer_correct: bool | None


LETTER = re.compile(r"[A-Za-z]")


def _squash(text: str) -> str:
    return re.sub(r"\s+", "", text)


def without_subject(text: str, subject: str | None) -> str | None:
    """RHS when ``text`` reads ``<subject> = RHS`` (spaces ignored), else None."""
    if not subject:
        return None
    left, sep, right = text.partition("=")
    if not sep or "=" in right or not right.strip() or _squash(left) != _squash(subject):
        return None
    return right.strip()


def _parse_line(text: str, subject: str | None = None) -> Line:
    text = normalise(text)
    rhs = without_subject(text, subject)
    if rhs is not None and not LETTER.fullmatch(_squash(subject or "")):
        return Line(text=text, expression=parse(rhs, exact=True), states_subject=True)
    if "=" not in text:
        return Line(text=text, expression=parse(text, exact=True))
    equations = []
    for part in ALTERNATIVES.split(text):
        sides = part.split("=")
        if len(sides) != 2:
            raise ValueError(f"Each equation needs exactly one = sign: {part!r}")
        equations.append(Equation(parse(sides[0], exact=True), parse(sides[1], exact=True)))
    return Line(text=text, equations=tuple(equations))


def _same_values(a: Expr, b: Expr) -> bool:
    return simplify(a - b) == 0


def _same_sets(a, b) -> bool:
    if isinstance(a, FiniteSet) and isinstance(b, FiniteSet):
        return all(any(_same_values(x, y) for y in b) for x in a) and all(
            any(_same_values(y, x) for x in a) for y in b
        )
    return a == b


def _solution_set(line: Line, variable: Symbol):
    return Union(*(solveset(eq.zero_form, variable, domain=S.Complexes) for eq in line.equations))


def _equations_follow(before: Line, after: Line, subject: Symbol | None = None) -> bool:
    symbols = before.symbols | after.symbols
    if not symbols:
        truth = [all(_same_values(eq.lhs, eq.rhs) for eq in ln.equations) for ln in (before, after)]
        return truth[0] == truth[1]
    if len(symbols) == 1:
        (variable,) = symbols
        return _same_sets(_solution_set(before, variable), _solution_set(after, variable))
    if len(before.equations) != 1 or len(after.equations) != 1:
        return False
    ratio = simplify(before.equations[0].zero_form / after.equations[0].zero_form)
    if ratio == 0:
        return False
    if subject is not None:
        return subject not in ratio.free_symbols
    return not ratio.free_symbols


def _states_the_same_subject(before: Line, after: Line) -> bool:
    """``y = E`` then ``f^-1(x) = RHS``: follows when E is RHS."""
    if len(before.equations) != 1:
        return False
    eq = before.equations[0]
    sides = [(eq.lhs, eq.rhs), (eq.rhs, eq.lhs)]
    return any(isinstance(a, Symbol) and _same_values(b, after.expression) for a, b in sides)


def _follows(before: Line, after: Line, subject: Symbol | None = None) -> bool:
    if after.states_subject and before.is_equation:
        return _states_the_same_subject(before, after)
    if before.is_equation != after.is_equation:
        return False
    if before.is_equation:
        return _equations_follow(before, after, subject)
    return _same_values(before.expression, after.expression)


def _solved_values(eq: Equation) -> list[Expr]:
    """The possible values in ``x = value`` (either way round). A value may use other letters
    (``x = 2a``) but never the unknown itself. With a letter on each side (``a = x``) either
    letter may be the unknown, so both are candidates."""
    values = []
    if isinstance(eq.lhs, Symbol) and eq.lhs not in eq.rhs.free_symbols:
        values.append(eq.rhs)
    if isinstance(eq.rhs, Symbol) and eq.rhs not in eq.lhs.free_symbols:
        values.append(eq.lhs)
    return values


def _in_form(line: Line, form: str | None) -> bool:
    if form in FORMS:
        return in_form(line.text, form)
    if form == "factorised":
        return isinstance(parse(line.text, evaluate=False), (Mul, Pow))
    if form == "expanded":
        return expand(line.expression) == line.expression
    return True


def _final_answer_correct(line: Line, expected: dict) -> bool:
    rhs = without_subject(line.text, expected.get("subject"))
    if rhs is not None and "expression" in expected:
        line = Line(text=rhs, expression=parse(rhs, exact=True))
    if "solutions" in expected:
        if not line.is_equation:
            return False
        wanted = FiniteSet(*(parse(s, exact=True) for s in expected["solutions"]))
        candidates = []
        for eq in dict.fromkeys(line.equations):
            # Keep only the readings that are a wanted value: a choice of readings can only
            # match the wanted set when every chosen value is in it.
            kept = [v for v in _solved_values(eq) if any(_same_values(v, w) for w in wanted)]
            if not kept:
                return False
            candidates.append(kept)
        if prod(len(c) for c in candidates) > MAX_READINGS:
            return False
        return any(_same_sets(FiniteSet(*values), wanted) for values in product(*candidates))
    if line.is_equation:
        return False
    return _same_values(line.expression, parse(expected["expression"], exact=True)) and _in_form(
        line, expected.get("form")
    )


def check_working(lines: list[str], expected: dict | None = None) -> WorkingResult:
    """Find the first line (0-based) that does not follow from the previous one.

    ``expected`` is optional: ``{"solutions": [...]}`` for equations, or
    ``{"expression": "...", "form": ...}`` for expressions (``factorised``, ``expanded`` or an
    answer form from ``app/forms.py``), either with an
    optional ``subject`` that the final line may state (``t = ...``).
    """
    if not lines:
        raise ValueError("Give at least one line of working")
    if len(lines) > MAX_LINES:
        raise ValueError(f"Give at most {MAX_LINES} lines of working")
    subject = (expected or {}).get("subject")
    parsed = [_parse_line(text, subject) for text in lines]
    letter = Symbol(_squash(subject)) if subject and LETTER.fullmatch(_squash(subject)) else None
    first_wrong = next(
        (i for i in range(1, len(parsed)) if not _follows(parsed[i - 1], parsed[i], letter)),
        None,
    )
    final = None if expected is None else _final_answer_correct(parsed[-1], expected)
    return WorkingResult(first_wrong_line=first_wrong, final_answer_correct=final)
