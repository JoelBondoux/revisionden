"""Computer Science engine: standard algorithm tracers (OCR H446 2.3.1 (e) and (f), 1.4.2).

Every expected state is worked by hand.
"""
import pytest

from app.cs import tracers


def test_bubble_sort_lists_the_state_after_each_pass_and_stops_after_a_pass_with_no_swaps():
    run = tracers.bubble_sort([5, 1, 4, 2, 8])
    assert run.passes == [[1, 4, 2, 5, 8], [1, 2, 4, 5, 8], [1, 2, 4, 5, 8]]
    assert run.swaps == 4
    assert run.result == [1, 2, 4, 5, 8]


def test_bubble_sort_on_sorted_data_takes_one_pass():
    run = tracers.bubble_sort([1, 2, 3])
    assert run.passes == [[1, 2, 3]]
    assert run.swaps == 0


def test_insertion_sort_lists_the_state_after_each_insertion():
    run = tracers.insertion_sort([5, 1, 4, 2, 8])
    assert run.passes == [[1, 5, 4, 2, 8], [1, 4, 5, 2, 8], [1, 2, 4, 5, 8], [1, 2, 4, 5, 8]]
    assert run.result == [1, 2, 4, 5, 8]


def test_merge_sort_lists_each_merge_in_the_order_it_happens():
    run = tracers.merge_sort([5, 1, 4, 2, 8])
    assert run.merges == [[1, 5], [2, 8], [2, 4, 8], [1, 2, 4, 5, 8]]
    assert run.result == [1, 2, 4, 5, 8]
    assert tracers.merge_sort([38, 27, 43, 3]).merges == [[27, 38], [3, 43], [3, 27, 38, 43]]


def test_quick_sort_with_the_first_item_as_pivot_lists_each_partition():
    run = tracers.quick_sort([5, 1, 8, 3, 9, 2])
    assert run.partitions == [(5, [1, 3, 2], [8, 9]), (1, [], [3, 2]), (3, [2], []),
                              (8, [], [9])]
    assert run.result == [1, 2, 3, 5, 8, 9]


def test_sorts_work_on_words_and_leave_the_input_alone():
    words = ["pear", "apple", "fig"]
    assert tracers.bubble_sort(words).result == ["apple", "fig", "pear"]
    assert words == ["pear", "apple", "fig"]


def test_binary_search_lists_low_high_and_mid_at_each_step():
    found = tracers.binary_search([3, 9, 14, 20, 27, 31, 42], 31)
    assert found.steps == [(0, 6, 3, 20), (4, 6, 5, 31)]
    assert found.index == 5
    missing = tracers.binary_search([3, 9, 14, 20, 27, 31, 42], 10)
    assert missing.steps == [(0, 6, 3, 20), (0, 2, 1, 9), (2, 2, 2, 14)]
    assert missing.index == -1


def test_binary_search_needs_sorted_data():
    with pytest.raises(ValueError):
        tracers.binary_search([3, 1, 2], 1)


def test_linear_search_counts_comparisons():
    assert tracers.linear_search([4, 7, 1, 9], 1) == tracers.Search(index=2, comparisons=3)
    assert tracers.linear_search([4, 7, 1, 9], 5) == tracers.Search(index=-1, comparisons=4)


def test_a_stack_reports_popped_items_and_overflow_and_underflow():
    run = tracers.stack([("push", "A"), ("push", "B"), ("pop",), ("push", "C"), ("push", "D"),
                         ("push", "E")], size=3)
    assert run.contents == ["A", "C", "D"]
    assert run.removed == ["B"]
    assert run.errors == [(5, "overflow")]
    assert run.pointer == 2   # index of the top item
    empty = tracers.stack([("pop",)], size=2)
    assert (empty.errors, empty.pointer) == ([(0, "underflow")], -1)


def test_a_stack_peek_does_not_remove():
    run = tracers.stack([("push", 1), ("peek",)], size=2)
    assert (run.removed, run.peeked, run.contents) == ([], [1], [1])


def test_a_circular_queue_wraps_its_rear_pointer():
    run = tracers.queue([("enqueue", 1), ("enqueue", 2), ("enqueue", 3), ("dequeue",),
                         ("enqueue", 4), ("enqueue", 5)], size=3, circular=True)
    assert run.contents == [2, 3, 4]
    assert run.removed == [1]
    assert (run.front, run.rear) == (1, 0)
    assert run.errors == [(5, "full")]


def test_a_linear_queue_cannot_reuse_the_space_at_the_front():
    run = tracers.queue([("enqueue", 1), ("enqueue", 2), ("enqueue", 3), ("dequeue",),
                         ("enqueue", 4)], size=3, circular=False)
    assert run.contents == [2, 3]
    assert run.errors == [(4, "full")]
    empty = tracers.queue([("dequeue",)], size=2)
    assert empty.errors == [(0, "empty")]


def test_unknown_operations_are_refused():
    with pytest.raises(ValueError):
        tracers.stack([("shove", 1)], size=2)
    with pytest.raises(ValueError):
        tracers.queue([("push", 1)], size=2)


def test_binary_search_tree_traversals():
    tree = tracers.BinarySearchTree([50, 30, 70, 20, 40, 60, 80])
    assert tree.pre_order() == [50, 30, 20, 40, 70, 60, 80]
    assert tree.in_order() == [20, 30, 40, 50, 60, 70, 80]
    assert tree.post_order() == [20, 40, 30, 60, 80, 70, 50]
    assert tree.breadth_first() == [50, 30, 70, 20, 40, 60, 80]
    assert tree.search_path(60) == [50, 70, 60]
    assert tree.search_path(65) == [50, 70, 60]


def test_a_repeated_value_is_not_added_twice():
    assert tracers.BinarySearchTree([5, 3, 5]).in_order() == [3, 5]


GRAPH = {("A", "B"): 4, ("A", "C"): 2, ("C", "B"): 1, ("B", "D"): 5, ("C", "D"): 8,
         ("D", "E"): 3}


def test_dijkstra_gives_distances_visit_order_and_the_path():
    run = tracers.dijkstra(GRAPH, "A")
    assert run.distances == {"A": 0, "B": 3, "C": 2, "D": 8, "E": 11}
    assert run.order == ["A", "C", "B", "D", "E"]
    assert run.path_to("E") == ["A", "C", "B", "D", "E"]


def test_dijkstra_on_a_directed_graph_and_an_unreachable_node():
    run = tracers.dijkstra({("A", "B"): 1, ("C", "A"): 1}, "A", directed=True)
    assert run.distances == {"A": 0, "B": 1, "C": None}
    assert run.path_to("C") is None


def test_dijkstra_refuses_negative_weights():
    with pytest.raises(ValueError):
        tracers.dijkstra({("A", "B"): -1}, "A")


def test_a_star_uses_the_heuristic_to_choose_what_to_expand():
    heuristic = {"A": 7, "B": 5, "C": 6, "D": 3, "E": 0}
    run = tracers.a_star(GRAPH, "A", "E", heuristic)
    assert run.order == ["A", "C", "B", "D", "E"]
    assert run.path == ["A", "C", "B", "D", "E"]
    assert run.cost == 11


def test_a_star_with_no_route():
    run = tracers.a_star({("A", "B"): 1, ("C", "D"): 1}, "A", "D", {"A": 0, "B": 0, "C": 0,
                                                                   "D": 0})
    assert (run.path, run.cost) == (None, None)


def test_ties_are_broken_alphabetically():
    run = tracers.dijkstra({("S", "B"): 1, ("S", "A"): 1}, "S")
    assert run.order == ["S", "A", "B"]


# Codex review on #431: with an inconsistent heuristic, a closed node can later get a cheaper route
# and the cost would not reach its successors (S,B,A,G reported as 5 when it costs 4). Exam A*
# questions use consistent heuristics, so the tracer refuses any other kind rather than answer.
def test_a_star_refuses_a_heuristic_that_is_not_consistent():
    edges = {("S", "A"): 3, ("S", "B"): 1, ("B", "A"): 1, ("A", "G"): 2}
    with pytest.raises(ValueError, match="consistent"):
        tracers.a_star(edges, "S", "G", {"S": 0, "A": 0, "B": 3, "G": 0}, directed=True)


def test_a_star_refuses_a_goal_with_a_nonzero_heuristic():
    with pytest.raises(ValueError, match="goal"):
        tracers.a_star({("A", "B"): 1}, "A", "B", {"A": 0, "B": 1})


def test_a_star_with_a_consistent_heuristic_finds_the_cheapest_route():
    edges = {("S", "A"): 3, ("S", "B"): 1, ("B", "A"): 1, ("A", "G"): 2}
    run = tracers.a_star(edges, "S", "G", {"S": 3, "A": 2, "B": 3, "G": 0}, directed=True)
    assert (run.path, run.cost) == (["S", "B", "A", "G"], 4)
