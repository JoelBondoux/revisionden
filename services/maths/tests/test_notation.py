"""Everyday notation (×, superscripts, the unicode minus, thousands separators) is understood."""
import pytest

from app.content_check import run_checks
from app.equivalence import are_equivalent, parse
from app.notation import normalise
from app.working import check_working


@pytest.mark.parametrize("written, read", [
    ("2^3 × 3^2 × 5", "2^3 * 3^2 * 5"),
    ("1.5 × 10^11", "1.5 * 10^11"),
    ("2³ × 3²", "2^3 * 3^2"),
    ("10⁻³", "10^-3"),
    ("−7", "-7"),
    ("4 – 9", "4 - 9"),
    ("3 · 4 ⋅ 5", "3 * 4 * 5"),
    ("30,000", "30000"),
    ("1,234,567", "1234567"),
    ("38 700", "38700"),
    ("38 700", "38700"),
    ("38 700", "38700"),
    ("1.5x10^11", "1.5*10^11"),
    ("1.5 X 10^11", "1.5*10^11"),
    ("6 x 4", "6*4"),
])
def test_everyday_notation_is_rewritten_for_the_parser(written, read):
    assert normalise(written) == read


@pytest.mark.parametrize("left_alone", [
    "3x + 2", "2x", "x^2 - 3x", "x = 3, x = -4", "3,5", "30,00", "1,2345", "x5", "2 x y",
])
def test_letters_lists_and_digits_not_in_groups_of_three_are_left_alone(left_alone):
    assert normalise(left_alone) == left_alone


def test_x_between_numbers_is_a_times_sign_not_the_letter_x():
    assert parse("1.5x10^11", exact=True) == parse("150000000000")
    assert parse("3x", exact=True).free_symbols


@pytest.mark.parametrize("answer, expression", [
    ("2^3 × 3^2 × 5", "2^3*3^2*5"),
    ("1.5 × 10^11", "1.5*10^11"),
    ("2³ × 3²", "72"),
    ("−7", "-7"),
    ("30,000", "3*10^4"),
    ("1.5x10^11", "1.5*10^11"),
])
def test_worked_answers_in_everyday_notation_are_marked_right(answer, expression):
    assert check_working([answer], {"expression": expression}).final_answer_correct is True


def test_a_solved_value_with_a_unicode_minus_is_right():
    assert check_working(["x = −7"], {"solutions": ["-7"]}).final_answer_correct is True


def test_working_lines_in_everyday_notation_follow_each_other():
    result = check_working(["(3 × 10^4) × (5 × 10^6)", "15 × 10^10", "1.5 × 10¹¹"],
                           {"expression": "1.5*10^11"})
    assert result.first_wrong_line is None and result.final_answer_correct is True


def test_equivalence_and_content_checks_read_everyday_notation():
    assert are_equivalent("−7", "-7")
    [result] = run_checks([{"id": "a", "kind": "value", "expression": "3*10^4",
                            "answer": "30,000"}])
    assert result["ok"] is True


def test_a_comma_that_is_not_a_thousands_separator_is_still_refused():
    with pytest.raises(ValueError):
        parse("30,00")
