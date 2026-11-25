"""Fact proofs for the fact-check stage (decision 0009): new maths engine check kinds."""
import pytest

from app.content_check import run_checks


def ok(check: dict) -> bool:
    [result] = run_checks([{"id": "f", **check}])
    return result["ok"]


def error(check: dict) -> str:
    [result] = run_checks([{"id": "f", **check}])
    assert result["ok"] is False
    return result["error"]


# Graph transformations: the graph of y = <graph> is the image of y = f(x) under <image>.

@pytest.mark.parametrize(
    "graph, image",
    [
        ("f(x) + a", "(x, y + a)"),
        ("f(x - a)", "(x + a, y)"),
        ("f(x + a)", "(x - a, y)"),
        ("-f(x)", "(x, -y)"),
        ("f(-x)", "(-x, y)"),
        ("a f(x)", "(x, a y)"),
        ("f(a x)", "(x/a, y)"),
    ],
)
def test_the_standard_graph_transformations_are_proved(graph, image):
    assert ok({"kind": "transformation", "graph": graph, "image": image})


@pytest.mark.parametrize(
    "graph, image",
    [
        ("f(x - a)", "(x - a, y)"),  # the classic wrong way round
        ("f(x) + a", "(x + a, y)"),  # up, not right
        ("f(-x)", "(x, -y)"),  # y-axis, not x-axis
        ("f(a x)", "(a x, y)"),  # stretch factor 1/a, not a
    ],
)
def test_a_wrong_transformation_is_refused(graph, image):
    assert "is not the image" in error({"kind": "transformation", "graph": graph, "image": image})


def test_a_transformation_needs_f_and_a_point_pair():
    assert "could not check" in error({"kind": "transformation", "graph": "x + a", "image": "(x, y)"})
    assert "could not check" in error({"kind": "transformation", "graph": "f(x)", "image": "x"})


# Inequalities: given these, the conclusion always holds (sampled and proved symbolically).

def test_multiplying_or_dividing_by_a_negative_reverses_the_inequality():
    given = ["a < b", "c < 0"]
    assert ok({"kind": "implication", "given": given, "then": "a c > b c"})
    assert ok({"kind": "implication", "given": given, "then": "a/c > b/c"})


def test_keeping_the_sign_when_multiplying_by_a_negative_is_refused():
    message = error({"kind": "implication", "given": ["a < b", "c < 0"], "then": "a c < b c"})
    assert "counterexample" in message


def test_multiplying_by_a_positive_keeps_the_inequality():
    assert ok({"kind": "implication", "given": ["a < b", "c > 0"], "then": "a c < b c"})
    assert ok({"kind": "implication", "given": ["a <= b", "c > 0"], "then": "a c <= b c"})


def test_an_implication_that_is_only_true_on_samples_is_not_proved():
    # x > 0 does not give x^2 > x (fails for 0 < x < 1); sampling finds it.
    assert "counterexample" in error({"kind": "implication", "given": ["x > 0"], "then": "x^2 > x"})


def test_an_implication_the_symbolic_step_cannot_settle_is_not_proved():
    # True (x > 1 gives x^3 > x), but beyond the substitution proof: never passed on samples alone.
    message = error({"kind": "implication", "given": ["x > 1"], "then": "x^3 > x"})
    assert "could not prove" in message


# Root location by sign change (intermediate value theorem on a continuous function).

def test_a_sign_change_on_a_continuous_function_locates_a_root():
    assert ok({"kind": "sign_change", "function": "x^3 - x - 1", "interval": ["1", "2"]})


def test_no_sign_change_is_refused():
    assert "same sign" in error({"kind": "sign_change", "function": "x^2 + 1", "interval": ["-1", "1"]})


def test_a_discontinuity_is_refused_even_with_a_sign_change():
    message = error({"kind": "sign_change", "function": "1/x", "interval": ["-1", "1"]})
    assert "not continuous" in message


# Parallel lines.

def test_parallel_exactly_when_the_gradients_are_equal_is_proved_symbolically():
    assert ok({"kind": "parallel", "lines": ["y = m x + c", "y = n x + d"]})


def test_numeric_lines_are_parallel_or_not_as_claimed():
    lines = ["y = 3x + 1", "2y = 6x - 5"]
    assert ok({"kind": "parallel", "lines": lines, "parallel": True})
    assert "are parallel" in error({"kind": "parallel", "lines": lines, "parallel": False})
    assert ok({"kind": "parallel", "lines": ["y = 3x + 1", "y = 2x"], "parallel": False})
    assert ok({"kind": "parallel", "lines": ["x = 2", "x = -1"], "parallel": True})


# Exact trigonometric values.

@pytest.mark.parametrize(
    "function, degrees, value",
    [
        ("tan", 90, "undefined"),
        ("sin", 30, "1/2"),
        ("cos", 60, "1/2"),
        ("tan", 45, "1"),
        ("sin", 60, "sqrt(3)/2"),
        ("tan", 30, "1/sqrt(3)"),
        ("cos", 90, "0"),
    ],
)
def test_exact_trig_values_are_checked(function, degrees, value):
    assert ok({"kind": "trig_value", "function": function, "degrees": degrees, "value": value})


def test_a_wrong_exact_trig_value_is_refused():
    assert "is not" in error({"kind": "trig_value", "function": "sin", "degrees": 60, "value": "1/2"})
    assert "is not" in error({"kind": "trig_value", "function": "sin", "degrees": 90,
                              "value": "undefined"})


# What the gradient or area of a graph means, by units.

@pytest.mark.parametrize(
    "y, x, measure, meaning",
    [
        ("distance", "time", "gradient", "speed"),
        ("velocity", "time", "gradient", "acceleration"),
        ("speed", "time", "area", "distance"),
        ("velocity", "time", "area", "displacement"),
    ],
)
def test_the_meaning_of_a_travel_graph_gradient_or_area_is_checked_by_units(y, x, measure, meaning):
    assert ok({"kind": "graph_measure", "y": y, "x": x, "measure": measure, "is": meaning})


def test_a_wrong_travel_graph_meaning_is_refused():
    check = {"kind": "graph_measure", "y": "velocity", "x": "time", "measure": "gradient",
             "is": "distance"}
    assert "has units" in error(check)
    assert "could not check" in error({**check, "y": "happiness"})


# Malformed fact checks are refused with a reason, never passed.

@pytest.mark.parametrize(
    "check",
    [
        {"kind": "transformation", "graph": "f(x)", "image": "(x y)"},
        {"kind": "implication", "given": ["a = b"], "then": "a > b"},
        {"kind": "implication", "given": ["x > 20"], "then": "x > 1"},  # samples never satisfy it
        {"kind": "parallel", "lines": ["y = 2x", "y + x"]},
        {"kind": "parallel", "lines": ["y^2 = x", "y = x"], "parallel": True},
        {"kind": "parallel", "lines": ["y = m x", "y = m x + 1"]},  # same gradient letter
        {"kind": "trig_value", "function": "sec", "degrees": 60, "value": "2"},
        {"kind": "graph_measure", "y": "distance", "x": "time", "measure": "slope", "is": "speed"},
    ],
)
def test_a_malformed_fact_check_cannot_pass(check):
    assert "could not check" in error(check)


def test_a_transformation_that_misses_part_of_the_graph_is_refused():
    # (x, y) -> (x^2, y) only reaches x >= 0, so it is not a transformation of the whole graph.
    message = error({"kind": "transformation", "graph": "f(sqrt(x))", "image": "(x^2, y)"})
    assert "not the image" in message or "does not reach every x" in message


def test_an_implication_with_a_division_by_zero_sample_still_finds_the_counterexample():
    assert "counterexample" in error({"kind": "implication", "given": ["a < b"],
                                      "then": "a/c < b/c"})


def test_givens_the_symbolic_step_cannot_rewrite_are_not_proved():
    assert "could not prove" in error({"kind": "implication", "given": ["a + b > 0", "a - b > 0"],
                                       "then": "a > 0"})


def test_the_symbolic_parallel_proof_needs_lines_that_meet_for_different_gradients():
    message = error({"kind": "parallel", "lines": ["y = m x + c", "y = n x + c + (m - n) x"]})
    assert "do not meet" in message or "could not check" in message
