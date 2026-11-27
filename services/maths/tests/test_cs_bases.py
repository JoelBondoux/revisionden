"""Computer Science engine: number bases, signed binary, binary arithmetic, shifts and masks.

Expected values are worked by hand (OCR H446 1.4.1 (b) to (f) and (i)).
"""
import pytest

from app.cs import bases


@pytest.mark.parametrize("n, bits, text", [
    (0, 8, "00000000"), (5, 4, "0101"), (45, 8, "00101101"), (255, 8, "11111111"), (6, None, "110"),
])
def test_positive_integers_are_written_in_binary(n, bits, text):
    assert bases.to_binary(n, bits) == text
    assert bases.from_binary(text) == n


def test_a_number_too_big_for_the_bits_is_refused():
    with pytest.raises(ValueError):
        bases.to_binary(256, 8)
    with pytest.raises(ValueError):
        bases.to_binary(-1, 8)


@pytest.mark.parametrize("n, text", [(0, "0"), (10, "A"), (255, "FF"), (2748, "ABC"), (4096, "1000")])
def test_positive_integers_are_written_in_hexadecimal(n, text):
    assert bases.to_hex(n) == text
    assert bases.from_hex(text) == n
    assert bases.from_hex(text.lower()) == n


def test_binary_and_hexadecimal_convert_a_nibble_at_a_time():
    assert bases.binary_to_hex("10111100") == "BC"
    assert bases.binary_to_hex("1111") == "F"
    assert bases.binary_to_hex("101") == "5"
    assert bases.hex_to_binary("BC") == "10111100"
    assert bases.hex_to_binary("3", bits=8) == "00000011"


@pytest.mark.parametrize("n, text", [
    (0, "00000000"), (1, "00000001"), (127, "01111111"), (-1, "11111111"),
    (-45, "11010011"), (-128, "10000000"),
])
def test_twos_complement_in_eight_bits(n, text):
    assert bases.to_twos_complement(n, 8) == text
    assert bases.from_twos_complement(text) == n


def test_twos_complement_refuses_numbers_out_of_range():
    for n in (128, -129):
        with pytest.raises(ValueError):
            bases.to_twos_complement(n, 8)


@pytest.mark.parametrize("n, text", [(45, "00101101"), (-45, "10101101"), (-127, "11111111"),
                                     (0, "00000000")])
def test_sign_and_magnitude_in_eight_bits(n, text):
    assert bases.to_sign_magnitude(n, 8) == text
    assert bases.from_sign_magnitude(text) == n


def test_sign_and_magnitude_has_a_negative_zero_and_a_smaller_range():
    assert bases.from_sign_magnitude("10000000") == 0
    with pytest.raises(ValueError):
        bases.to_sign_magnitude(-128, 8)


def test_unsigned_addition_reports_the_carry_out_of_the_top_bit():
    total = bases.add_unsigned("11110000", "00100000")
    assert total.result == "00010000"
    assert total.carry_out is True
    assert total.carries == "11000000"  # carries into bits 6 and 7; the one out of bit 7 is carry_out
    small = bases.add_unsigned("00000101", "00000011")
    assert (small.result, small.carry_out, small.carries) == ("00001000", False, "00001110")


def test_twos_complement_addition_reports_overflow():
    over = bases.add_twos_complement("01100100", "01000000")  # 100 + 64 = 164 > 127
    assert over.result == "10100100"
    assert over.overflow is True
    fine = bases.add_twos_complement("11111011", "00000111")  # -5 + 7 = 2
    assert fine.result == "00000010"
    assert fine.overflow is False


def test_twos_complement_subtraction_adds_the_negated_number():
    diff = bases.subtract_twos_complement("00001010", "00001111")  # 10 - 15 = -5
    assert diff.result == "11111011"
    assert diff.overflow is False
    assert bases.subtract_twos_complement("10000000", "00000001").overflow is True  # -128 - 1


def test_addition_needs_equal_widths_and_binary_digits():
    with pytest.raises(ValueError):
        bases.add_unsigned("101", "1")
    with pytest.raises(ValueError):
        bases.add_unsigned("102", "011")


@pytest.mark.parametrize("kind, direction, places, start, end", [
    ("logical", "left", 2, "00010110", "01011000"),
    ("logical", "right", 1, "10010110", "01001011"),
    ("arithmetic", "right", 1, "10010110", "11001011"),
    ("arithmetic", "right", 3, "01110000", "00001110"),
    ("arithmetic", "left", 1, "11000011", "10000110"),
    ("circular", "left", 3, "10010110", "10110100"),
    ("circular", "right", 2, "10010110", "10100101"),
])
def test_shifts(kind, direction, places, start, end):
    assert bases.shift(start, places, direction=direction, kind=kind) == end


def test_unknown_shift_is_refused():
    with pytest.raises(ValueError):
        bases.shift("0101", 1, direction="up")
    with pytest.raises(ValueError):
        bases.shift("0101", 1, kind="sideways")


@pytest.mark.parametrize("op, mask, end", [
    ("AND", "00001111", "00000110"), ("OR", "11110000", "11110110"), ("XOR", "11111111", "01001001"),
])
def test_masks(op, mask, end):
    assert bases.apply_mask("10110110", mask, op) == end


def test_unknown_mask_operation_is_refused():
    with pytest.raises(ValueError):
        bases.apply_mask("1011", "0001", "NAND")


@pytest.mark.parametrize("given, expected, ok", [
    ("0110 1000", "01101000", True), ("01101000", "01101000", True), ("1101000", "01101000", False),
    ("0110_1000", "01101000", True), ("0110100O", "01101000", False), ("", "0", False),
])
def test_a_binary_answer_must_have_every_bit_written(given, expected, ok):
    assert bases.same_bits(given, expected) is ok


@pytest.mark.parametrize("given, expected, ok", [
    ("BC", "BC", True), ("bc", "BC", True), ("0xBC", "BC", True), ("BC₁₆", "BC", True),
    ("0BC", "BC", True), ("CB", "BC", False), ("B C", "BC", True), ("G1", "BC", False),
])
def test_a_hexadecimal_answer_is_read_by_value(given, expected, ok):
    assert bases.same_hex(given, expected) is ok


def test_hexadecimal_and_masks_check_their_input():
    with pytest.raises(ValueError):
        bases.to_hex(-1)
    with pytest.raises(ValueError):
        bases.apply_mask("1011", "01", "AND")
