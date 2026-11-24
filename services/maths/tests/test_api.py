from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_equivalent_endpoint():
    res = client.post("/equivalent", json={"a": "2*(x+3)", "b": "2*x+6"})
    assert res.status_code == 200
    assert res.json() == {"equivalent": True}


def test_bad_input_is_400():
    res = client.post("/equivalent", json={"a": "__import__('os')", "b": "1"})
    assert res.status_code == 400


def test_check_working_reports_the_first_wrong_line_and_final_answer():
    res = client.post(
        "/check-working",
        json={
            "lines": ["2x + 3 = 7", "2x = 7 + 3", "x = 5"],
            "expected": {"solutions": ["2"]},
        },
    )
    assert res.status_code == 200
    assert res.json() == {"first_wrong_line": 1, "final_answer_correct": False}


def test_check_working_without_an_expected_answer_leaves_correctness_unknown():
    res = client.post("/check-working", json={"lines": ["x^2 + 5x + 6", "(x + 2)(x + 3)"]})
    assert res.json() == {"first_wrong_line": None, "final_answer_correct": None}


def test_check_working_rejects_unsafe_lines_with_400():
    res = client.post("/check-working", json={"lines": ["x = 1", "exit() = 1"]})
    assert res.status_code == 400


def test_check_working_rejects_an_unknown_answer_form_with_422():
    res = client.post(
        "/check-working",
        json={"lines": ["x"], "expected": {"expression": "x", "form": "tidy"}},
    )
    assert res.status_code == 422


def test_check_working_needs_exactly_one_kind_of_expected_answer():
    res = client.post(
        "/check-working",
        json={"lines": ["x"], "expected": {"expression": "x", "solutions": ["1"]}},
    )
    assert res.status_code == 422
    res = client.post("/check-working", json={"lines": ["x"], "expected": {}})
    assert res.status_code == 422


def test_solutions_endpoint_checks_answers_and_rejects_bad_input():
    ok = client.post("/solutions", json={"expression": "x^2 = 4", "answers": ["2", "-2"]})
    assert ok.json() == {"correct": True}
    bad = client.post("/solutions", json={"expression": "exit()", "answers": ["1"]})
    assert bad.status_code == 400
