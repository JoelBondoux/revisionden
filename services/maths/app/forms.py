"""Answer forms: whether a written answer is in the form the question asks for.

The value is checked elsewhere (``content_check``, ``working``); this only reads how it is
written, after everyday notation is normalised (``app/notation.py``):

- ``fraction``: a whole number or a single fraction ``a/b`` with b ≥ 2 (a minus sign allowed),
  no decimals;
- ``simplest_fraction``: the same, in lowest terms and not ``0/b`` (``27/99`` is not, ``3/11`` is);
- ``improper_fraction``: in lowest terms and never a mixed number (``49/20``, not ``2 9/20``).
  The engine does not read mixed numbers at all, so none of the fraction forms accepts one;
- ``standard_form``: ``A × 10^n`` with 1 ≤ |A| < 10 and n a whole number, |n| ≤ 100
  (``15 × 10^10`` and ``150000000000`` are not). e-notation (``6.4e8``) is refused here: the
  engine never reads it (input safety), though the app's typed-answer marking accepts it;
- ``index_form``: a product of different primes, each written once with an optional power
  (``2^3 × 3^2 × 5``, in any order; ``360`` and ``2 × 2 × 2 × 3^2 × 5`` are not).

These match ``packages/core/src/answer-format.ts`` (S2e) apart from e-notation.
"""

import re
from math import gcd

from sympy import isprime

from app.notation import normalise

FRACTION = re.compile(r"-?(\d+)(?:/(\d+))?")
STANDARD_FORM = re.compile(r"-?[1-9](?:\.\d+)?\*10\^\(?(-?\d+)\)?")
MAX_POWER = 100
PRIME_POWER = re.compile(r"(\d+)(?:\^(\d+))?")
MIXED_NUMBER = re.compile(r"\d\s+\d+/\d")


def _written(text: str) -> str:
    return re.sub(r"\s+", "", normalise(text))


def _fraction(text: str, simplest: bool) -> bool:
    match = FRACTION.fullmatch(text)
    if not match:
        return False
    if match.group(2) is None:
        return True
    num, den = int(match.group(1)), int(match.group(2))
    if den < 2:
        return False
    return not simplest or (num != 0 and gcd(num, den) == 1)


def _index_form(text: str) -> bool:
    bases = []
    for factor in text.split("*"):
        match = PRIME_POWER.fullmatch(factor)
        if not match or not isprime(int(match.group(1))):
            return False
        if match.group(2) is not None and int(match.group(2)) < 1:
            return False
        bases.append(int(match.group(1)))
    return len(bases) == len(set(bases))


FORMS = {
    "fraction": lambda t: _fraction(t, simplest=False),
    "simplest_fraction": lambda t: _fraction(t, simplest=True),
    "improper_fraction": lambda t: _fraction(t, simplest=True),
    "standard_form": lambda t: bool((m := STANDARD_FORM.fullmatch(t))
                                    and abs(int(m.group(1))) <= MAX_POWER),
    "index_form": _index_form,
}


def in_form(text: str, form: str) -> bool:
    """True when ``text`` is written in ``form`` (one of ``FORMS``)."""
    if form not in FORMS:
        raise ValueError(f"unknown answer form {form!r}")
    if "fraction" in form and MIXED_NUMBER.search(normalise(text)):
        return False
    return FORMS[form](_written(text))
