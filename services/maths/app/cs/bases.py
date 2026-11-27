"""Number bases and binary arithmetic (OCR H446 1.4.1 (b) to (f) and (i)).

Binary is a string of 0s and 1s, most significant bit first. Every function is pure and checks
its input, so a template can never build an item from a value that does not fit its bits.
"""
import re
from dataclasses import dataclass

HEX_DIGITS = "0123456789ABCDEF"


def _bits(text: str) -> str:
    if not text or set(text) - {"0", "1"}:
        raise ValueError(f"{text!r} is not binary")
    return text


def _width(n: int, bits: int | None, low: int, high: int) -> None:
    if not low <= n <= high:
        raise ValueError(f"{n} does not fit in {bits} bits")


def to_binary(n: int, bits: int | None = None) -> str:
    """A non-negative whole number in binary, padded to ``bits`` when given."""
    if n < 0:
        raise ValueError("to_binary takes a positive whole number; use to_twos_complement")
    text = format(n, "b")
    if bits is None:
        return text
    _width(n, bits, 0, 2**bits - 1)
    return text.zfill(bits)


def from_binary(text: str) -> int:
    return int(_bits(text), 2)


def to_hex(n: int) -> str:
    if n < 0:
        raise ValueError("to_hex takes a positive whole number")
    return format(n, "X")


def from_hex(text: str) -> int:
    if not text or set(text.upper()) - set(HEX_DIGITS):
        raise ValueError(f"{text!r} is not hexadecimal")
    return int(text, 16)


def binary_to_hex(text: str) -> str:
    """Groups of four bits from the right, each written as one hexadecimal digit."""
    text = _bits(text)
    text = text.zfill(-(-len(text) // 4) * 4)
    return "".join(HEX_DIGITS[int(text[i:i + 4], 2)] for i in range(0, len(text), 4)).lstrip(
        "0") or "0"


def hex_to_binary(text: str, bits: int | None = None) -> str:
    value = from_hex(text)
    return to_binary(value, bits if bits is not None else 4 * len(text))


def to_twos_complement(n: int, bits: int) -> str:
    _width(n, bits, -(2 ** (bits - 1)), 2 ** (bits - 1) - 1)
    return format(n % 2**bits, "b").zfill(bits)


def from_twos_complement(text: str) -> int:
    value = from_binary(text)
    return value - 2 ** len(text) if text[0] == "1" else value


def to_sign_magnitude(n: int, bits: int) -> str:
    _width(n, bits, -(2 ** (bits - 1) - 1), 2 ** (bits - 1) - 1)
    return ("1" if n < 0 else "0") + format(abs(n), "b").zfill(bits - 1)


def from_sign_magnitude(text: str) -> int:
    magnitude = from_binary(text[1:]) if len(text) > 1 else 0
    _bits(text)
    return -magnitude if text[0] == "1" else magnitude


@dataclass(frozen=True)
class Sum:
    """A column addition: the result in the same width, the carry into each column (written
    under that column, as on paper), the carry out of the top bit, and two's complement overflow."""

    result: str
    carries: str
    carry_out: bool
    overflow: bool


def _add(a: str, b: str) -> Sum:
    a, b = _bits(a), _bits(b)
    if len(a) != len(b):
        raise ValueError("binary numbers must have the same number of bits")
    result, carries, carry = [], [], 0
    for x, y in zip(reversed(a), reversed(b)):
        carries.append(str(carry))
        total = int(x) + int(y) + carry
        result.append(str(total % 2))
        carry = total // 2
    out = "".join(reversed(result))
    # Overflow: both numbers have the same sign and the result has the other sign.
    overflow = a[0] == b[0] and out[0] != a[0]
    return Sum(out, "".join(reversed(carries)), bool(carry), overflow)


def add_unsigned(a: str, b: str) -> Sum:
    return _add(a, b)


def add_twos_complement(a: str, b: str) -> Sum:
    return _add(a, b)


def negate(text: str) -> str:
    """The two's complement negation: flip every bit, then add 1."""
    flipped = "".join("1" if c == "0" else "0" for c in _bits(text))
    return _add(flipped, "0" * (len(text) - 1) + "1").result


def subtract_twos_complement(a: str, b: str) -> Sum:
    """a - b by adding the negation of b. Overflow when the true difference does not fit."""
    total = _add(a, negate(b))
    true = from_twos_complement(a) - from_twos_complement(b)
    half = 2 ** (len(a) - 1)
    return Sum(total.result, total.carries, total.carry_out, not -half <= true < half)


def shift(text: str, places: int, direction: str = "left", kind: str = "logical") -> str:
    """A logical, arithmetic (keeps the sign bit on a right shift) or circular shift."""
    text = _bits(text)
    if direction not in ("left", "right"):
        raise ValueError(f"unknown direction {direction!r}")
    if kind not in ("logical", "arithmetic", "circular"):
        raise ValueError(f"unknown shift {kind!r}")
    n = len(text)
    places = min(places, n) if kind != "circular" else places % n
    if kind == "circular":
        return text[places:] + text[:places] if direction == "left" else (
            text[n - places:] + text[:n - places])
    if direction == "left":
        return text[places:] + "0" * places
    fill = text[0] if kind == "arithmetic" else "0"
    return fill * places + text[:n - places]


_MASKS = {"AND": lambda x, y: x & y, "OR": lambda x, y: x | y, "XOR": lambda x, y: x ^ y}


def apply_mask(text: str, mask: str, op: str) -> str:
    if op not in _MASKS:
        raise ValueError(f"unknown mask operation {op!r}")
    text, mask = _bits(text), _bits(mask)
    if len(text) != len(mask):
        raise ValueError("the mask must have as many bits as the number")
    return "".join(str(_MASKS[op](int(x), int(y))) for x, y in zip(text, mask))


def same_bits(given: str, expected: str) -> bool:
    """A binary answer: every bit written (leading zeros too); spaces and underscores ignored."""
    cleaned = re.sub(r"[\s_]", "", given)
    return bool(cleaned) and set(cleaned) <= {"0", "1"} and cleaned == expected


def same_hex(given: str, expected: str) -> bool:
    """A hexadecimal answer, by value: any case, spaces, a 0x prefix or a subscript 16 allowed."""
    cleaned = re.sub(r"\s", "", given)
    cleaned = re.sub(r"^0[xX]", "", cleaned)
    cleaned = re.sub(r"(₁₆|_16|h|H)$", "", cleaned)
    try:
        return from_hex(cleaned) == from_hex(expected)
    except ValueError:
        return False
