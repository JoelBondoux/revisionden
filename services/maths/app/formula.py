"""Compares two formulas such as ``x = (-b ± sqrt(b^2 - 4ac)) / (2a)``.

Used for maths flashcards (docs/VERIFICATION.md step 3): the blind answer may write the same
formula another way. Both must have the same subject (left-hand side) and the same set of
right-hand sides; ``±`` (or ``+-``) gives two right-hand sides, and so does "... or ...".
A right-hand side given alone (no ``=``) is compared with the expected right-hand side.
Notation is read strictly: ``1 / 2a`` is (1/2)·a, as in the rest of the maths engine.
"""

import re

from sympy import simplify

from app.equivalence import FUNCTIONS, parse

_SYMBOLS = {
    "±": "+-",
    "√": "sqrt",
    "²": "^2",
    "³": "^3",
    "×": "*",
    "·": "*",
    "−": "-",
    "[": "(",
    "]": ")",
}


def _letters_apart(match: re.Match) -> str:
    """``4ac`` means 4·a·c in a formula: split letter runs that are not function names."""
    word = match.group(0)
    return word if word in FUNCTIONS or word == "or" else "*".join(word)


def _normalise(text: str) -> str:
    for old, new in _SYMBOLS.items():
        text = text.replace(old, new)
    return re.sub(r"[a-zA-Z]+", _letters_apart, text)


def _branches(rhs: str) -> list[str]:
    """Each right-hand side the text stands for: "a or b" and "p +- q" give two each."""
    parts = [p.strip() for p in re.split(r"\bor\b", rhs) if p.strip()]
    out: list[str] = []
    for part in parts:
        if "+-" in part:
            out += [part.replace("+-", "+"), part.replace("+-", "-")]
        else:
            out.append(part)
    return out


def _split(text: str) -> tuple[str | None, list[str]]:
    """(subject, right-hand sides). A right-hand side given alone has no subject."""
    sides = _normalise(text).split("=")
    if len(sides) == 1:
        return None, _branches(sides[0])
    if len(sides) != 2:
        raise ValueError(f"Write the formula with at most one = sign: {text!r}")
    return sides[0].strip(), _branches(sides[1])


def formulas_match(expected: str, given: str) -> bool:
    """True when both formulas have the same subject and the same right-hand side(s)."""
    want_lhs, want = _split(expected)
    got_lhs, got = _split(given)
    if want_lhs is None:
        raise ValueError(f"The expected formula needs a subject (x = ...): {expected!r}")
    if got_lhs is not None and simplify(parse(want_lhs) - parse(got_lhs)) != 0:
        return False
    want_exprs = [parse(w) for w in want]
    got_exprs = [parse(g) for g in got]

    def same(a, b) -> bool:
        return simplify(a - b) == 0

    return all(any(same(w, g) for g in got_exprs) for w in want_exprs) and all(
        any(same(g, w) for w in want_exprs) for g in got_exprs
    )
