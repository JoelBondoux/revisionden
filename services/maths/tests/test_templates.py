"""Question templates: seeded instances whose answers are correct by construction and cross-checked."""
import json
from dataclasses import replace
from pathlib import Path

import pytest

from app.templates import build
from app.templates.core import (
    GenerationError,
    IntParam,
    Rule,
    cross_check,
    draw_params,
    generate,
    make_item,
)
from app.templates.gcse_maths_higher import TEMPLATES
from app.templates.text import linear, polynomial, signed_term

NOW = "2026-11-26T00:00:00Z"
REPO = Path(__file__).resolve().parents[3]
ITEM_FIELDS = {
    "id", "type", "topic", "difficulty", "learning_point", "expected_seconds", "source_ref",
    "checked_by", "tags", "hint", "explanation", "mark_scheme", "citations", "verification",
    "prompt", "answer", "verify", "steps", "marks", "template",
}


# --- text helpers -------------------------------------------------------------------------

def test_linear_terms_are_written_as_a_student_would_write_them():
    assert linear(3, -5) == "3x - 5"
    assert linear(1, 2) == "x + 2"
    assert linear(-1, 4) == "-x + 4"
    assert linear(2, 0) == "2x"
    assert linear(0, -7) == "-7"
    assert linear(-4, 1, "y") == "-4y + 1"


def test_polynomials_skip_zero_terms_and_unit_coefficients():
    assert polynomial([1, 2, -15]) == "x^2 + 2x - 15"
    assert polynomial([6, -7, 0]) == "6x^2 - 7x"
    assert polynomial([1, 0, -9]) == "x^2 - 9"
    assert polynomial([0, 0, 0]) == "0"


def test_signed_terms_join_a_sum():
    assert signed_term(5, "x", first=False) == "+ 5x"
    assert signed_term(-1, "y", first=False) == "- y"
    assert signed_term(-3, "", first=True) == "-3"


# --- parameters and rules -----------------------------------------------------------------

def test_an_integer_parameter_samples_only_allowed_values():
    import random
    p = IntParam("p", -3, 3, exclude=(0,), step=1)
    rng = random.Random(1)
    values = {p.sample(rng) for _ in range(200)}
    assert values == {-3, -2, -1, 1, 2, 3}


def test_a_stepped_parameter_keeps_to_its_step():
    import random
    p = IntParam("amount", 20, 100, step=20)
    rng = random.Random(2)
    assert {p.sample(rng) for _ in range(200)} == {20, 40, 60, 80, 100}


def test_a_parameter_with_no_allowed_value_is_refused():
    with pytest.raises(ValueError):
        IntParam("p", 0, 0, exclude=(0,))


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_every_instance_keeps_to_its_parameter_ranges_and_rules(template):
    for seed in range(1, 41):
        params = draw_params(template, seed)
        for p in template.params:
            assert p.allows(params[p.name]), (p.name, params)
        for rule in template.rules:
            assert rule.holds(params), (rule.description, params)


def test_rules_that_can_never_hold_stop_generation():
    template = replace(TEMPLATES[0], rules=(Rule("impossible", lambda p: False),))
    with pytest.raises(GenerationError, match="impossible"):
        draw_params(template, 1)


# --- determinism --------------------------------------------------------------------------

@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_the_same_seed_always_gives_the_same_item(template):
    assert make_item(template, 3, NOW) == make_item(template, 3, NOW)
    assert make_item(template, 3, NOW)["prompt"] != make_item(template, 4, NOW)["prompt"] or (
        draw_params(template, 3) == draw_params(template, 4))


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_generate_gives_distinct_questions_and_records_each_seed(template):
    items = generate(template, 5, NOW)
    assert len(items) == 5
    assert len({i["prompt"] for i in items}) == 5
    assert len({i["id"] for i in items}) == 5
    for item in items:
        seed = item["template"]["seed"]
        assert item == make_item(template, seed, NOW)
        assert item["template"] == {"id": template.id, "version": template.version, "seed": seed}


# --- the item schema ----------------------------------------------------------------------

@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_items_have_the_content_item_shape(template):
    for item in generate(template, 5, NOW):
        assert set(item) <= ITEM_FIELDS
        assert item["type"] in {"numeric", "worked_maths", "short_answer"}
        assert item["topic"] == template.topic
        assert item["id"].startswith(template.topic + "-t")
        assert item["explanation"] and item["hint"]
        assert "maths-engine" in item["checked_by"]
        assert item["citations"] and all(c["quote"] for c in item["citations"])
        assert item["verification"]["status"] == "draft"
        names = [c["name"] for c in item["verification"]["checks"]]
        assert names == ["grounded-writing", "maths-engine"]
        if item["type"] == "worked_maths":
            assert len(item["steps"]) >= 2 and item["verify"]["method"] in {"solve", "expression"}
        if item["type"] == "numeric":
            assert "expression" in item["verify"]


def test_every_template_cites_a_quote_already_used_by_items_in_its_topic():
    used = {}
    for path in (REPO / "content/items").rglob("*.json"):
        if "templated" in path.parts:
            continue
        for item in json.loads(path.read_text()):
            for c in item["citations"]:
                used.setdefault(item["topic"], set()).add((c["location"], c["quote"], c.get("sha256")))
    for template in TEMPLATES:
        for c in template.citations:
            assert (c["location"], c["quote"], c.get("sha256")) in used[template.topic], template.id


# --- the cross-check ----------------------------------------------------------------------

@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_every_instance_passes_the_independent_cross_check(template):
    for seed in range(1, 31):
        params = draw_params(template, seed)
        item = make_item(template, seed, NOW)
        assert cross_check(template, params, item) == []


def _broken(template, change):
    def write(params):
        return change(template.write(params))
    return replace(template, write=write)


def _template(id_):
    return next(t for t in TEMPLATES if t.id.endswith(id_))


def test_a_wrong_answer_fails_generation():
    template = _broken(_template("double-brackets"),
                       lambda q: {**q, "answer": {"expression": "x^2 + 1"}})
    with pytest.raises(GenerationError, match="maths engine"):
        make_item(template, 1, NOW)


def test_a_wrong_step_fails_generation():
    template = _broken(_template("unknown-both-sides"),
                       lambda q: {**q, "steps": [*q["steps"][:-1], "x = 1000"]})
    with pytest.raises(GenerationError, match="maths engine"):
        make_item(template, 1, NOW)


def test_a_question_whose_text_disagrees_with_its_numbers_fails_generation():
    template = _broken(_template("unknown-both-sides"),
                       lambda q: {**q, "prompt": q["prompt"].replace("=", "= 1 +", 1)})
    with pytest.raises(GenerationError, match="recheck"):
        make_item(template, 1, NOW)


def test_a_wrong_simultaneous_solution_fails_generation():
    template = _broken(_template("elimination"),
                       lambda q: {**q, "answer": {**q["answer"], "accepted": ["x = 100, y = 1"]}})
    with pytest.raises(GenerationError, match="recheck"):
        make_item(template, 1, NOW)


def test_a_wrong_percentage_answer_fails_generation():
    template = _broken(_template("percentage-change"),
                       lambda q: {**q, "answer": {**q["answer"], "value": "1"}})
    with pytest.raises(GenerationError):
        make_item(template, 1, NOW)


def test_an_answer_not_in_standard_form_fails_generation():
    template = _broken(_template("standard-form-multiply"),
                       lambda q: {**q, "answer": {"expression": "15*10^10"}})
    with pytest.raises(GenerationError, match="recheck"):
        make_item(template, 2, NOW)


def test_unreadable_maths_fails_generation_rather_than_crashing():
    template = _broken(_template("double-brackets"), lambda q: {**q, "prompt": "Expand (x +"})
    with pytest.raises(GenerationError):
        make_item(template, 1, NOW)


# --- the build: committed files match a fresh generation ----------------------------------

def test_the_committed_template_items_match_a_fresh_generation():
    problems = build.check(REPO / build.OUT_DIR)
    assert problems == []


def test_the_build_keeps_review_records_for_unchanged_items(tmp_path):
    template = TEMPLATES[0]
    first = build.build_file(template, tmp_path, NOW, count=2)
    items = json.loads(first.read_text())
    items[0]["verification"]["checks"].append(
        {"name": "blind-answer", "result": "pass", "tool": "t", "tool_version": "1", "at": NOW})
    first.write_text(json.dumps(items))
    again = json.loads(build.build_file(template, tmp_path, "2026-12-01T00:00:00Z", count=2).read_text())
    assert again[0]["verification"] == items[0]["verification"]
    assert again[1]["verification"]["checks"][0]["at"] == NOW


def test_the_build_starts_a_new_version_when_an_item_changes(tmp_path):
    template = TEMPLATES[0]
    path = build.build_file(template, tmp_path, NOW, count=1)
    items = json.loads(path.read_text())
    items[0]["prompt"] = "something older"
    items[0]["verification"]["version"] = 2
    path.write_text(json.dumps(items))
    again = json.loads(build.build_file(template, tmp_path, NOW, count=1).read_text())
    assert again[0]["verification"]["version"] == 3
    assert again[0]["verification"]["status"] == "draft"


def test_check_reports_a_missing_or_edited_file(tmp_path):
    assert any("missing" in p for p in build.check(tmp_path))
    for template in TEMPLATES:
        build.build_file(template, tmp_path, NOW)
    assert build.check(tmp_path) == []
    path = tmp_path / f"{TEMPLATES[0].id}.json"
    items = json.loads(path.read_text())
    items[0]["prompt"] = "edited by hand"
    path.write_text(json.dumps(items))
    assert any("differs" in p for p in build.check(tmp_path))


def test_the_command_line_builds_or_checks(tmp_path, capsys):
    assert build.main(["--out", str(tmp_path), "--now", NOW]) == 0
    assert build.main(["--out", str(tmp_path), "--check"]) == 0
    (tmp_path / f"{TEMPLATES[0].id}.json").unlink()
    assert build.main(["--out", str(tmp_path), "--check"]) == 1
    assert "missing" in capsys.readouterr().err


def test_generate_skips_questions_already_in_the_bank():
    template = TEMPLATES[0]
    taken = make_item(template, 1, NOW)["prompt"]
    items = generate(template, 3, NOW, avoid={taken})
    assert taken not in {i["prompt"] for i in items}
    assert items[0]["template"]["seed"] > 1


def test_template_questions_never_repeat_a_hand_written_one():
    written = build.existing_prompts(REPO / "content/items")
    assert "Expand and simplify (x + 5)(x - 3). Use ^ for powers." in written
    for path in (REPO / build.OUT_DIR).glob("*.json"):
        assert not {i["prompt"] for i in json.loads(path.read_text())} & written


def test_brackets_never_have_a_common_factor():
    from math import gcd
    template = _template("double-brackets")
    for seed in range(1, 41):
        p = draw_params(template, seed)
        assert gcd(p["a"], p["p"]) == 1 and gcd(p["b"], p["q"]) == 1


def test_the_owner_preview_lists_every_question_with_its_answer(tmp_path):
    for template in TEMPLATES:
        build.build_file(template, tmp_path, NOW, count=2)
    text = build.preview(tmp_path)
    assert text.startswith("# ")
    for template in TEMPLATES:
        assert template.id in text
        for item in json.loads((tmp_path / f"{template.id}.json").read_text()):
            assert item["prompt"] in text
            assert item["explanation"] in text
    assert "x^2" in text and "£" in text
    assert build.main(["--out", str(tmp_path), "--preview", str(tmp_path / "p.md")]) == 0
    assert (tmp_path / "p.md").read_text() == text


def test_a_new_template_version_keeps_the_same_numbers_for_each_seed():
    template = TEMPLATES[0]
    newer = replace(template, version=template.version + 1)
    assert draw_params(newer, 4) == draw_params(template, 4)


def test_the_elimination_hint_names_the_one_operation_that_removes_y():
    template = _template("elimination")
    seen = set()
    for seed in range(1, 60):
        p = draw_params(template, seed)
        hint = make_item(template, seed, NOW)["hint"]
        if p["same"]:
            assert "subtract" in hint.lower() and "add" not in hint.lower()
        else:
            assert "add" in hint.lower() and "subtract" not in hint.lower()
        seen.add(p["same"])
    assert seen == {0, 1}


def test_standard_form_wording_says_the_indices_are_added_and_shows_why():
    template = _template("standard-form-multiply")
    for seed in range(1, 30):
        item = make_item(template, seed, NOW)
        text = item["hint"] + " " + item["explanation"]
        assert "add the powers" not in text.lower()
        assert "indices" in item["hint"] and "indices" in item["explanation"]
        if len(item["steps"]) == 4:  # the product had to be moved into standard form
            assert "× 10^1 ×" in item["explanation"]


def test_the_standard_form_method_mark_also_accepts_the_ordinary_number():
    template = _template("standard-form-multiply")
    item = make_item(template, 4, NOW)
    assert len(item["steps"]) == 4
    assert item["mark_scheme"][0] == "M1 for 29.4 × 10^8 or 2 940 000 000"


# --- T1c: more templates for thin topics ------------------------------------------------------

def test_there_are_templates_for_the_thin_topics():
    topics = {t.topic for t in TEMPLATES}
    assert {"gcse-maths-h-a18", "gcse-maths-h-a25", "gcse-maths-h-n10", "gcse-maths-h-n5",
            "gcse-maths-h-a7"} <= topics


def test_a_wrong_quadratic_root_fails_generation():
    template = _broken(_template("quadratic-factorising"),
                       lambda q: {**q, "answer": {"solutions": [q["answer"]["solutions"][0], "99"]}})
    with pytest.raises(GenerationError):
        make_item(template, 1, NOW)


def test_a_wrong_nth_term_fails_generation():
    template = _broken(_template("linear-nth-term"),
                       lambda q: {**q, "answer": {**q["answer"], "accepted": ["n + 1000"]}})
    with pytest.raises(GenerationError, match="recheck"):
        make_item(template, 1, NOW)


def test_a_recurring_decimal_answer_not_in_simplest_form_fails_generation():
    def unsimplified(q):
        num, den = q["answer"]["value"].split("/")
        return {**q, "answer": {"value": f"{int(num) * 2}/{int(den) * 2}"}}
    template = _broken(_template("recurring-decimal"), unsimplified)
    with pytest.raises(GenerationError, match="simplest"):
        make_item(template, 1, NOW)


def test_a_wrong_count_fails_generation():
    template = _broken(_template("product-rule"), lambda q: {**q, "answer": {"expression": "1"}})
    with pytest.raises(GenerationError):
        make_item(template, 1, NOW)


def test_a_composite_worked_the_wrong_way_round_fails_generation():
    template = _template("composite-function")
    seed = next(s for s in range(1, 50) if draw_params(template, s)["order"] == 0)
    params = draw_params(template, seed)
    f = lambda x: params["p"] * x + params["q"]  # noqa: E731
    g = lambda x: x * x + params["r"]  # noqa: E731
    wrong = g(f(params["k"]))  # gf instead of fg
    assert wrong != f(g(params["k"]))
    broken = _broken(template, lambda q: {**q, "answer": {"value": str(wrong)}})
    with pytest.raises(GenerationError):
        make_item(broken, seed, NOW)


def test_composite_working_never_shows_adding_zero():
    template = _template("composite-function")
    for seed in range(1, 40):
        assert "+ 0 " not in make_item(template, seed, NOW)["explanation"]
