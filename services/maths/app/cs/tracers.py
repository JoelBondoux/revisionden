"""Standard algorithm tracers (OCR H446 2.3.1 (e) and (f), 1.4.2 (b) and (c)).

Each function returns every intermediate state, so a question about "the list after the second
pass" or "the value of mid in the third step" is answered by code. Conventions the specification
does not fix are chosen here, and a question that depends on one must state it:

- bubble sort stops after the first pass with no swaps;
- quick sort takes the first item as the pivot and keeps the others in their order;
- merge sort splits at ``len // 2`` (the left half is the smaller one);
- binary search uses ``mid = (low + high) DIV 2``;
- stacks and queues are arrays of a fixed size; a failed operation is recorded, not raised;
- Dijkstra and A* break ties alphabetically.
"""
import heapq
from dataclasses import dataclass, field


@dataclass
class SortRun:
    result: list
    passes: list = field(default_factory=list)
    swaps: int = 0
    merges: list = field(default_factory=list)
    partitions: list = field(default_factory=list)


def bubble_sort(items: list) -> SortRun:
    data, run = list(items), SortRun([])
    while True:
        swapped = False
        for i in range(len(data) - 1):
            if data[i] > data[i + 1]:
                data[i], data[i + 1] = data[i + 1], data[i]
                run.swaps += 1
                swapped = True
        run.passes.append(list(data))
        if not swapped:
            break
    run.result = data
    return run


def insertion_sort(items: list) -> SortRun:
    data, run = list(items), SortRun([])
    for i in range(1, len(data)):
        value, j = data[i], i - 1
        while j >= 0 and data[j] > value:
            data[j + 1] = data[j]
            j -= 1
        data[j + 1] = value
        run.passes.append(list(data))
    run.result = data
    return run


def merge_sort(items: list) -> SortRun:
    run = SortRun([])

    def sort(part: list) -> list:
        if len(part) <= 1:
            return list(part)
        middle = len(part) // 2
        left, right = sort(part[:middle]), sort(part[middle:])
        merged, i, j = [], 0, 0
        while i < len(left) and j < len(right):
            if left[i] <= right[j]:
                merged.append(left[i])
                i += 1
            else:
                merged.append(right[j])
                j += 1
        merged += left[i:] + right[j:]
        run.merges.append(merged)
        return merged

    run.result = sort(list(items))
    return run


def quick_sort(items: list) -> SortRun:
    run = SortRun([])

    def sort(part: list) -> list:
        if len(part) <= 1:
            return list(part)
        pivot, rest = part[0], part[1:]
        less = [x for x in rest if x < pivot]
        more = [x for x in rest if x >= pivot]
        run.partitions.append((pivot, less, more))
        return sort(less) + [pivot] + sort(more)

    run.result = sort(list(items))
    return run


@dataclass(frozen=True)
class Search:
    index: int
    comparisons: int = 0
    steps: tuple = ()


def linear_search(items: list, target) -> Search:
    for i, value in enumerate(items):
        if value == target:
            return Search(i, i + 1)
    return Search(-1, len(items))


@dataclass(frozen=True)
class BinarySearch:
    index: int
    steps: list  # (low, high, mid, items[mid]) at each step


def binary_search(items: list, target) -> BinarySearch:
    if list(items) != sorted(items):
        raise ValueError("binary search needs the data in order")
    low, high, steps = 0, len(items) - 1, []
    while low <= high:
        mid = (low + high) // 2
        steps.append((low, high, mid, items[mid]))
        if items[mid] == target:
            return BinarySearch(mid, steps)
        if items[mid] < target:
            low = mid + 1
        else:
            high = mid - 1
    return BinarySearch(-1, steps)


@dataclass
class StackRun:
    contents: list
    pointer: int  # index of the top item, -1 when empty
    removed: list = field(default_factory=list)
    peeked: list = field(default_factory=list)
    errors: list = field(default_factory=list)  # (operation number, "overflow" | "underflow")


def stack(operations: list, size: int) -> StackRun:
    run = StackRun([], -1)
    for n, op in enumerate(operations):
        if op[0] == "push":
            if len(run.contents) == size:
                run.errors.append((n, "overflow"))
            else:
                run.contents.append(op[1])
        elif op[0] in ("pop", "peek"):
            if not run.contents:
                run.errors.append((n, "underflow"))
            elif op[0] == "pop":
                run.removed.append(run.contents.pop())
            else:
                run.peeked.append(run.contents[-1])
        else:
            raise ValueError(f"unknown stack operation {op[0]!r}")
        run.pointer = len(run.contents) - 1
    return run


@dataclass
class QueueRun:
    contents: list
    front: int
    rear: int
    removed: list = field(default_factory=list)
    errors: list = field(default_factory=list)  # (operation number, "full" | "empty")


def queue(operations: list, size: int, circular: bool = True) -> QueueRun:
    """An array queue: ``front`` is the index of the first item, ``rear`` of the last."""
    slots, front, rear, count = [None] * size, 0, -1, 0
    run = QueueRun([], 0, -1)
    for n, op in enumerate(operations):
        if op[0] == "enqueue":
            full = count == size if circular else rear == size - 1
            if full:
                run.errors.append((n, "full"))
            else:
                rear = (rear + 1) % size if circular else rear + 1
                slots[rear] = op[1]
                count += 1
        elif op[0] == "dequeue":
            if count == 0:
                run.errors.append((n, "empty"))
            else:
                run.removed.append(slots[front])
                slots[front] = None
                front = (front + 1) % size if circular else front + 1
                count -= 1
        else:
            raise ValueError(f"unknown queue operation {op[0]!r}")
    run.contents = [slots[(front + i) % size] for i in range(count)]
    run.front, run.rear = front, rear
    return run


class BinarySearchTree:
    """Built by inserting values in order; a value already in the tree is not added again."""

    def __init__(self, values: list):
        self.root = None
        for value in values:
            self.insert(value)

    def insert(self, value):
        node = [value, None, None]
        if self.root is None:
            self.root = node
            return
        at = self.root
        while True:
            if value == at[0]:
                return
            side = 1 if value < at[0] else 2
            if at[side] is None:
                at[side] = node
                return
            at = at[side]

    def _walk(self, node, order: str, out: list) -> list:
        if node is None:
            return out
        if order == "pre":
            out.append(node[0])
        self._walk(node[1], order, out)
        if order == "in":
            out.append(node[0])
        self._walk(node[2], order, out)
        if order == "post":
            out.append(node[0])
        return out

    def pre_order(self) -> list:
        return self._walk(self.root, "pre", [])

    def in_order(self) -> list:
        return self._walk(self.root, "in", [])

    def post_order(self) -> list:
        return self._walk(self.root, "post", [])

    def breadth_first(self) -> list:
        out, waiting = [], [self.root] if self.root else []
        while waiting:
            node = waiting.pop(0)
            out.append(node[0])
            waiting += [child for child in node[1:] if child is not None]
        return out

    def search_path(self, value) -> list:
        """The values visited looking for ``value`` (ending where it is, or where it would be)."""
        path, at = [], self.root
        while at is not None:
            path.append(at[0])
            if value == at[0]:
                break
            at = at[1] if value < at[0] else at[2]
        return path


def _adjacency(edges: dict, directed: bool) -> dict:
    graph = {}
    for (a, b), weight in edges.items():
        if weight < 0:
            raise ValueError("edge weights cannot be negative")
        graph.setdefault(a, {})[b] = weight
        graph.setdefault(b, {})
        if not directed:
            graph[b][a] = weight
    return graph


@dataclass
class ShortestPaths:
    distances: dict
    previous: dict
    order: list

    def path_to(self, node):
        if self.distances.get(node) is None:
            return None
        path = [node]
        while self.previous.get(path[0]) is not None:
            path.insert(0, self.previous[path[0]])
        return path


def dijkstra(edges: dict, start, directed: bool = False) -> ShortestPaths:
    """``edges`` maps (from, to) to a weight. ``order`` is the order nodes are visited."""
    graph = _adjacency(edges, directed)
    distances = {node: None for node in sorted(graph)}
    previous = {node: None for node in graph}
    distances[start] = 0
    waiting, done, order = [(0, start)], set(), []
    while waiting:
        dist, node = heapq.heappop(waiting)
        if node in done:
            continue
        done.add(node)
        order.append(node)
        for neighbour, weight in sorted(graph[node].items()):
            new = dist + weight
            if distances[neighbour] is None or new < distances[neighbour]:
                distances[neighbour], previous[neighbour] = new, node
                heapq.heappush(waiting, (new, neighbour))
    return ShortestPaths(distances, previous, order)


@dataclass
class AStarRun:
    order: list
    path: list | None
    cost: int | None


def a_star(edges: dict, start, goal, heuristic: dict, directed: bool = False) -> AStarRun:
    """Expands the open node with the lowest f = g + h (ties alphabetically) until the goal."""
    graph = _adjacency(edges, directed)
    g, previous = {start: 0}, {start: None}
    waiting, done, order = [(heuristic[start], start)], set(), []
    while waiting:
        _, node = heapq.heappop(waiting)
        if node in done:
            continue
        done.add(node)
        order.append(node)
        if node == goal:
            path = [goal]
            while previous[path[0]] is not None:
                path.insert(0, previous[path[0]])
            return AStarRun(order, path, g[goal])
        for neighbour, weight in sorted(graph[node].items()):
            new = g[node] + weight
            if neighbour not in g or new < g[neighbour]:
                g[neighbour], previous[neighbour] = new, node
                heapq.heappush(waiting, (new + heuristic[neighbour], neighbour))
    return AStarRun(order, None, None)
