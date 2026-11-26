"""Writes numbers and expressions the way a student writes them: 3x - 5, x^2 + 2x - 15.

The output is also valid maths engine input, so the cross-check can read it back.
"""


def signed_term(coef: int, letter: str, first: bool) -> str:
    """One term of a sum: ``+ 5x`` or ``- y`` (or ``-3`` when it comes first)."""
    size = abs(coef)
    body = letter if (size == 1 and letter) else f"{size}{letter}"
    if first:
        return f"-{body}" if coef < 0 else body
    return f"- {body}" if coef < 0 else f"+ {body}"


def sum_of(terms: list[tuple[int, str]]) -> str:
    """Terms ``(coef, letter)`` joined into a sum, skipping zeros: ``[(2, "x"), (-1, "")]`` is ``2x - 1``."""
    parts = []
    for coef, letter in terms:
        if coef == 0:
            continue
        parts.append(signed_term(coef, letter, first=not parts))
    return " ".join(parts) if parts else "0"


def linear(coef: int, constant: int, letter: str = "x") -> str:
    """``coef * letter + constant``, for example ``linear(3, -5) == "3x - 5"``."""
    return sum_of([(coef, letter), (constant, "")])


def polynomial(coefs: list[int], letter: str = "x") -> str:
    """Coefficients from the highest power down: ``[1, 2, -15]`` is ``x^2 + 2x - 15``."""
    top = len(coefs) - 1
    terms = []
    for i, coef in enumerate(coefs):
        power = top - i
        name = "" if power == 0 else letter if power == 1 else f"{letter}^{power}"
        terms.append((coef, name))
    return sum_of(terms)


def bracket(n: int) -> str:
    """A number ready to follow ×: negatives go in brackets."""
    return f"({n})" if n < 0 else str(n)


def times(coef: int, value: int) -> str:
    """``coef × value`` as written in a check line (just the value when coef is 1)."""
    return str(value) if coef == 1 else f"{coef} × {bracket(value)}"
