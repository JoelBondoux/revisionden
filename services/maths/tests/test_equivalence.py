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
