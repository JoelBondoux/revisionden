"""Everyday maths notation rewritten into the engine's input form, before any parsing.

Matches the typed-answer normaliser in ``packages/core/src/answer-normalise.ts``:

- the unicode minus and dashes (− – — ‒) are a minus;
- × · ⋅ are a times sign, and so is x or X between two numbers (``1.5x10^11``); anywhere
  else x is the letter x;
- superscript digits and the superscript minus are a power (``10⁻³`` is ``10^-3``);
- a thousands separator (comma, space, thin or non-breaking space) is dropped only between
  groups of exactly three digits, the same separator each time (``30,000``, ``38 700``).
  Anything else, such as ``30,00`` or the list ``x = 3, x = -4``, is left as written.
"""

import re

DASHES = re.compile(r"[−–—‒]")
TIMES = re.compile(r"[×·⋅]")
TIMES_X = re.compile(r"(\d)\s*[xX]\s*(?=\d)")
SUPERSCRIPT = re.compile(r"[⁻⁰¹²³⁴-⁹]+")
SUPERSCRIPT_DIGITS = str.maketrans("⁻⁰¹²³⁴⁵⁶⁷⁸⁹",
                                   "-0123456789")
THOUSANDS = re.compile(r"(?<![\d.,])(\d{1,3})([,    ])(\d{3}(?:\2\d{3})*)(?![\d,])")


def _without_separators(match: re.Match) -> str:
    return match.group(1) + match.group(3).replace(match.group(2), "")


def normalise(text: str) -> str:
    """The text with everyday notation rewritten (see the module notes)."""
    text = DASHES.sub("-", text)
    text = SUPERSCRIPT.sub(lambda m: "^" + m.group(0).translate(SUPERSCRIPT_DIGITS), text)
    text = TIMES.sub("*", text)
    text = TIMES_X.sub(r"\1*", text)
    return THOUSANDS.sub(_without_separators, text)
