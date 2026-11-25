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


def _alternatives(text: str) -> list[tuple[str | None, str]]:
    """(subject, right-hand side) for each "... or ..." part and each side of ±.

    A part may repeat the subject ("x = p or x = q") or leave it out ("x = p or q"); a part with
    no subject takes the one before it. A right-hand side given alone has no subject.
    """
    out: list[tuple[str | None, str]] = []
    subject: str | None = None
    for part in [p.strip() for p in re.split(r"\bor\b", _normalise(text)) if p.strip()]:
        sides = part.split("=")
        if len(sides) > 2:
            raise ValueError(f"Write each part with at most one = sign: {text!r}")
        if len(sides) == 2:
            subject, part = sides[0].strip(), sides[1].strip()
        if "+-" in part:
            out += [(subject, part.replace("+-", "+")), (subject, part.replace("+-", "-"))]
        else:
            out.append((subject, part))
    return out


def formulas_match(expected: str, given: str) -> bool:
    """True when both formulas have the same subject and the same right-hand side(s)."""
    want = _alternatives(expected)
    got = _alternatives(given)
    if any(subject is None for subject, _ in want) or len({s for s, _ in want}) != 1:
        raise ValueError(f"The expected formula needs one subject (x = ...): {expected!r}")
    subject = parse(want[0][0])
    for got_subject, _ in got:
        if got_subject is not None and simplify(parse(got_subject) - subject) != 0:
            return False
    want_exprs = [parse(w) for _, w in want]
    got_exprs = [parse(g) for _, g in got]

    def same(a, b) -> bool:
        return simplify(a - b) == 0

    return all(any(same(w, g) for g in got_exprs) for w in want_exprs) and all(
        any(same(g, w) for w in want_exprs) for g in got_exprs
    )
