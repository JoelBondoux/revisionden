"""Checks ordered lines of working: which line first stops following from the one before?

A line is either an expression (``x^2 + 5x + 6``) or one or more equations joined by ``or``
or commas (``x = 1/3 or x = -2``).

- Two expressions follow when they are identical.
- Two equations in one unknown follow when they have the same solutions.
- Two equations in several letters (rearranging a formula) follow when one is a non-zero
  constant multiple of the other.
- Switching between an expression and an equation does not follow.
"""

import re
from dataclasses import dataclass

from sympy import Expr, FiniteSet, Mul, Pow, S, Symbol, Union, expand, simplify, solveset

from app.equivalence import parse

MAX_LINES = 50
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


def _parse_line(text: str) -> Line:
    if "=" not in text:
        return Line(text=text, expression=parse(text))
    equations = []
    for part in ALTERNATIVES.split(text):
        sides = part.split("=")
        if len(sides) != 2:
            raise ValueError(f"Each equation needs exactly one = sign: {part!r}")
        equations.append(Equation(parse(sides[0]), parse(sides[1])))
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


def _equations_follow(before: Line, after: Line) -> bool:
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
    return ratio != 0 and not ratio.free_symbols


def _follows(before: Line, after: Line) -> bool:
    if before.is_equation != after.is_equation:
        return False
    if before.is_equation:
        return _equations_follow(before, after)
    return _same_values(before.expression, after.expression)


def _solved_value(eq: Equation) -> Expr | None:
    if isinstance(eq.lhs, Symbol) and not eq.rhs.free_symbols:
        return eq.rhs
    if isinstance(eq.rhs, Symbol) and not eq.lhs.free_symbols:
        return eq.lhs
    return None


def _in_form(line: Line, form: str | None) -> bool:
    if form == "factorised":
        return isinstance(parse(line.text, evaluate=False), (Mul, Pow))
    if form == "expanded":
        return expand(line.expression) == line.expression
    return True


def _final_answer_correct(line: Line, expected: dict) -> bool:
    if "solutions" in expected:
        if not line.is_equation:
            return False
        values = [_solved_value(eq) for eq in line.equations]
        if any(v is None for v in values):
            return False
        wanted = FiniteSet(*(parse(s) for s in expected["solutions"]))
        return _same_sets(FiniteSet(*values), wanted)
    if line.is_equation:
        return False
    return _same_values(line.expression, parse(expected["expression"])) and _in_form(
        line, expected.get("form")
    )


def check_working(lines: list[str], expected: dict | None = None) -> WorkingResult:
    """Find the first line (0-based) that does not follow from the previous one.

    ``expected`` is optional: ``{"solutions": [...]}`` for equations, or
    ``{"expression": "...", "form": "factorised" | "expanded"}`` for expressions.
    """
    if not lines:
        raise ValueError("Give at least one line of working")
    if len(lines) > MAX_LINES:
        raise ValueError(f"Give at most {MAX_LINES} lines of working")
    parsed = [_parse_line(text) for text in lines]
    first_wrong = next(
        (i for i in range(1, len(parsed)) if not _follows(parsed[i - 1], parsed[i])), None
    )
    final = None if expected is None else _final_answer_correct(parsed[-1], expected)
    return WorkingResult(first_wrong_line=first_wrong, final_answer_correct=final)
