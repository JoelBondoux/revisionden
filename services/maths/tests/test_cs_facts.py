"""CS engine fact proofs for the fact-check stage (decision 0009 (b); lead ruling 2026-11-27).

Each kind is proved by code, with no AI. It is paired with a third provider's blind statement in
step 4b, never used on its own.
"""
import pytest

from app.content_check import run_check


def ok(check):
    return run_check({"id": "f", **check})


@pytest.mark.parametrize("expression, value, proved", [
    ("29 - (-54)", 83, True), ("176 DIV 16", 11, True), ("176 MOD 16", 0, True),
    ("-128 + 12", -116, True), ("11 * 16 + 0", 176, True), ("2^7", 128, True),
    ("29 - (-54)", 25, False),
])
def test_integer_arithmetic(expression, value, proved):
    assert ok({"kind": "cs_arithmetic", "expression": expression, "value": value})["ok"] is proved


@pytest.mark.parametrize("expression", ["29 - x", "1 / 2", "__import__('os')", "2 ** 3", ""])
def test_integer_arithmetic_reads_only_whole_numbers_and_operators(expression):
    result = ok({"kind": "cs_arithmetic", "expression": expression, "value": 0})
    assert result["ok"] is False and result["error"]


@pytest.mark.parametrize("value, base_from, base_to, result, proved", [
    ("176", 10, 16, "B0", True), ("BC", 16, 10, "188", True), ("10111100", 2, 16, "BC", True),
    ("3F", 16, 2, "111111", True), ("66", 10, 2, "1000010", True), ("BC", 16, 10, "187", False),
    ("1012", 2, 10, "5", False),
])
def test_base_conversion(value, base_from, base_to, result, proved):
    check = {"kind": "cs_base", "value": value, "from_base": base_from, "to_base": base_to,
             "result": result}
    assert ok(check)["ok"] is proved


@pytest.mark.parametrize("bits, representation, value, proved", [
    ("11010011", "twos_complement", -45, True), ("10001100", "twos_complement", -116, True),
    ("10101101", "sign_magnitude", -45, True), ("11010011", "twos_complement", -44, False),
    ("10101101", "twos_complement", -45, False),
])
def test_signed_values(bits, representation, value, proved):
    check = {"kind": "cs_signed", "representation": representation, "bits": bits, "value": value}
    assert ok(check)["ok"] is proved


@pytest.mark.parametrize("representation", ["twos_complement", "sign_magnitude"])
def test_the_general_rule_for_a_width_is_proved_for_every_pattern(representation):
    # twos_complement: the leftmost bit is worth -2^(n-1), the rest their usual place values, and
    # "invert every bit then add 1" negates; sign_magnitude: the leftmost bit is the sign.
    assert ok({"kind": "cs_signed", "representation": representation, "width": 8})["ok"]


def test_an_unknown_representation_is_refused():
    assert not ok({"kind": "cs_signed", "representation": "ones_complement", "width": 8})["ok"]


@pytest.mark.parametrize("left, right, equivalent, proved", [
    ("¬(A ∧ B)", "¬A ∨ ¬B", True, True), ("A ∨ (A ∧ B)", "A", True, True),
    ("¬(A ∧ B)", "¬A ∧ ¬B", True, False), ("¬(A ∧ B)", "¬A ∧ ¬B", False, True),
    ("A ⊕ B", "(A ∧ ¬B) ∨ (¬A ∧ B)", True, True),
])
def test_boolean_equivalence_by_truth_table(left, right, equivalent, proved):
    check = {"kind": "cs_logic_equivalence", "left": left, "right": right,
             "equivalent": equivalent}
    assert ok(check)["ok"] is proved


def test_an_unreadable_boolean_expression_is_an_error_not_a_proof():
    result = ok({"kind": "cs_logic_equivalence", "left": "A ∧", "right": "A", "equivalent": True})
    assert result["ok"] is False and result["error"]


def test_the_item_schema_allows_exactly_the_engine_fact_kinds():
    import json
    from pathlib import Path

    from app import facts
    from app.cs import facts as cs_facts

    schema = json.loads((Path(__file__).resolve().parents[3]
                         / "content/schemas/item.schema.json").read_text())
    allowed = set(schema["properties"]["facts"]["items"]["properties"]["engine"]["properties"]
                  ["kind"]["enum"])
    assert set(cs_facts.KINDS) <= allowed
    assert allowed - {"identity", "value", "solve", "expression", "formula"} == set(
        facts.KINDS) | set(cs_facts.KINDS)


@pytest.mark.parametrize("expression", ["(2 + 3", "2 ^ -1", "7 DIV 0", "7 MOD 0", "2 3", "2 +",
                                        "-"])
def test_arithmetic_that_cannot_be_worked_out_is_not_proved(expression):
    result = ok({"kind": "cs_arithmetic", "expression": expression, "value": 0})
    assert result["ok"] is False and result["error"]


def test_arithmetic_with_minus_and_powers():
    assert ok({"kind": "cs_arithmetic", "expression": "-2^2 + 10 - 3", "value": 3})["ok"]
    assert ok({"kind": "cs_arithmetic", "expression": "-7 DIV 2", "value": -4})["ok"]


def test_a_base_conversion_needs_digits_of_its_base():
    assert not ok({"kind": "cs_base", "value": "1A", "from_base": 10, "to_base": 2,
                   "result": "0"})["ok"]


def test_the_rules_fail_when_the_engine_disagrees(monkeypatch):
    from app.cs import bases
    from app.cs import facts as cs_facts

    monkeypatch.setattr(cs_facts, "_place_value_reading", lambda pattern: int(pattern, 2))
    assert cs_facts._twos_rule(4) is not None
    monkeypatch.setattr(bases, "to_sign_magnitude", lambda n, width: "0" * width)
    assert cs_facts._sign_magnitude_rule(4) is not None
    monkeypatch.setattr(bases, "to_hex", lambda n: "Z")
    assert "disagree" in cs_facts._base({"value": "10", "from_base": 10, "to_base": 16,
                                         "result": "A"})


def test_the_negation_rule_is_checked_too(monkeypatch):
    from app.cs import facts as cs_facts

    real = cs_facts._place_value_reading
    calls = {"n": 0}

    def reading(pattern):
        calls["n"] += 1
        # The first reading of each pattern is right; the negated pattern's reading is wrong.
        return real(pattern) if calls["n"] % 2 else real(pattern) + 1
    monkeypatch.setattr(cs_facts, "_place_value_reading", reading)
    assert "inverting" in cs_facts._twos_rule(3)


# Codex review on #440: an empty result is not a number, and only bases 2, 10 and 16 are read
# (a base of 1 would never finish dividing).
@pytest.mark.parametrize("check", [
    {"value": "0", "from_base": 10, "to_base": 2, "result": ""},
    {"value": "5", "from_base": 10, "to_base": 1, "result": "11111"},
    {"value": "5", "from_base": 10, "to_base": 8, "result": "5"},
    {"value": "5", "from_base": 7, "to_base": 10, "result": "5"},
    {"value": "5", "from_base": 10, "to_base": 2, "result": "1O1"},
])
def test_base_conversions_need_a_real_result_and_a_supported_base(check):
    result = ok({"kind": "cs_base", **check})
    assert result["ok"] is False and result["error"]


def test_zero_converts_to_zero():
    assert ok({"kind": "cs_base", "value": "0", "from_base": 10, "to_base": 2, "result": "0"})["ok"]
    assert ok({"kind": "cs_base", "value": "00", "from_base": 16, "to_base": 10,
               "result": "0"})["ok"]


# Codex review on #440: the rule is proved by trying every pattern, so the width is capped at 16
# bits (A-Level questions use 4 to 16); 32 or 64 would never finish.
@pytest.mark.parametrize("width", [1, 17, 32, 64, "8"])
def test_a_rule_width_outside_2_to_16_is_refused_at_once(width):
    import time
    start = time.monotonic()
    result = ok({"kind": "cs_signed", "representation": "twos_complement", "width": width})
    assert result["ok"] is False and "width" in result["error"]
    assert time.monotonic() - start < 1


def test_the_largest_allowed_width_is_proved_quickly():
    import time
    start = time.monotonic()
    assert ok({"kind": "cs_signed", "representation": "twos_complement", "width": 16})["ok"]
    assert time.monotonic() - start < 10
