"""Verifies maths answers in the question bank. Called by ``pnpm content:validate``.

Reads ``{"checks": [...]}`` as JSON on stdin and writes ``{"results": [...]}`` to stdout.
Each check has an ``id`` and a ``kind``:

- ``solve``: ``equation``, optional ``variable`` (default x), ``solutions``.
- ``value``: ``expression`` and ``answer``; optional ``tolerance``, or ``decimal_places`` or
  ``significant_figures`` when the question asks for rounding (the answer must be the value
  rounded half up to that accuracy); optional ``form`` that the answer must be written in
  (``app/forms.py``: fraction, simplest_fraction, standard_form, index_form).
- ``expression``: ``expression`` and ``answer``; optional ``form`` (factorised, expanded or an
  answer form from ``app/forms.py``) and ``subject`` (an answer may read ``<subject> = ...``).
- ``working``: ``lines`` of a model solution and the ``expected`` final answer.
- ``formula``: ``expected`` and ``given`` formulas (``x = ...``, ``±`` allowed), for flashcards.
- ``identity``: an ``equation`` that must hold for every value of its letters (fact checks).
- Fact proofs (``app/facts.py``): ``transformation``, ``implication``, ``sign_change``,
  ``parallel``, ``trig_value`` and ``graph_measure``.

Run it with ``python -m app.content_check`` from ``services/maths``.
"""

import json
import sys
from decimal import ROUND_HALF_UP, Decimal
from typing import Callable, TextIO

from sympy import N, Rational, simplify

from app import facts
from app.equivalence import are_equivalent, parse, parse_equation, solutions_match
from app.forms import in_form
from app.formula import formulas_match
from app.working import check_working


def _solve(check: dict) -> str | None:
    if solutions_match(check["equation"], check["solutions"], check.get("variable", "x")):
        return None
    return f"solutions {check['solutions']} do not solve {check['equation']}"


def _rounded(value, check: dict) -> Decimal:
    """The value rounded half up to the check's decimal places or significant figures."""
    exact = Decimal(str(N(value, 50)))
    places = check.get("decimal_places")
    if places is None:
        figures = check["significant_figures"]
        places = figures - 1 - exact.adjusted() if exact else figures - 1
    return exact.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)


def _exact_decimal(value) -> Decimal:
    """A rational value as a Decimal (exact for any terminating decimal, as rounded answers are)."""
    num, den = (int(v) for v in Rational(value).as_numer_denom())
    return Decimal(num) / Decimal(den)


def _value(check: dict) -> str | None:
    tolerance = check.get("tolerance")
    if "decimal_places" in check or "significant_figures" in check:
        # The answer may be an expression (6.4*10^8): read it exactly, then compare as a decimal.
        ok = _rounded(parse(check["expression"], exact=True), check) == _exact_decimal(
            parse(check["answer"], exact=True))
    elif tolerance is None:
        ok = are_equivalent(check["expression"], check["answer"])
    else:
        ok = abs(N(parse(check["expression"]) - parse(check["answer"]))) <= tolerance
    if not ok:
        return f"{check['answer']} is not the value of {check['expression']}"
    form = check.get("form")
    if form and not in_form(check["answer"], form):
        return f"{check['answer']} is not written as {form}"
    return None


def _expression(check: dict) -> str | None:
    expected = {"expression": check["expression"], "form": check.get("form"),
                "subject": check.get("subject")}
    if check_working([check["answer"]], expected).final_answer_correct:
        return None
    return f"{check['answer']} is not {check['expression']} in the required form"


def _working(check: dict) -> str | None:
    result = check_working(check["lines"], check["expected"])
    if result.first_wrong_line is not None:
        return f"model solution goes wrong at line {result.first_wrong_line + 1}"
    if not result.final_answer_correct:
        return "model solution does not reach the expected final answer"
    return None


def _formula(check: dict) -> str | None:
    if formulas_match(check["expected"], check["given"]):
        return None
    return f"{check['given']} is not the same formula as {check['expected']}"


def _identity(check: dict) -> str | None:
    if "=" not in check["equation"]:
        raise ValueError("an identity needs one = sign")
    if simplify(parse_equation(check["equation"])) == 0:
        return None
    return f"{check['equation']} is not true for every value"


KINDS: dict[str, Callable[[dict], str | None]] = {
    "solve": _solve,
    "value": _value,
    "expression": _expression,
    "working": _working,
    "formula": _formula,
    "identity": _identity,
    **facts.KINDS,
}


def run_check(check: dict) -> dict:
    kind = KINDS.get(check.get("kind", ""))
    if kind is None:
        return {"id": check.get("id"), "ok": False, "error": f"unknown check kind {check.get('kind')!r}"}
    try:
        error = kind(check)
    except (ValueError, KeyError, TypeError, ArithmeticError) as err:
        error = f"could not check: {err}"
    return {"id": check.get("id"), "ok": True} if error is None else {
        "id": check.get("id"), "ok": False, "error": error}


def run_checks(checks: list[dict]) -> list[dict]:
    return [run_check(check) for check in checks]


def main(stdin: TextIO = sys.stdin, stdout: TextIO = sys.stdout) -> int:
    try:
        checks = json.load(stdin)["checks"]
    except (json.JSONDecodeError, KeyError, TypeError) as err:
        json.dump({"error": f"expected {{\"checks\": [...]}} on stdin: {err}"}, stdout)
        return 2
    json.dump({"results": run_checks(checks)}, stdout)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())
