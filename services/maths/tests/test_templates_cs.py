"""A-Level Computer Science templates (OCR H446, board provisional): strand 1, data representation.

Answers come from the CS engine (app/cs) and each instance is rechecked by a second method.
"""
import json
import re
from collections import Counter
from dataclasses import replace
from pathlib import Path

import pytest

from app.templates import build
from app.templates.alevel_cs import TEMPLATES
from app.templates.core import GenerationError, cross_check, draw_params, generate, make_item

NOW = "2026-11-27T00:00:00Z"
REPO = Path(__file__).resolve().parents[3]
TREE = json.loads((REPO / "content/topic-trees/alevel-computer-science-ocr-h446.json").read_text())


def _leaves(nodes):
    for node in nodes:
        if "children" in node:
            yield from _leaves(node["children"])
        else:
            yield node


LEAVES = {leaf["id"]: leaf for leaf in _leaves(TREE["topics"])}


def test_there_are_enough_templates_for_about_120_items():
    assert len(TEMPLATES) * build.COURSES["alevel-cs"].count >= 110
    assert len({t.id for t in TEMPLATES}) == len(TEMPLATES)


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_each_template_cites_its_topic_leaf_word_for_word(template):
    assert template.topic in LEAVES, template.topic
    [leaf_citation] = LEAVES[template.topic]["citations"]
    [citation] = template.citations
    same = {k: v for k, v in leaf_citation.items() if k != "supports"}
    assert {k: v for k, v in citation.items() if k != "supports"} == same
    assert citation["supports"] == ["question"]


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_items_have_the_content_item_shape(template):
    for item in generate(template, 7, NOW):
        assert item["type"] in {"short_answer", "multiple_choice"}
        assert item["id"].startswith(template.topic + "-t-")
        assert item["hint"] and item["explanation"]
        assert 1 <= item["difficulty"] <= 5
        assert item["verification"]["status"] == "draft"
        assert item["source_ref"].startswith("OCR H446 specification")


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_every_instance_passes_the_independent_cross_check(template):
    for seed in range(1, 31):
        assert cross_check(template, draw_params(template, seed), make_item(template, seed, NOW)) == []


# Guard (lead, 2026-11-27): an item must never rely on a convention the specification leaves
# open. Each question states its own format.
def test_every_question_states_the_conventions_it_depends_on():
    for template in TEMPLATES:
        for item in generate(template, 7, NOW):
            prompt = item["prompt"]
            if "floating point" in prompt:
                assert "two's complement" in prompt and "mantissa" in prompt, item["id"]
                assert "bits" in prompt and "exponent" in prompt, item["id"]
            if "two's complement" in prompt or "sign and magnitude" in prompt:
                assert re.search(r"\d+-bit|\d+ bits", prompt), item["id"]
            if "shift" in prompt:
                assert re.search(r"logical|arithmetic|circular", prompt), item["id"]


def test_each_learning_point_has_at_least_three_items():
    counts = Counter()
    for template in TEMPLATES:
        counts[template.learning_point] += build.COURSES["alevel-cs"].count
    assert min(counts.values()) >= 3


def _broken(template, change):
    def write(params):
        return change(template.write(params))
    return replace(template, write=write)


def _wrong_answer(q):
    q = dict(q)
    first = q["answer"]["accepted"][0]
    flipped = ("1" if first[-1] == "0" else "0") if first[-1] in "01" else (
        "0" if first[-1] != "0" else "1")
    q["answer"] = {**q["answer"], "accepted": [first[:-1] + flipped]}
    return q


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_a_wrong_answer_is_caught(template):
    with pytest.raises(GenerationError):
        make_item(_broken(template, _wrong_answer), 1, NOW)


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_question_text_that_disagrees_with_its_numbers_is_caught(template):
    def change(q):
        q = dict(q)
        # Swap the first 0 and 1 (or digits) in the question's data so it no longer matches.
        q["prompt"] = re.sub(r"\b([01]{4,})\b", lambda m: m.group(1)[::-1] if m.group(1) !=
                             m.group(1)[::-1] else m.group(1)[1:] + "1", q["prompt"], count=1) \
            if re.search(r"\b[01]{4,}\b", q["prompt"]) else re.sub(
                r"(-?\d+(?:\.\d+)?|[0-9A-F]{2,3}\b)", lambda m: _bump(m.group(1)), q["prompt"],
                count=1)
        return q
    with pytest.raises(GenerationError):
        make_item(_broken(template, change), 1, NOW)


def _bump(text):
    if re.fullmatch(r"-?\d+", text):
        return str(int(text) + 1)
    if re.fullmatch(r"-?\d+\.\d+", text):
        return text + "1"
    return "1" + text


def test_committed_cs_items_match_a_fresh_generation():
    course = build.COURSES["alevel-cs"]
    assert build.check(REPO / course.out_dir, course=course) == []


# Decision 0009: a hint or explanation that states a rule the specification does not state lists
# it in `facts`, and the item waits for individual human approval until the fact-check passes.
RULE_TEMPLATES = {
    "denary-to-twos-complement", "twos-complement-to-denary", "denary-to-sign-magnitude",
    "twos-complement-subtraction", "floating-point-to-denary", "denary-to-floating-point",
    "normalise-floating-point", "floating-point-addition", "shifts", "masks",
}


@pytest.mark.parametrize("template", TEMPLATES, ids=lambda t: t.id)
def test_items_that_state_a_rule_list_it_as_a_fact_and_need_human_approval(template):
    item = make_item(template, 1, NOW)
    slug = template.id[len(template.topic) + 1:]
    if slug in RULE_TEMPLATES:
        assert item["facts"] and all(f["statement"] and f["ask"] for f in item["facts"])
        assert item["needs_human_approval"] is True
        for fact in item["facts"]:
            assert fact["statement"] not in item["hint"]  # the ask is neutral, not our wording
    else:
        assert "facts" not in item and "needs_human_approval" not in item


def test_the_mantissa_sign_bit_is_described_by_its_actual_value():
    for item in generate(next(t for t in TEMPLATES if t.id.endswith("floating-point-to-denary")),
                         7, NOW):
        mantissa = re.search(r"mantissa ([01]{8})", item["prompt"]).group(1)
        if mantissa[0] == "0":
            assert "worth -1" not in item["explanation"], item["id"]
        else:
            assert "worth -1" in item["explanation"], item["id"]


# Lead ruling 2026-11-27: floating point blind-answer failures go to individual review, and the
# reviewer must see that the CS engine and an independent recheck confirmed each answer.
def test_the_engine_check_says_how_a_cs_answer_was_confirmed():
    for template in TEMPLATES:
        item = make_item(template, 1, NOW)
        [engine] = [c for c in item["verification"]["checks"] if c["name"] == "maths-engine"]
        assert "CS engine" in engine["notes"] and "second method" in engine["notes"], template.id
        assert engine["tool"] == "revisionden-cs-engine"


def test_committed_cs_items_record_how_each_answer_was_confirmed():
    for path in (REPO / build.COURSES["alevel-cs"].out_dir).glob("*.json"):
        for item in json.loads(path.read_text()):
            [engine] = [c for c in item["verification"]["checks"] if c["name"] == "maths-engine"]
            assert "CS engine" in engine["notes"], item["id"]
