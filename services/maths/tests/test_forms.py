"""Answer forms: the answer must be the right value AND written in the form the question asks for."""
import pytest

from app.content_check import run_checks
from app.forms import FORMS, in_form
from app.working import check_working


@pytest.mark.parametrize("form, right, wrong", [
    ("index_form", ["2^3 × 3^2 × 5", "2^3*3^2*5", "5 × 3² × 2³", "7", "2^2*3"],
     ["360", "8 × 9 × 5", "2^3 × 45", "2^2 × 2 × 45", "4^2 × 3", "2 × 2 × 2 × 3^2 × 5"]),
    ("standard_form", ["1.5 × 10^11", "1.5*10^11", "1.5x10^11", "6 × 10^-3", "6 × 10⁻³",
                       "9.99 × 10^4", "-2.5 × 10^3"],
     ["150000000000", "15 × 10^10", "0.15 × 10^12", "10^11", "1.5 × 10^1.5", "10 × 10^3"]),
    ("fraction", ["3/11", "27/99", "-4/5", "2"], ["0.272727", "3 / 11 + 0", "1.5"]),
    ("simplest_fraction", ["3/11", "-4/5", "23/33", "2"], ["27/99", "69/99", "4/2", "0.5"]),
    ("improper_fraction", ["49/20", "-7/3", "3/11", "2"], ["98/40", "2 9/20", "2.45", "4/2"]),
])
def test_each_form_accepts_its_writings_and_refuses_others(form, right, wrong):
    for text in right:
        assert in_form(text, form), (form, text)
    for text in wrong:
        assert not in_form(text, form), (form, text)


def test_the_forms_are_the_agreed_names():
    assert set(FORMS) == {"fraction", "simplest_fraction", "improper_fraction", "standard_form",
                          "index_form"}


def test_an_unknown_form_is_refused():
    with pytest.raises(ValueError):
        in_form("3", "decimal")


def test_a_worked_answer_must_be_in_the_asked_form():
    expected = {"expression": "2^3*3^2*5", "form": "index_form"}
    assert check_working(["2^3 × 3^2 × 5"], expected).final_answer_correct is True
    assert check_working(["360"], expected).final_answer_correct is False
    sf = {"expression": "1.5*10^11", "form": "standard_form"}
    assert check_working(["1.5 × 10^11"], sf).final_answer_correct is True
    assert check_working(["150000000000"], sf).final_answer_correct is False


def test_a_numeric_value_check_can_ask_for_a_form():
    checks = [
        {"id": "a", "kind": "value", "expression": "27/99", "answer": "3/11",
         "form": "simplest_fraction"},
        {"id": "b", "kind": "value", "expression": "27/99", "answer": "27/99",
         "form": "simplest_fraction"},
        {"id": "c", "kind": "value", "expression": "27/99", "answer": "27/99", "form": "fraction"},
        {"id": "d", "kind": "value", "expression": "1.5*10^11", "answer": "150000000000",
         "form": "standard_form"},
    ]
    assert [r["ok"] for r in run_checks(checks)] == [True, False, True, False]
    assert "simplest_fraction" in run_checks(checks)[1]["error"]


def test_the_api_accepts_the_new_forms():
    from fastapi.testclient import TestClient
    from app.main import app
    client = TestClient(app)
    body = {"lines": ["360"], "expected": {"expression": "2^3*3^2*5", "form": "index_form"}}
    response = client.post("/check-working", json=body)
    assert response.status_code == 200
    assert response.json()["final_answer_correct"] is False


def test_the_forms_match_the_app_marking_rules_in_packages_core():
    # packages/core/src/answer-format.ts (S2e): a/b needs b >= 2; simplest needs a != 0;
    # standard form allows |n| <= 100 and 1 <= |a| < 10.
    assert not in_form("4/1", "fraction")
    assert not in_form("0/5", "simplest_fraction")
    assert in_form("0", "simplest_fraction")
    assert in_form("-9.5 × 10^(-4)", "standard_form")
    assert not in_form("1 × 10^101", "standard_form")
    assert in_form("1 × 10^100", "standard_form")
    assert in_form("5^3", "index_form")


def test_a_rounded_standard_form_value_is_read_exactly_before_rounding():
    # Codex on train #208: Decimal("6.4*10^8") raised InvalidOperation.
    checks = [
        {"id": "a", "kind": "value", "expression": "6.38*10^8", "answer": "6.4*10^8",
         "form": "standard_form", "significant_figures": 2},
        {"id": "b", "kind": "value", "expression": "6.38*10^8", "answer": "6.3*10^8",
         "form": "standard_form", "significant_figures": 2},
        {"id": "c", "kind": "value", "expression": "6.38*10^8", "answer": "640000000",
         "form": "standard_form", "significant_figures": 2},
        {"id": "d", "kind": "value", "expression": "0.0004567", "answer": "4.57 × 10^-4",
         "form": "standard_form", "significant_figures": 3},
        {"id": "e", "kind": "value", "expression": "6.38*10^8", "answer": "6.4*10^8",
         "significant_figures": 2},
    ]
    results = run_checks(checks)
    assert [r["ok"] for r in results] == [True, False, False, True, True], results
    assert "could not check" not in results[1]["error"]
    assert "standard_form" in results[2]["error"]
