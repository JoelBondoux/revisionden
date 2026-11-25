"""The content checker: verifies maths answers in the question bank (used by content:validate)."""
import io
import json

from app.content_check import main, run_checks


def test_a_correct_solve_check_passes():
    [result] = run_checks(
        [{"id": "q1", "kind": "solve", "equation": "3x^2 + 5x - 2 = 0", "variable": "x",
          "solutions": ["1/3", "-2"]}]
    )
    assert result == {"id": "q1", "ok": True}


def test_a_wrong_solve_check_fails_with_a_reason():
    [result] = run_checks(
        [{"id": "q1", "kind": "solve", "equation": "x^2 = 4", "solutions": ["2"]}]
    )
    assert result["ok"] is False
    assert "solutions" in result["error"]


def test_an_exact_value_check_uses_equivalence():
    results = run_checks(
        [
            {"id": "a", "kind": "value", "expression": "3/4 * 120", "answer": "90"},
            {"id": "b", "kind": "value", "expression": "3/4 * 120", "answer": "91"},
        ]
    )
    assert [r["ok"] for r in results] == [True, False]


def test_a_rounded_value_check_uses_the_tolerance():
    results = run_checks(
        [
            {"id": "a", "kind": "value", "expression": "pi * 3^2", "answer": "28.27",
             "tolerance": 0.005},
            {"id": "b", "kind": "value", "expression": "pi * 3^2", "answer": "28.3",
             "tolerance": 0.005},
        ]
    )
    assert [r["ok"] for r in results] == [True, False]


def test_an_expression_check_can_require_a_form():
    results = run_checks(
        [
            {"id": "a", "kind": "expression", "expression": "x^2 + 5x + 6",
             "answer": "(x + 2)(x + 3)", "form": "factorised"},
            {"id": "b", "kind": "expression", "expression": "x^2 + 5x + 6",
             "answer": "x^2 + 5x + 6", "form": "factorised"},
        ]
    )
    assert [r["ok"] for r in results] == [True, False]


def test_a_model_solution_must_be_a_correct_chain_of_working():
    results = run_checks(
        [
            {"id": "a", "kind": "working", "lines": ["2x + 3 = 7", "2x = 4", "x = 2"],
             "expected": {"solutions": ["2"]}},
            {"id": "b", "kind": "working", "lines": ["2x + 3 = 7", "2x = 10", "x = 5"],
             "expected": {"solutions": ["5"]}},
        ]
    )
    assert results[0] == {"id": "a", "ok": True}
    assert results[1]["ok"] is False
    assert "line 2" in results[1]["error"]


def test_a_model_solution_that_stops_early_fails():
    [result] = run_checks(
        [{"id": "a", "kind": "working", "lines": ["2x + 3 = 7", "2x = 4"],
          "expected": {"solutions": ["2"]}}]
    )
    assert result["ok"] is False
    assert "final answer" in result["error"]


def test_unreadable_maths_and_unknown_kinds_fail_without_crashing():
    results = run_checks(
        [
            {"id": "a", "kind": "value", "expression": "exit()", "answer": "1"},
            {"id": "b", "kind": "guess"},
        ]
    )
    assert [r["ok"] for r in results] == [False, False]
    assert "unknown check kind" in results[1]["error"]


def test_main_reads_checks_from_stdin_and_writes_results_to_stdout():
    stdin = io.StringIO(json.dumps({"checks": [
        {"id": "a", "kind": "value", "expression": "2 + 2", "answer": "4"}
    ]}))
    stdout = io.StringIO()
    assert main(stdin, stdout) == 0
    assert json.loads(stdout.getvalue()) == {"results": [{"id": "a", "ok": True}]}


def test_main_returns_an_error_code_for_bad_json():
    stdout = io.StringIO()
    assert main(io.StringIO("not json"), stdout) == 2
    assert "error" in json.loads(stdout.getvalue())


QUADRATIC = "x = (-b +- sqrt(b^2 - 4ac)) / (2a)"


def test_a_formula_check_accepts_the_same_formula_written_another_way():
    given = [
        "x = (-b ± √(b² - 4ac)) / (2a)",
        "x = [-b ± sqrt(b^2 - 4*a*c)] / (2*a)",
        "x = (-b - sqrt(b^2 - 4ac)) / (2a) or (-b + sqrt(b^2 - 4ac)) / (2a)",
    ]
    results = run_checks(
        [{"id": str(i), "kind": "formula", "expected": QUADRATIC, "given": g}
         for i, g in enumerate(given)]
    )
    assert [r["ok"] for r in results] == [True, True, True]


def test_a_formula_check_rejects_a_different_formula():
    given = [
        "x = (-b + sqrt(b^2 - 4ac)) / (2a)",  # only one of the two solutions
        "x = (-b +- sqrt(b^2 + 4ac)) / (2a)",  # wrong sign under the root
        "y = (-b +- sqrt(b^2 - 4ac)) / (2a)",  # a different subject
        "x = (-b +- sqrt(b^2 - 4ac)) / 2a",  # strictly this divides by 2, then times a
    ]
    results = run_checks(
        [{"id": str(i), "kind": "formula", "expected": QUADRATIC, "given": g}
         for i, g in enumerate(given)]
    )
    assert [r["ok"] for r in results] == [False, False, False, False]
    assert all("not the same formula" in r["error"] for r in results)


def test_a_formula_check_reports_text_it_cannot_read():
    [result] = run_checks(
        [{"id": "q", "kind": "formula", "expected": QUADRATIC, "given": "the quadratic formula"}]
    )
    assert result["ok"] is False


def test_a_formula_check_accepts_the_right_hand_side_alone():
    results = run_checks(
        [
            {"id": "a", "kind": "formula", "expected": QUADRATIC,
             "given": "(-b +- sqrt(b^2 - 4*a*c)) / (2*a)"},
            {"id": "b", "kind": "formula", "expected": QUADRATIC,
             "given": "(-b + sqrt(b^2 - 4*a*c)) / (2*a)"},
        ]
    )
    assert [r["ok"] for r in results] == [True, False]


def test_a_formula_check_needs_a_subject_in_the_expected_formula():
    [result] = run_checks([{"id": "q", "kind": "formula", "expected": "2a", "given": "2a"}])
    assert result["ok"] is False
    assert "subject" in result["error"]


def test_a_formula_check_accepts_the_subject_repeated_in_each_branch():
    results = run_checks(
        [
            {"id": "a", "kind": "formula", "expected": QUADRATIC,
             "given": "x = (-b + sqrt(b^2 - 4ac))/(2a) or x = (-b - sqrt(b^2 - 4ac))/(2a)"},
            {"id": "b", "kind": "formula", "expected": QUADRATIC,
             "given": "x = (-b + sqrt(b^2 - 4ac))/(2a) or y = (-b - sqrt(b^2 - 4ac))/(2a)"},
        ]
    )
    assert [r["ok"] for r in results] == [True, False]


def test_an_identity_check_proves_a_statement_true_for_every_value():
    results = run_checks(
        [
            {"id": "a", "kind": "identity", "equation": "(a + b)^2 = a^2 + 2*a*b + b^2"},
            {"id": "b", "kind": "identity", "equation": "m * (-1/m) = -1"},
            {"id": "c", "kind": "identity", "equation": "(a + b)^2 = a^2 + b^2"},
        ]
    )
    assert [r["ok"] for r in results] == [True, True, False]
    assert "not true for every value" in results[2]["error"]


def test_an_identity_check_needs_one_equals_sign():
    [result] = run_checks([{"id": "q", "kind": "identity", "equation": "a + b"}])
    assert result["ok"] is False
