"""Computer Science engine: Boolean logic (OCR H446 1.4.3), in the notation of appendix 5d.

OCR writes ∧ (conjunction), ∨ (disjunction), ¬ (negation), exclusive disjunction and ≡, and
accepts AND, ., OR, +, ~, NOT, XOR and ⊕ from learners.
"""
import pytest

from app.cs import logic


@pytest.mark.parametrize("text", [
    "A ∧ B", "A AND B", "A.B", "A Ʌ B", "a and b", "(A) ∧ (B)",
])
def test_conjunction_is_read_in_every_accepted_notation(text):
    assert logic.equivalent(text, "A ∧ B")


@pytest.mark.parametrize("text", ["A ∨ B", "A OR B", "A+B", "A ˅ B"])
def test_disjunction_is_read_in_every_accepted_notation(text):
    assert logic.equivalent(text, "A ∨ B")


@pytest.mark.parametrize("text", ["¬A", "~A", "NOT A", "¬¬¬A"])
def test_negation_is_read_in_every_accepted_notation(text):
    assert logic.equivalent(text, "¬A")


@pytest.mark.parametrize("text", ["A XOR B", "A ⊕ B", "A ⊻ B"])
def test_exclusive_disjunction_is_read(text):
    assert logic.truth_table(text) == [((0, 0), 0), ((0, 1), 1), ((1, 0), 1), ((1, 1), 0)]


def test_equivalence_is_true_when_both_sides_match():
    assert logic.truth_table("A ≡ B") == [((0, 0), 1), ((0, 1), 0), ((1, 0), 0), ((1, 1), 1)]
    assert logic.truth_table("A ↔ B") == logic.truth_table("A ≡ B")


def test_not_binds_tightest_then_and_then_or():
    assert logic.equivalent("¬A ∧ B ∨ C", "((¬A) ∧ B) ∨ C")
    assert not logic.equivalent("¬A ∧ B ∨ C", "¬(A ∧ (B ∨ C))")


def test_truth_tables_list_rows_in_binary_counting_order():
    assert logic.variables("C ∨ (A ∧ ¬B)") == ["A", "B", "C"]
    assert logic.truth_table("A ∧ B") == [((0, 0), 0), ((0, 1), 0), ((1, 0), 0), ((1, 1), 1)]
    assert [v for _, v in logic.truth_table("C ∨ (A ∧ ¬B)")] == [0, 1, 0, 1, 1, 1, 0, 1]


def test_de_morgans_laws_hold_and_a_common_slip_does_not():
    assert logic.equivalent("¬(A ∧ B)", "¬A ∨ ¬B")
    assert logic.equivalent("¬(A ∨ B)", "¬A ∧ ¬B")
    assert not logic.equivalent("¬(A ∧ B)", "¬A ∧ ¬B")


def test_expressions_over_different_letters_are_compared_on_all_of_them():
    assert logic.equivalent("A ∨ (B ∧ ¬B)", "A")
    assert not logic.equivalent("A", "B")


@pytest.mark.parametrize("text, simplest", [
    ("(A ∧ B) ∨ (A ∧ ¬B)", "A"),
    ("A ∨ (A ∧ B)", "A"),
    ("(A ∧ ¬B) ∨ (A ∧ B) ∨ (¬A ∧ B)", "A ∨ B"),
    ("¬(¬A)", "A"),
    ("A ∧ ¬A", "0"),
    ("A ∨ ¬A", "1"),
])
def test_simplify_gives_the_shortest_sum_of_products(text, simplest):
    assert logic.simplify(text) == simplest


def test_literal_count():
    assert logic.literal_count("(A ∧ ¬B) ∨ C") == 3
    assert logic.literal_count("A") == 1
    assert logic.literal_count("1") == 0


@pytest.mark.parametrize("given, ok", [
    ("A ∨ B", True), ("B ∨ A", True), ("A OR B", True), ("A + B", True),
    ("A ∨ (¬A ∧ B)", False),   # right value but not simplified
    ("A ∧ B", False),          # simpler but wrong
])
def test_a_simplified_answer_must_be_equivalent_and_as_short_as_possible(given, ok):
    assert logic.is_simplest(given, "(A ∧ ¬B) ∨ (A ∧ B) ∨ (¬A ∧ B)") is ok


def test_karnaugh_maps_use_gray_code_order():
    grid = logic.karnaugh_map("A ∧ ¬B ∨ C")
    assert grid.rows == ("A", ["0", "1"])
    assert grid.cols == ("BC", ["00", "01", "11", "10"])
    assert grid.cells == [[0, 1, 1, 0], [1, 1, 1, 0]]
    four = logic.karnaugh_map("A ∧ B ∧ C ∧ D")
    assert four.rows == ("AB", ["00", "01", "11", "10"])
    assert four.cells[2][2] == 1
    assert sum(map(sum, four.cells)) == 1
    two = logic.karnaugh_map("A ∨ B")
    assert (two.rows, two.cols, two.cells) == (("A", ["0", "1"]), ("B", ["0", "1"]),
                                               [[0, 1], [1, 1]])


def test_karnaugh_maps_take_two_to_four_letters():
    with pytest.raises(ValueError):
        logic.karnaugh_map("A ∧ B ∧ C ∧ D ∧ E")
    with pytest.raises(ValueError):
        logic.karnaugh_map("A")


def test_ocr_notation_brackets_each_and_group_inside_an_or():
    assert logic.to_ocr("a and not b or c") == "(A ∧ ¬B) ∨ C"
    assert logic.to_ocr("NOT (A OR B)") == "¬(A ∨ B)"
    assert logic.to_ocr("A XOR B") == "A ⊕ B"


@pytest.mark.parametrize("bad", ["A ∧", "A B", "(A ∨ B", "A ∧ ∧ B", "A ∧ 7", ""])
def test_unreadable_expressions_are_refused(bad):
    with pytest.raises(ValueError):
        logic.parse(bad)


def test_half_and_full_adders():
    assert [logic.half_adder(a, b) for a in (0, 1) for b in (0, 1)] == [
        (0, 0), (1, 0), (1, 0), (0, 1)]
    assert logic.full_adder(1, 1, 1) == (1, 1)
    assert logic.full_adder(1, 0, 1) == (0, 1)
    assert logic.full_adder(0, 0, 1) == (1, 0)


@pytest.mark.parametrize("text, simplest", [
    ("A ⊕ B", "(A ∧ ¬B) ∨ (¬A ∧ B)"),
    ("A ≡ B", "(A ∧ B) ∨ (¬A ∧ ¬B)"),
    ("(A ∧ 1) ∨ (B ∧ 0)", "A"),
    ("A ∧ B ∧ ¬C", "A ∧ B ∧ ¬C"),
])
def test_simplify_writes_exclusive_or_equivalence_and_constants_as_products(text, simplest):
    assert logic.simplify(text) == simplest


def test_an_unreadable_simplified_answer_is_simply_wrong():
    assert logic.is_simplest("A ∨∨ B", "A ∨ B") is False


@pytest.mark.parametrize("bad", ["AB ∧ C", "A ∧ #"])
def test_letters_must_be_single_and_symbols_known(bad):
    with pytest.raises(ValueError):
        logic.parse(bad)


def test_constants_are_written_back_as_digits():
    assert logic.to_ocr("A ∨ 0") == "A ∨ 0"
    assert logic.to_ocr("NOT NOT A") == "¬¬A"
