"""Red/green tests for the maths engine: checks a student's line of working exactly."""
import pytest

from app.equivalence import are_equivalent, solutions_match


@pytest.mark.parametrize(
    "a,b",
    [
        ("3*x**2 + 5*x - 2", "(3*x - 1)*(x + 2)"),
        ("2*(x + 3)", "2*x + 6"),
        ("x/2 + x/2", "x"),
    ],
)
def test_equivalent_expressions(a, b):
    assert are_equivalent(a, b)


@pytest.mark.parametrize(
    "a,b",
    [
        ("3*x**2 + 5*x - 2", "(3*x + 1)*(x - 2)"),
        ("2*(x + 3)", "2*x + 3"),
    ],
)
def test_non_equivalent_expressions(a, b):
    assert not are_equivalent(a, b)


def test_solution_sets_compare_regardless_of_order():
    assert solutions_match("3*x**2 + 5*x - 2", ["-2", "1/3"])
    assert not solutions_match("3*x**2 + 5*x - 2", ["-2", "-1/3"])


def test_rejects_unsafe_input():
    with pytest.raises(ValueError):
        are_equivalent("__import__('os').system('ls')", "1")


def test_implicit_multiplication_is_understood():
    assert are_equivalent("3x^2 + 5x - 2", "(3x - 1)(x + 2)")


def test_square_roots_and_pi_are_allowed():
    assert are_equivalent("sqrt(8)", "2sqrt(2)")
    assert are_equivalent("2pi", "pi + pi")


@pytest.mark.parametrize(
    "text",
    [
        "exit()",
        "globals()",
        "getattr(x, 'a')",
        "Symbol('y')",
        "ab + 1",
        "x" * 201,
        "9^9^9^9",
        "x^(10^6)",
        "1e999999",
        "",
        "   ",
        "x +",
    ],
)
def test_rejects_unsafe_or_unsupported_input(text):
    with pytest.raises(ValueError):
        are_equivalent(text, "1")


def test_solutions_can_be_given_as_an_equation():
    assert solutions_match("3x^2 + 5x = 2", ["1/3", "-2"])
