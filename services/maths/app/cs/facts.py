"""CS engine fact proofs for the fact-check stage (decision 0009 (b), docs/VERIFICATION.md 4b).

Each kind returns None when the fact is proved, or the reason it is not. A proof only shows what
the item's ``engine`` block states; the adversarial review and the human reviewer check that the
block really captures the fact, and a third provider's blind statement is still required.

- ``cs_arithmetic``: whole-number ``expression`` (+, -, *, ^, DIV, MOD, brackets) equals ``value``.
- ``cs_base``: ``value`` written in ``from_base`` (2, 10 or 16) is ``result`` in ``to_base``,
  checked two ways (Python's own conversion and repeated division).
- ``cs_signed``: with ``bits`` and ``value``, the bits mean that value in ``representation``
  (``twos_complement`` or ``sign_magnitude``). With ``width`` only, the general rule is proved
  for every pattern of that width (2 to 16 bits): in two's complement the leftmost bit is worth -2^(n-1) and the
  rest their usual place values, and inverting every bit then adding 1 negates; in sign and
  magnitude the leftmost bit is the sign and the rest the size.
- ``cs_logic_equivalence``: ``left`` and ``right`` are (or, with ``equivalent: false``, are not)
  equivalent, by truth table over all their letters.
"""
import re

from app.cs import bases, logic

_TOKEN = re.compile(r"\s*(\d+|DIV|MOD|[-+*^()])")
_DIGITS = {2: "01", 10: "0123456789", 16: "0123456789ABCDEF"}
MAX_WIDTH = 16


def _tokens(text: str) -> list[str]:
    tokens, at = [], 0
    text = text.rstrip()
    while at < len(text):
        m = _TOKEN.match(text, at)
        if not m:
            raise ValueError(f"{text!r} is not whole-number arithmetic")
        tokens.append(m.group(1))
        at = m.end()
    if not tokens or "**" in text:
        raise ValueError(f"{text!r} is not whole-number arithmetic")
    return tokens


def _evaluate(tokens: list[str]) -> int:
    """Whole-number arithmetic, no eval. Loosest first: + -, then * DIV MOD, then unary minus,
    then ^ (right to left); DIV and MOD round down, as in the pseudocode interpreter."""
    at = 0

    def peek():
        return tokens[at] if at < len(tokens) else None

    def take():
        nonlocal at
        if at >= len(tokens):
            raise ValueError("the expression ends too soon")
        at += 1
        return tokens[at - 1]

    def add():
        value = mul()
        while peek() in ("+", "-"):
            value = value + mul() if take() == "+" else value - mul()
        return value

    def mul():
        value = unary()
        while peek() in ("*", "DIV", "MOD"):
            op, right = take(), unary()
            if op != "*" and right == 0:
                raise ArithmeticError("division by zero")
            value = value * right if op == "*" else value // right if op == "DIV" else value % right
        return value

    def unary():
        if peek() == "-":
            take()
            return -unary()
        return power()

    def power():
        value = atom()
        if peek() == "^":
            take()
            exponent = unary()
            if exponent < 0:
                raise ValueError("a negative power is not a whole number")
            return value ** exponent
        return value

    def atom():
        token = take() if peek() is not None else None
        if token == "(":
            value = add()
            if take() != ")":
                raise ValueError("a bracket is not closed")
            return value
        if token is None or not token.isdigit():
            raise ValueError(f"expected a number, not {token!r}")
        return int(token)

    value = add()
    if at != len(tokens):
        raise ValueError(f"unexpected {tokens[at]!r}")
    return value


def _arithmetic(check: dict) -> str | None:
    value = _evaluate(_tokens(check["expression"]))
    if value != check["value"]:
        return f"{check['expression']} = {value}, not {check['value']}"
    return None


def _in_base(text: str, base: int) -> int:
    text = text.upper()
    if not text or set(text) - set(_DIGITS[base]):
        raise ValueError(f"{text!r} is not a base {base} number")
    return int(text, base)


def _by_division(n: int, base: int) -> str:
    digits = ""
    while n:
        digits = _DIGITS[16][n % base] + digits
        n //= base
    return digits or "0"


def _base(check: dict) -> str | None:
    for key in ("from_base", "to_base"):
        if check[key] not in _DIGITS:
            return f"{key} {check[key]!r} is not 2, 10 or 16"
    result = str(check["result"]).upper()
    if not result or set(result) - set(_DIGITS[check["to_base"]]):
        return f"{check['result']!r} is not a base {check['to_base']} number"
    n = _in_base(str(check["value"]), check["from_base"])
    expected = _by_division(n, check["to_base"])
    engine = {2: lambda v: bases.to_binary(v), 10: str, 16: bases.to_hex}[check["to_base"]](n)
    if expected != engine:  # the two methods must agree
        return f"the two conversions disagree ({expected} and {engine})"
    if result.lstrip("0") != expected.lstrip("0"):
        return f"{check['value']} in base {check['to_base']} is {expected}, not {check['result']}"
    return None


def _place_value_reading(pattern: str) -> int:
    return -int(pattern[0]) * 2 ** (len(pattern) - 1) + sum(
        int(b) * 2 ** i for i, b in enumerate(reversed(pattern[1:])))


def _twos_rule(width: int) -> str | None:
    half = 2 ** (width - 1)
    for n in range(2 ** width):
        pattern = format(n, f"0{width}b")
        reading = _place_value_reading(pattern)
        if not (-half <= reading < half and reading % 2 ** width == n):
            return f"{pattern}: the place-value reading {reading} is not its two's complement value"
        if reading != -half:
            inverted = "".join("1" if b == "0" else "0" for b in pattern)
            negated = format((int(inverted, 2) + 1) % 2 ** width, f"0{width}b")
            if _place_value_reading(negated) != -reading:
                return f"{pattern}: inverting and adding 1 does not give {-reading}"
    return None


def _sign_magnitude_rule(width: int) -> str | None:
    for n in range(-(2 ** (width - 1) - 1), 2 ** (width - 1)):
        pattern = bases.to_sign_magnitude(n, width)
        sign, size = pattern[0], int(pattern[1:], 2)
        if (sign == "1") != (n < 0) or size != abs(n):
            return f"{n}: {pattern} does not have the sign first and the size after"
    return None


def _signed(check: dict) -> str | None:
    representation = check["representation"]
    rules = {"twos_complement": (_twos_rule, bases.from_twos_complement),
             "sign_magnitude": (_sign_magnitude_rule, bases.from_sign_magnitude)}
    if representation not in rules:
        return f"unknown representation {representation!r}"
    rule, read = rules[representation]
    if "bits" not in check:
        width = check.get("width")
        # Every pattern is tried, so the width is capped (A-Level questions use 4 to 16 bits).
        if not isinstance(width, int) or isinstance(width, bool) or not 2 <= width <= MAX_WIDTH:
            return f"width {width!r} must be a whole number from 2 to {MAX_WIDTH}"
        return rule(width)
    value = read(check["bits"])
    if value != check["value"]:
        return f"{check['bits']} in {representation} is {value}, not {check['value']}"
    return None


def _logic_equivalence(check: dict) -> str | None:
    same = logic.equivalent(check["left"], check["right"])
    wanted = check.get("equivalent", True)
    if same != wanted:
        return (f"{check['left']} and {check['right']} are "
                f"{'' if same else 'not '}equivalent")
    return None


KINDS = {
    "cs_arithmetic": _arithmetic,
    "cs_base": _base,
    "cs_signed": _signed,
    "cs_logic_equivalence": _logic_equivalence,
}
