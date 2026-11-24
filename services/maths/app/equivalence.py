"""Exact checking of maths working with SymPy. No AI involved."""
import re

from sympy import Symbol, simplify, solve, sympify
from sympy.parsing.sympy_parser import parse_expr, standard_transformations

ALLOWED = re.compile(r"^[0-9a-zA-Z_+\-*/^().\s]*$")
FORBIDDEN_WORDS = ("__", "import", "lambda", "exec", "eval", "open")


def _parse(text: str):
    if not ALLOWED.match(text) or any(w in text for w in FORBIDDEN_WORDS):
        raise ValueError(f"Unsupported characters in expression: {text!r}")
    return parse_expr(text.replace("^", "**"), transformations=standard_transformations, evaluate=True)


def are_equivalent(a: str, b: str) -> bool:
    """True when two expressions are mathematically identical."""
    return simplify(_parse(a) - _parse(b)) == 0


def solutions_match(expression: str, answers: list[str], variable: str = "x") -> bool:
    """True when the answers are exactly the solutions of expression = 0."""
    x = Symbol(variable)
    expected = {sympify(s) for s in solve(_parse(expression), x)}
    given = {sympify(_parse(s)) for s in answers}
    return expected == given
