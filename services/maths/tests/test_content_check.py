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
