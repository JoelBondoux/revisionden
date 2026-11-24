"""Verifies maths answers in the question bank. Called by ``pnpm content:validate``.

Reads ``{"checks": [...]}`` as JSON on stdin and writes ``{"results": [...]}`` to stdout.
Each check has an ``id`` and a ``kind``:

- ``solve``: ``equation``, optional ``variable`` (default x), ``solutions``.
- ``value``: ``expression`` and ``answer``; optional ``tolerance`` for rounded answers.
- ``expression``: ``expression`` and ``answer``; optional ``form`` (factorised or expanded).
- ``working``: ``lines`` of a model solution and the ``expected`` final answer.

Run it with ``python -m app.content_check`` from ``services/maths``.
"""

import json
import sys
from typing import Callable, TextIO

from sympy import N

from app.equivalence import are_equivalent, parse, solutions_match
from app.working import check_working


def _solve(check: dict) -> str | None:
    if solutions_match(check["equation"], check["solutions"], check.get("variable", "x")):
        return None
    return f"solutions {check['solutions']} do not solve {check['equation']}"


def _value(check: dict) -> str | None:
    tolerance = check.get("tolerance")
    if tolerance is None:
        ok = are_equivalent(check["expression"], check["answer"])
    else:
        ok = abs(N(parse(check["expression"]) - parse(check["answer"]))) <= tolerance
    return None if ok else f"{check['answer']} is not the value of {check['expression']}"


def _expression(check: dict) -> str | None:
    expected = {"expression": check["expression"], "form": check.get("form")}
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


KINDS: dict[str, Callable[[dict], str | None]] = {
    "solve": _solve,
    "value": _value,
    "expression": _expression,
    "working": _working,
}


def run_check(check: dict) -> dict:
    kind = KINDS.get(check.get("kind", ""))
    if kind is None:
        return {"id": check.get("id"), "ok": False, "error": f"unknown check kind {check.get('kind')!r}"}
    try:
        error = kind(check)
    except (ValueError, KeyError, TypeError) as err:
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
