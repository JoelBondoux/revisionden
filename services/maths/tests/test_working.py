"""Working-lines checker: finds the first line that does not follow from the one before."""
import pytest

from app.working import check_working


def test_a_correct_linear_chain_has_no_wrong_line():
    result = check_working(["2x + 3 = 7", "2x = 4", "x = 2"])
    assert result.first_wrong_line is None


def test_a_sign_slip_is_reported_on_the_line_where_it_happens():
    result = check_working(["2x + 3 = 7", "2x = 7 + 3", "x = 5"])
    assert result.first_wrong_line == 1


def test_a_sign_slip_when_expanding_a_negative_bracket_is_caught():
    result = check_working(["5 - 2(x - 3) = 1", "5 - 2x - 6 = 1", "-2x = 2", "x = -1"])
    assert result.first_wrong_line == 1


def test_a_correct_factorisation_passes():
    result = check_working(["x^2 + 5x + 6", "(x + 2)(x + 3)"])
    assert result.first_wrong_line is None


def test_a_wrong_factorisation_is_caught():
    result = check_working(["x^2 + 5x + 6", "(x + 1)(x + 6)"])
    assert result.first_wrong_line == 1


def test_a_wrong_expansion_of_a_square_is_caught():
    result = check_working(["(x + 3)^2", "x^2 + 9"])
    assert result.first_wrong_line == 1


def test_a_correct_expansion_passes():
    result = check_working(["(x + 3)^2", "(x + 3)(x + 3)", "x^2 + 6x + 9"])
    assert result.first_wrong_line is None


def test_fraction_steps_that_are_right_pass():
    result = check_working(["x/2 + x/3 = 5", "3x/6 + 2x/6 = 5", "5x/6 = 5", "5x = 30", "x = 6"])
    assert result.first_wrong_line is None


def test_adding_fractions_by_adding_denominators_is_caught():
    result = check_working(["x/2 + x/3 = 5", "2x/5 = 5", "x = 25/2"])
    assert result.first_wrong_line == 1


def test_a_quadratic_solved_by_factorising_with_two_roots_passes():
    result = check_working(
        ["3x^2 + 5x - 2 = 0", "(3x - 1)(x + 2) = 0", "x = 1/3 or x = -2"],
        expected={"solutions": ["1/3", "-2"]},
    )
    assert result.first_wrong_line is None
    assert result.final_answer_correct is True


def test_losing_a_root_when_square_rooting_is_caught():
    result = check_working(["x^2 = 9", "x = 3"])
    assert result.first_wrong_line == 1


def test_rearranging_a_formula_with_two_letters_passes():
    result = check_working(["y = 2x + 3", "y - 3 = 2x", "x = (y - 3)/2"])
    assert result.first_wrong_line is None


def test_a_wrong_rearrangement_is_caught():
    result = check_working(["y = 2x + 3", "y + 3 = 2x"])
    assert result.first_wrong_line == 1


def test_switching_from_an_expression_to_an_equation_is_reported():
    result = check_working(["x^2 + 5x + 6", "x = 2"])
    assert result.first_wrong_line == 1


def test_final_answer_is_wrong_when_the_chain_ends_on_the_wrong_value():
    result = check_working(["2x + 3 = 7", "2x = 10", "x = 5"], expected={"solutions": ["2"]})
    assert result.first_wrong_line == 1
    assert result.final_answer_correct is False


def test_final_answer_is_not_correct_until_the_unknown_is_on_its_own():
    result = check_working(["2x + 3 = 7", "2x = 4"], expected={"solutions": ["2"]})
    assert result.first_wrong_line is None
    assert result.final_answer_correct is False


def test_final_expression_is_checked_against_the_expected_expression():
    result = check_working(["x^2 + 5x + 6", "(x + 2)(x + 3)"], expected={"expression": "(x+3)(x+2)"})
    assert result.final_answer_correct is True


def test_an_unfactorised_final_line_is_not_accepted_when_factorised_form_is_required():
    result = check_working(
        ["x^2 + 5x + 6", "x^2 + 2x + 3x + 6"],
        expected={"expression": "(x+2)(x+3)", "form": "factorised"},
    )
    assert result.first_wrong_line is None
    assert result.final_answer_correct is False


def test_an_unexpanded_final_line_is_not_accepted_when_expanded_form_is_required():
    result = check_working(
        ["(x + 3)^2", "(x + 3)(x + 3)"],
        expected={"expression": "x^2 + 6x + 9", "form": "expanded"},
    )
    assert result.final_answer_correct is False
    result = check_working(
        ["(x + 3)^2", "x^2 + 6x + 9"],
        expected={"expression": "x^2 + 6x + 9", "form": "expanded"},
    )
    assert result.final_answer_correct is True


def test_a_factorised_final_line_is_accepted_when_factorised_form_is_required():
    result = check_working(
        ["x^2 + 5x + 6", "(x + 2)(x + 3)"],
        expected={"expression": "(x+2)(x+3)", "form": "factorised"},
    )
    assert result.final_answer_correct is True


def test_final_answer_correctness_is_unknown_without_an_expected_answer():
    assert check_working(["2x = 4", "x = 2"]).final_answer_correct is None


def test_an_expected_expression_does_not_match_an_equation_line():
    result = check_working(["2x = 4", "x = 2"], expected={"expression": "2"})
    assert result.final_answer_correct is False


def test_expected_solutions_do_not_match_an_expression_line():
    result = check_working(["2 + 2", "4"], expected={"solutions": ["4"]})
    assert result.final_answer_correct is False


def test_a_final_line_stating_the_declared_subject_is_the_answer():
    expected = {"expression": "(v - u)/a", "subject": "t"}
    result = check_working(["v = u + a t", "a t = v - u", "t = (v - u)/a"], expected=expected)
    assert result.first_wrong_line is None
    assert result.final_answer_correct is True


def test_with_a_declared_subject_a_step_may_not_divide_by_the_subject_itself():
    result = check_working(["a t = v - u", "a = (v - u)/t"],
                           expected={"expression": "(v - u)/a", "subject": "t"})
    assert result.first_wrong_line == 1  # divides by t, so it could lose t = 0
    result = check_working(["t - 1 = 0", "t^2 - t = 0"],
                           expected={"expression": "1", "subject": "t"})
    assert result.first_wrong_line == 1


def test_without_a_subject_dividing_by_a_letter_still_does_not_follow():
    assert check_working(["a t = v - u", "t = (v - u)/a"]).first_wrong_line == 1


def test_a_final_line_stating_a_different_letter_is_not_the_answer():
    result = check_working(["a t = v - u", "u = v - a t"],
                           expected={"expression": "v - a t", "subject": "t"})
    assert result.final_answer_correct is False


def test_without_a_declared_subject_an_equation_line_is_still_not_an_expression_answer():
    result = check_working(["a t = v - u", "t = (v - u)/a"], expected={"expression": "(v - u)/a"})
    assert result.final_answer_correct is False


def test_an_inverse_function_answer_follows_from_the_line_that_solves_for_it():
    expected = {"expression": "(x + 3)/2", "subject": "f^-1(x)"}
    result = check_working(["y = (x + 3)/2", "f^-1(x) = (x + 3)/2"], expected=expected)
    assert result.first_wrong_line is None
    assert result.final_answer_correct is True


def test_an_inverse_function_line_with_a_slip_is_caught():
    expected = {"expression": "(x + 3)/2", "subject": "f^-1(x)"}
    result = check_working(["y = (x + 3)/2", "f^-1(x) = (x - 3)/2"], expected=expected)
    assert result.first_wrong_line == 1
    assert result.final_answer_correct is False


def test_at_least_one_line_is_needed():
    with pytest.raises(ValueError):
        check_working([])


def test_too_many_lines_are_rejected():
    with pytest.raises(ValueError):
        check_working(["x = 1"] * 51)


@pytest.mark.parametrize(
    "line",
    [
        "__import__('os').system('ls') = 1",
        "exit() = 1",
        "x = = 2",
        "x == 2",
        "",
    ],
)
def test_unsafe_or_malformed_lines_are_rejected(line):
    with pytest.raises(ValueError):
        check_working(["x = 2", line])


def test_a_solved_value_may_be_in_other_letters():
    result = check_working(["x + a = 3a", "x = 2a"], expected={"solutions": ["2a"]})
    assert result.final_answer_correct is True
    result = check_working(["x + a = 3a", "x = 2a"], expected={"solutions": ["3a"]})
    assert result.final_answer_correct is False


def test_a_solved_value_never_contains_the_unknown_itself():
    result = check_working(["2x = x + a", "x = (x + a)/2"], expected={"solutions": ["a"]})
    assert result.final_answer_correct is False


def test_a_letter_answer_may_be_written_either_way_round():
    for final in ("a = x", "x = a"):
        result = check_working(["x + a = 2a", final], expected={"solutions": ["a"]})
        assert result.final_answer_correct is True, final
