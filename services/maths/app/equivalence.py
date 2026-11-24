"""Exact checking of maths working with SymPy. No AI involved.

Student input is untrusted. Before anything reaches SymPy's parser it must pass these checks:

- only digits, single letters, a short list of function names, + - * / ^ ( ) . and spaces;
- at most ``MAX_LENGTH`` characters;
- no scientific-notation literals (``1e999``) and no powers inside exponents (``9^9^9``);
- numeric exponents no larger than ``MAX_EXPONENT``.

Names are looked up in a fixed table with Python builtins switched off, so nothing other than
the symbols and functions listed here can be reached.
"""

import re
import string

from sympy import Expr, Pow, Symbol, cos, exp, log, pi, simplify, sin, solve, sqrt, tan
from sympy.parsing.sympy_parser import (
    convert_xor,
    implicit_multiplication,
    parse_expr,
    standard_transformations,
)

MAX_LENGTH = 200
MAX_EXPONENT = 50

ALLOWED = re.compile(r"^[0-9a-zA-Z+\-*/^().\s]+$")
SCIENTIFIC_LITERAL = re.compile(r"\d\.?[eE][+-]?\d")
FUNCTIONS = {
    "sqrt": sqrt,
    "sin": sin,
    "cos": cos,
    "tan": tan,
    "log": log,
    "ln": log,
    "exp": exp,
    "pi": pi,
}
TRANSFORMATIONS = standard_transformations + (implicit_multiplication, convert_xor)


def _names() -> dict:
    names: dict = {letter: Symbol(letter) for letter in string.ascii_letters}
    names.update(FUNCTIONS)
    return names


def _check_text(text: str) -> None:
    if not text.strip():
        raise ValueError("Expression is empty")
    if len(text) > MAX_LENGTH:
        raise ValueError(f"Expression is longer than {MAX_LENGTH} characters")
    if not ALLOWED.match(text):
        raise ValueError(f"Unsupported characters in expression: {text!r}")
    if SCIENTIFIC_LITERAL.search(text):
        raise ValueError("Write standard form as a x 10^n, not with e")
    for word in re.findall(r"[a-zA-Z]+", text):
        if len(word) > 1 and word not in FUNCTIONS:
            raise ValueError(f"Unknown name {word!r}: use single letters for unknowns")


def _check_powers(expr: Expr) -> None:
    for node in expr.atoms(Pow):
        exponent = node.exp
        nested = [p for p in exponent.atoms(Pow) if p.exp != -1]
        if nested:
            raise ValueError("Powers inside exponents are not supported")
        if not exponent.free_symbols and abs(exponent) > MAX_EXPONENT:
            raise ValueError(f"Exponents larger than {MAX_EXPONENT} are not supported")


def parse(text: str, evaluate: bool = True) -> Expr:
    """Parse one untrusted expression safely, or raise ValueError.

    With ``evaluate=False`` the expression keeps the shape the student wrote, which is what
    form checks (factorised, expanded) need.
    """
    _check_text(text)
    names = _names()
    try:
        unevaluated = parse_expr(
            text,
            local_dict=names,
            global_dict={"__builtins__": {}, **_sympy_core()},
            transformations=TRANSFORMATIONS,
            evaluate=False,
        )
        _check_powers(unevaluated)
        if not evaluate:
            return unevaluated
        return parse_expr(
            text,
            local_dict=names,
            global_dict={"__builtins__": {}, **_sympy_core()},
            transformations=TRANSFORMATIONS,
            evaluate=True,
        )
    except ValueError:
        raise
    except Exception as err:  # SymPy raises many error types for malformed input
        raise ValueError(f"Could not read expression: {text!r}") from err


def _sympy_core() -> dict:
    """The constructors SymPy's parser emits for number literals and names."""
    from sympy import Add, Float, Function, Integer, Mul, Rational

    return {
        "Add": Add,
        "Mul": Mul,
        "Pow": Pow,
        "Integer": Integer,
        "Float": Float,
        "Rational": Rational,
        "Symbol": Symbol,
        "Function": Function,
    }


def parse_equation(text: str) -> Expr:
    """Parse ``lhs = rhs`` into ``lhs - rhs``, or a plain expression into itself."""
    parts = text.split("=")
    if len(parts) == 1:
        return parse(text)
    if len(parts) != 2:
        raise ValueError(f"Use exactly one = sign: {text!r}")
    return parse(parts[0]) - parse(parts[1])


def are_equivalent(a: str, b: str) -> bool:
    """True when two expressions are mathematically identical."""
    return simplify(parse(a) - parse(b)) == 0


def solutions_match(expression: str, answers: list[str], variable: str = "x") -> bool:
    """True when the answers are exactly the solutions of the equation (or expression = 0)."""
    x = Symbol(variable)
    expected = {simplify(s) for s in solve(parse_equation(expression), x)}
    given = {simplify(parse(s)) for s in answers}
    return expected == given
