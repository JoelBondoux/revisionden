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
])
def test_each_form_accepts_its_writings_and_refuses_others(form, right, wrong):
    for text in right:
        assert in_form(text, form), (form, text)
    for text in wrong:
        assert not in_form(text, form), (form, text)


def test_the_forms_are_the_agreed_names():
    assert set(FORMS) == {"fraction", "simplest_fraction", "standard_form", "index_form"}


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
