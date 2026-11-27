"""Computer Science engine: normalised floating point binary (OCR H446 1.4.1 (g) and (h)).

Mantissa and exponent are both two's complement; the binary point sits after the mantissa's first
bit. Expected values are worked by hand.
"""
from fractions import Fraction

import pytest

from app.cs import floating


@pytest.mark.parametrize("mantissa, exponent, value", [
    ("01101000", "0011", Fraction(13, 2)),    # 0.1101 x 2^3 = 110.1 = 6.5
    ("10100000", "0010", Fraction(-3)),       # -0.75 x 2^2
    ("01000000", "1111", Fraction(1, 4)),     # 0.5 x 2^-1
    ("10000000", "0000", Fraction(-1)),       # -1 x 2^0
    ("00110000", "0100", Fraction(6)),        # not normalised, but still a value: 0.375 x 16
    ("00000000", "0000", Fraction(0)),
])
def test_a_mantissa_and_exponent_give_a_value(mantissa, exponent, value):
    assert floating.decode(mantissa, exponent) == value


@pytest.mark.parametrize("value, mantissa, exponent", [
    (Fraction(13, 2), "01101000", "0011"),
    (Fraction(-3), "10100000", "0010"),
    (Fraction(1, 4), "01000000", "1111"),
    (Fraction(-1, 2), "10000000", "1111"),
    (Fraction(7, 2), "01110000", "0010"),
    (Fraction(0), "00000000", "0000"),
])
def test_a_value_is_written_normalised_in_eight_and_four_bits(value, mantissa, exponent):
    assert floating.encode(value, 8, 4) == (mantissa, exponent)
    assert floating.is_normalised(mantissa)


def test_a_value_that_cannot_be_held_exactly_is_refused():
    with pytest.raises(ValueError):
        floating.encode(Fraction(1, 10), 8, 4)        # 0.1 has no exact binary form
    with pytest.raises(ValueError):
        floating.encode(Fraction(1000), 8, 4)         # needs an exponent above 7
    with pytest.raises(ValueError):
        floating.encode(Fraction(255, 128), 8, 4)     # needs 9 mantissa bits


@pytest.mark.parametrize("mantissa, normalised", [
    ("01101000", True), ("10100000", True), ("00110000", False), ("11100000", False),
    ("10000000", True), ("11000000", False), ("00000000", True),
])
def test_normalised_means_the_first_two_mantissa_bits_differ(mantissa, normalised):
    assert floating.is_normalised(mantissa) is normalised


@pytest.mark.parametrize("mantissa, exponent, result", [
    ("00110000", "0100", ("01100000", "0011")),
    ("11100000", "0011", ("10000000", "0001")),
    ("00001100", "0011", ("01100000", "0000")),
    ("01101000", "0011", ("01101000", "0011")),
])
def test_normalising_shifts_the_mantissa_left_and_lowers_the_exponent(mantissa, exponent, result):
    assert floating.normalise(mantissa, exponent) == result
    assert floating.decode(*result) == floating.decode(mantissa, exponent)


def test_normalising_refuses_an_exponent_that_would_go_below_its_range():
    with pytest.raises(ValueError):
        floating.normalise("00000100", "1001")   # needs exponent -11, below -8


def test_floating_point_addition_and_subtraction_give_a_normalised_answer():
    assert floating.add(("01101000", "0011"), ("10100000", "0010"), 8, 4) == ("01110000", "0010")
    assert floating.subtract(("01101000", "0011"), ("01110000", "0010"), 8, 4) == ("01100000",
                                                                                    "0010")


def test_widths_are_checked():
    with pytest.raises(ValueError):
        floating.decode("0110", "01x1")
    with pytest.raises(ValueError):
        floating.encode(Fraction(1), 1, 4)
