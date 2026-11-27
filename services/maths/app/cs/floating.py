"""Normalised floating point binary (OCR H446 1.4.1 (g) and (h)).

The mantissa and the exponent are both two's complement. The binary point sits straight after
the mantissa's first (sign) bit, so an 8-bit mantissa ``01101000`` is 0.1101000. A normalised
mantissa starts ``01`` (positive) or ``10`` (negative); zero is all zeros. Values are exact
``Fraction``s, so nothing is lost to rounding.
"""
from fractions import Fraction

from app.cs.bases import _bits, from_twos_complement, to_twos_complement


def _mantissa_value(mantissa: str) -> Fraction:
    return Fraction(from_twos_complement(_bits(mantissa)), 2 ** (len(mantissa) - 1))


def decode(mantissa: str, exponent: str) -> Fraction:
    return _mantissa_value(mantissa) * Fraction(2) ** from_twos_complement(_bits(exponent))


def is_normalised(mantissa: str) -> bool:
    mantissa = _bits(mantissa)
    return set(mantissa) == {"0"} or mantissa[0] != mantissa[1]


def encode(value: Fraction, m_bits: int, e_bits: int) -> tuple[str, str]:
    """The normalised mantissa and exponent for ``value``; ValueError if it cannot be held exactly."""
    if m_bits < 2 or e_bits < 2:
        raise ValueError("the mantissa and the exponent need at least 2 bits each")
    value = Fraction(value)
    if value == 0:
        return "0" * m_bits, "0" * e_bits
    # Find e with the mantissa value m = value / 2^e in [1/2, 1) or [-1, -1/2).
    e = 0
    m = value
    while not (Fraction(1, 2) <= m < 1 or -1 <= m < Fraction(-1, 2)):
        if abs(m) >= 1 and m != -1:
            m, e = m / 2, e + 1
        else:
            m, e = m * 2, e - 1
    scaled = m * 2 ** (m_bits - 1)
    if scaled.denominator != 1:
        raise ValueError(f"{value} needs more than {m_bits} mantissa bits")
    return to_twos_complement(int(scaled), m_bits), to_twos_complement(e, e_bits)


def normalise(mantissa: str, exponent: str) -> tuple[str, str]:
    """Shift the mantissa left until its first two bits differ, lowering the exponent each time."""
    mantissa, exponent = _bits(mantissa), _bits(exponent)
    e = from_twos_complement(exponent)
    while not is_normalised(mantissa):
        mantissa, e = mantissa[1:] + "0", e - 1
    return mantissa, to_twos_complement(e, len(exponent))


def add(a: tuple[str, str], b: tuple[str, str], m_bits: int, e_bits: int) -> tuple[str, str]:
    return encode(decode(*a) + decode(*b), m_bits, e_bits)


def subtract(a: tuple[str, str], b: tuple[str, str], m_bits: int, e_bits: int) -> tuple[str, str]:
    return encode(decode(*a) - decode(*b), m_bits, e_bits)
