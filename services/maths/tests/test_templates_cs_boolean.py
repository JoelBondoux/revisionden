"""A-Level Computer Science templates (OCR H446), strand 2: Boolean algebra, 1.4.3 (a) to (e).

Answers come from the CS engine (app/cs/logic). The tests read each question back with their own
small evaluator (Python's ast module, not app/cs/logic), so a wrong option or a wrong truth table
cannot pass.
"""
import ast
import re
from itertools import product

import pytest

from app.templates import build
from app.templates.alevel_cs import TEMPLATES
from app.templates.core import generate, make_item

NOW = "2026-11-27T00:00:00Z"
BOOLEAN = [t for t in TEMPLATES if t.topic.startswith("alevel-cs-ocr-1-4-3-")]
SLUGS = {
    "a": {"define-a-problem"},
    "b": {"simplify-expression", "karnaugh-map-three-letters", "karnaugh-map-four-letters"},
    "c": {"de-morgan", "name-the-rule"},
    "d": {"truth-table"},
    "e": {"full-adder", "d-type-flip-flop"},
}
_OPS = {ast.BitAnd: lambda a, b: a & b, ast.BitOr: lambda a, b: a | b,
        ast.BitXor: lambda a, b: a ^ b}


def _value(text: str, values: dict) -> int:
    """OCR's binding (NOT, AND, XOR, OR) is Python's for ~, &, ^ and |, so ast reads it."""
    python = text.replace("¬", "~").replace("∧", "&").replace("∨", "|").replace("⊕", "^")

    def walk(node):
        if isinstance(node, ast.Expression):
            return walk(node.body)
        if isinstance(node, ast.Name):
            return values[node.id]
        if isinstance(node, ast.Constant) and node.value in (0, 1):
            return node.value
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Invert):
            return 1 - walk(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](walk(node.left), walk(node.right))
        raise ValueError(f"unexpected {ast.dump(node)}")
    return walk(ast.parse(python, mode="eval"))


def _table(text: str, letters: str) -> list[int]:
    return [_value(text, dict(zip(letters, bits))) for bits in product((0, 1), repeat=len(letters))]


def _slug(template):
    return template.id[len(template.topic) + 1:]


def test_every_boolean_algebra_point_has_its_templates():
    found = {}
    for t in BOOLEAN:
        found.setdefault(t.topic[-1], set()).add(_slug(t))
    assert found == SLUGS


def test_strand_two_adds_about_sixty_items():
    assert len(BOOLEAN) * build.COURSES["alevel-cs"].count >= 56


@pytest.mark.parametrize("template", BOOLEAN, ids=lambda t: t.id)
def test_items_cite_the_boolean_algebra_section(template):
    item = make_item(template, 1, NOW)
    assert item["source_ref"] == f"OCR H446 specification 1.4.3({template.topic[-1]})"


@pytest.mark.parametrize("template", [t for t in BOOLEAN if t.type == "multiple_choice"],
                         ids=lambda t: t.id)
def test_a_choice_question_has_four_different_options_and_one_right_one(template):
    for item in generate(template, 7, NOW):
        options = item["options"]
        assert len(options) == 4 and len(set(options)) == 4, item["id"]
        assert 0 <= item["answer"]["option"] < 4


def test_the_right_answer_is_not_always_in_the_same_place():
    for template in [t for t in BOOLEAN if t.type == "multiple_choice"]:
        places = {item["answer"]["option"] for item in generate(template, 7, NOW)}
        assert len(places) > 1, template.id


def _target(item):
    """The expression a choice must be equivalent to, read from the question text."""
    m = re.search(r"equivalent to (.+?)\?", item["prompt"])
    return m.group(1) if m else None


@pytest.mark.parametrize("template", [t for t in BOOLEAN if _slug(t) in {
    "simplify-expression", "de-morgan"}], ids=lambda t: t.id)
def test_exactly_one_option_is_equivalent_to_the_expression(template):
    for item in generate(template, 7, NOW):
        target = _table(_target(item), "ABC")
        same = [i for i, o in enumerate(item["options"]) if _table(o, "ABC") == target]
        assert same == [item["answer"]["option"]], item["id"]


def _map_cells(prompt: str) -> dict:
    """{row label: [cells]} from lines such as "A = 0: 0 1 1 0"."""
    return {m.group(1): m.group(2).split() for m in re.finditer(
        r"(?:A|AB) = ([01]{1,2}): ([01](?: [01])+)", prompt)}


@pytest.mark.parametrize("template", [t for t in BOOLEAN if _slug(t).startswith("karnaugh")],
                         ids=lambda t: t.id)
def test_exactly_one_option_matches_the_karnaugh_map(template):
    four = _slug(template).endswith("four-letters")
    letters, cols = ("ABCD", ["00", "01", "11", "10"]) if four else ("ABC", ["00", "01", "11",
                                                                           "10"])
    for item in generate(template, 7, NOW):
        cells = _map_cells(item["prompt"])
        assert len(cells) == (4 if four else 2), item["id"]
        wanted = {}
        for row, values in cells.items():
            for col, v in zip(cols, values):
                wanted[row + col] = int(v)
        target = [wanted["".join(map(str, bits))] for bits in product((0, 1), repeat=len(letters))]
        same = [i for i, o in enumerate(item["options"]) if _table(o, letters) == target]
        assert same == [item["answer"]["option"]], item["id"]


def test_a_karnaugh_answer_is_in_its_simplest_form():
    from app.cs import logic
    for template in [t for t in BOOLEAN if _slug(t).startswith("karnaugh")]:
        for item in generate(template, 7, NOW):
            right = item["options"][item["answer"]["option"]]
            assert logic.literal_count(right) == logic.literal_count(logic.simplify(right))


def test_a_truth_table_answer_lists_every_row_in_the_stated_order():
    [template] = [t for t in BOOLEAN if _slug(t) == "truth-table"]
    for item in generate(template, 7, NOW):
        expression = re.search(r"Q = (.+?)\. ", item["prompt"]).group(1)
        letters = "".join(sorted(set(re.findall(r"[A-Z]", expression)) - {"Q"}))
        assert f"{letters} = {'0' * len(letters)}" in item["prompt"], item["id"]
        expected = "".join(map(str, _table(expression, letters)))
        assert item["answer"]["accepted"][0] == expected, item["id"]


def test_a_full_adder_answer_is_the_binary_sum_of_its_inputs():
    [template] = [t for t in BOOLEAN if _slug(t) == "full-adder"]
    for item in generate(template, 7, NOW):
        a, b, c = map(int, re.search(r"A = ([01]), B = ([01]) and carry in ([01])",
                                     item["prompt"]).groups())
        output = "carry out" if "carry out?" in item["prompt"] else "sum"
        total = a + b + c
        expected = total // 2 if output == "carry out" else total % 2
        assert item["answer"]["accepted"] == [str(expected)], item["id"]


def test_a_flip_flop_question_states_when_the_output_changes():
    [template] = [t for t in BOOLEAN if _slug(t) == "d-type-flip-flop"]
    for item in generate(template, 7, NOW):
        assert "rising edge" in item["prompt"] and "holds" in item["prompt"], item["id"]


def test_choice_options_reach_the_item():
    template = next(t for t in BOOLEAN if t.type == "multiple_choice")
    assert make_item(template, 1, NOW)["options"]


# Model review, 2026-11-27: "simplest form" is ambiguous (a factored form such as C ∧ (A ∨ ¬B)
# can have fewer letters than the simplest sum of products), so a Karnaugh question names the form.
def test_a_karnaugh_question_asks_for_the_simplest_sum_of_products():
    for template in [t for t in BOOLEAN if _slug(t).startswith("karnaugh")]:
        for item in generate(template, 7, NOW):
            assert "simplest sum of products" in item["prompt"], item["id"]


# Model review, 2026-11-27: what OCR's symbols mean is not in any cited quote, so an item that uses
# them lists the notation as a fact for the fact-check stage (decision 0009).
def test_an_item_that_uses_the_symbols_lists_the_notation_as_a_fact():
    for template in BOOLEAN:
        item = make_item(template, 1, NOW)
        text = item["prompt"] + " ".join(item.get("options", []))
        if re.search(r"[∧∨¬⊕]", text):
            assert any("∧ means AND" in f["statement"] for f in item.get("facts", [])), item["id"]
