"""Fact proofs for the fact-check stage (decision 0009, docs/VERIFICATION.md step 4b).

Each check kind proves a standard maths fact an item rests on, without AI:

- ``transformation``: ``graph`` (y = ..., in terms of f(...)) is the image of y = f(x) under
  ``image``, the point (x, y) goes to. Proved symbolically for an unknown f, then on sampled
  functions and constants, and the image must reach every x (so it is the whole graph).
- ``implication``: the ``given`` inequalities always give ``then``. Sampled for counterexamples,
  then proved by writing each given as a positive gap (b = a + p, c = -q with p, q > 0).
- ``sign_change``: ``function`` of x is continuous on ``interval`` and changes sign, and a root
  is found between the ends (root location, the intermediate value theorem on this function).
- ``parallel``: two ``lines``. With ``parallel`` (true or false) the lines are checked to be so;
  without it, the lines have letters for gradients and the engine proves they meet at one point
  exactly when the gradients differ.
- ``trig_value``: exact value of sin, cos or tan at whole ``degrees``, or ``undefined``.
- ``graph_measure``: the units of the ``gradient`` (y per x) or ``area`` (y times x) of a graph
  of ``y`` against ``x`` are the units of ``is`` (for example distance-time: gradient is speed).
"""

import random
import re

from sympy import (
    EmptySet,
    Expr,
    Function,
    Pow,
    Interval,
    Symbol,
    cos,
    denom,
    factor_list,
    lambdify,
    nan,
    nsimplify,
    pi,
    simplify,
    sin,
    solve,
    solveset,
    tan,
    together,
    zoo,
)
from sympy.calculus.util import continuous_domain

from app.equivalence import parse

SEED = 20261125
SAMPLES = 4000
MIN_SATISFYING = 200


def _split_pair(text: str) -> tuple[str, str]:
    inner = text.strip()
    if not (inner.startswith("(") and inner.endswith(")")):
        raise ValueError(f"write the image as a point (X, Y): {text!r}")
    inner = inner[1:-1]
    depth = 0
    for i, ch in enumerate(inner):
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and depth == 0:
            return inner[:i], inner[i + 1:]
    raise ValueError(f"write the image as a point (X, Y): {text!r}")


SAMPLE_FUNCTIONS = ["x^3 - 2x + 1", "sin(x) + x/3", "exp(x/4)"]
SAMPLE_CONSTANTS = [-3, -1.5, -0.5, 0.5, 2, 3.7]
SAMPLE_X = [-2.3, -0.7, 0.4, 1.9]


def transformation(check: dict) -> str | None:
    f = Function("f")
    x, y = Symbol("x"), Symbol("y")
    graph = parse(check["graph"], functions={"f": f})
    if not graph.atoms(f):
        raise ValueError("the graph must be written with f, for example f(x - a)")
    left, right = _split_pair(check["image"])
    big_x, big_y = parse(left), parse(right)
    on_graph = {y: f(x)}
    wrong = f"y = {check['graph']} is not the image of y = f(x) under (x, y) -> {check['image']}"
    # Symbolically, for an unknown f: the image point lies on the new graph.
    if simplify(graph.subs(x, big_x.subs(on_graph)) - big_y.subs(on_graph)) != 0:
        return wrong
    constants = (graph.free_symbols | big_x.free_symbols | big_y.free_symbols) - {x, y}
    for text in SAMPLE_FUNCTIONS:
        concrete = parse(text)
        for value in SAMPLE_CONSTANTS:
            values = {c: value for c in constants}
            g = graph.subs(values).replace(f, lambda arg: concrete.subs(x, arg))
            gx, gy = big_x.subs(values), big_y.subs(values)
            slope = gx.diff(x)
            if slope.free_symbols or slope == 0:
                return f"{check['image']} does not reach every x, so it is not the whole graph"
            for x0 in SAMPLE_X:
                fy = concrete.subs(x, x0)
                px, py = gx.subs(x, x0), gy.subs({x: x0, y: fy})
                if abs(complex(g.subs(x, px) - py)) > 1e-9:
                    return wrong
    return None


RELATION = re.compile(r"\s*(<=|>=|<|>)\s*")


def _relation(text: str) -> tuple[Expr, str, Expr]:
    parts = RELATION.split(text)
    if len(parts) != 3:
        raise ValueError(f"write one inequality with <, >, <= or >=: {text!r}")
    return parse(parts[0]), parts[1], parse(parts[2])


def _holds(lhs: float, op: str, rhs: float) -> bool:
    return {"<": lhs < rhs, ">": lhs > rhs, "<=": lhs <= rhs, ">=": lhs >= rhs}[op]


def _sampled_counterexample(given, then, symbols, rng) -> dict | None:
    fast = [(lambdify(symbols, l), op, lambdify(symbols, r)) for l, op, r in [*given, then]]
    *conditions, (then_l, then_op, then_r) = fast
    satisfying = 0
    for _ in range(SAMPLES):
        values = [rng.uniform(-10, 10) for _ in symbols]
        if not all(_holds(l(*values), op, r(*values)) for l, op, r in conditions):
            continue
        satisfying += 1
        try:
            if not _holds(then_l(*values), then_op, then_r(*values)):
                return dict(zip(symbols, values))
        except ZeroDivisionError:
            continue
    if satisfying < MIN_SATISFYING:
        raise ValueError("too few sampled values satisfy the given inequalities")
    return None


def _symbolic_proof(given, then) -> bool:
    """Write each given as a positive gap, then ask SymPy for the sign of the conclusion."""
    subs: dict = {}
    for k, (lhs, op, rhs) in enumerate(given):
        lhs, rhs = lhs.subs(subs), rhs.subs(subs)
        small, big = (lhs, rhs) if op in ("<", "<=") else (rhs, lhs)
        gap = Symbol(f"gap{k}", positive=True) if op in ("<", ">") else Symbol(
            f"gap{k}", nonnegative=True)
        if isinstance(big, Symbol) and big not in small.free_symbols:
            subs = {s: v.subs(big, small + gap) for s, v in subs.items()}
            subs[big] = small + gap
        elif isinstance(small, Symbol) and small not in big.free_symbols:
            subs = {s: v.subs(small, big - gap) for s, v in subs.items()}
            subs[small] = big - gap
        else:
            return False
    lhs, op, rhs = then
    difference = simplify((lhs - rhs).subs(subs))
    if op in ("<", "<="):
        difference = -difference
    return bool(difference.is_positive if op in ("<", ">") else difference.is_nonnegative)


def implication(check: dict) -> str | None:
    given = [_relation(g) for g in check["given"]]
    then = _relation(check["then"])
    symbols = sorted(
        set().union(*(l.free_symbols | r.free_symbols for l, _, r in [*given, then])), key=str)
    point = _sampled_counterexample(given, then, symbols, random.Random(SEED))
    if point is not None:
        shown = ", ".join(f"{s} = {v:.3g}" for s, v in point.items())
        return f"counterexample to {check['then']}: {shown}"
    if not _symbolic_proof(given, then):
        return f"could not prove {check['then']} symbolically (no counterexample was found)"
    return None


def sign_change(check: dict) -> str | None:
    x = Symbol("x")
    f = parse(check["function"])
    a, b = (parse(v) for v in check["interval"])
    interval = Interval(a, b)
    # Parsing cancels x^2/x to x, so look for division by zero in the expression as written.
    written = parse(check["function"], evaluate=False)
    divides_by_zero = any(
        power.exp.is_negative and solveset(power.base, x, interval) != EmptySet
        for power in written.atoms(Pow)
    )
    if divides_by_zero or not interval.is_subset(continuous_domain(f, x, interval)):
        return f"{check['function']} is not continuous on [{a}, {b}]"
    fa, fb = f.subs(x, a), f.subs(x, b)
    if not (fa * fb).is_negative:
        return f"f({a}) and f({b}) have the same sign (or one is zero): no sign change"
    lo, hi = float(a), float(b)
    for _ in range(200):  # bisection finds the root the sign change promises
        mid = (lo + hi) / 2
        if (float(f.subs(x, lo)) < 0) == (float(f.subs(x, mid)) < 0):
            lo = mid
        else:
            hi = mid
    if abs(float(f.subs(x, (lo + hi) / 2))) > 1e-9:
        return f"no root of {check['function']} was found between {a} and {b}"
    return None


def _line(text: str):
    x, y = Symbol("x"), Symbol("y")
    sides = text.split("=")
    if len(sides) != 2:
        raise ValueError(f"a line needs one = sign: {text!r}")
    equation = parse(sides[0]) - parse(sides[1])
    if equation.diff(y) == 0:
        return equation, None  # vertical: x = k
    gradient = simplify(-equation.diff(x) / equation.diff(y))
    if (gradient.free_symbols & {x, y}) or (equation.diff(y).free_symbols & {x, y}):
        raise ValueError(f"not a straight line: {text!r}")
    return equation, gradient


def parallel(check: dict) -> str | None:
    x, y = Symbol("x"), Symbol("y")
    (e1, g1), (e2, g2) = (_line(t) for t in check["lines"])
    if "parallel" in check:
        same = (g1 is None and g2 is None) or (
            g1 is not None and g2 is not None and simplify(g1 - g2) == 0)
        points = solve([e1, e2], [x, y], dict=True)
        meets_once = len(points) == 1 and set(points[0]) == {x, y}
        if same == meets_once:
            raise ValueError("the gradients and the intersection disagree")
        if same != bool(check["parallel"]):
            return f"the lines {'are' if same else 'are not'} parallel"
        return None
    if g1 is None or g2 is None or simplify(g1 - g2) == 0:
        raise ValueError("give two lines with letters for different gradients")
    point = solve([e1, e2], [x, y], dict=True)
    if len(point) != 1 or set(point[0]) != {x, y}:
        return "the lines do not meet at one point for general gradients"
    # The point exists whenever the gradients differ: every factor of its denominators
    # vanishes only where they are equal (a shared intercept cancels to a constant).
    gap = g1 - g2
    for coordinate in point[0].values():
        for factor in factor_list(denom(together(coordinate)))[1]:
            ratio = simplify(factor[0] / gap)
            if factor[0].free_symbols and (ratio == 0 or ratio.free_symbols):
                return "the lines can fail to meet when their gradients differ"
    # And when the gradients are equal, they never meet at exactly one point.
    letters = sorted(g2.free_symbols - g1.free_symbols, key=str)
    if not letters:
        raise ValueError("give the second line its own letter for the gradient")
    equal = {letters[0]: solve(gap, letters[0])[0]}
    same = solve([e1, e2.subs(equal)], [x, y], dict=True)
    if len(same) == 1 and set(same[0]) == {x, y}:
        return "the lines still meet at one point when their gradients are equal"
    return None


TRIG = {"sin": sin, "cos": cos, "tan": tan}


def trig_value(check: dict) -> str | None:
    function = TRIG.get(check["function"])
    if function is None:
        raise ValueError("function must be sin, cos or tan")
    angle = nsimplify(check["degrees"]) * pi / 180
    value = function(angle)
    undefined = value.has(zoo) or value.has(nan)
    shown = f"{check['function']} {check['degrees']}°"
    if check["value"] == "undefined":
        return None if undefined else f"{shown} is not undefined (it is {value})"
    if undefined or simplify(value - parse(check["value"])) != 0:
        return f"{shown} is not {check['value']}"
    return None


# Units as powers of length (L) and time (T).
QUANTITIES = {
    "distance": {"L": 1},
    "displacement": {"L": 1},
    "height": {"L": 1},
    "time": {"T": 1},
    "speed": {"L": 1, "T": -1},
    "velocity": {"L": 1, "T": -1},
    "acceleration": {"L": 1, "T": -2},
}


def _units(name: str) -> dict:
    if name not in QUANTITIES:
        raise ValueError(f"unknown quantity {name!r}: use one of {', '.join(QUANTITIES)}")
    return QUANTITIES[name]


def _combine(a: dict, b: dict, sign: int) -> dict:
    out = dict(a)
    for k, v in b.items():
        out[k] = out.get(k, 0) + sign * v
    return {k: v for k, v in out.items() if v}


def graph_measure(check: dict) -> str | None:
    y, x, meaning = _units(check["y"]), _units(check["x"]), _units(check["is"])
    measure = check["measure"]
    if measure not in ("gradient", "area"):
        raise ValueError("measure must be gradient or area")
    got = _combine(y, x, -1 if measure == "gradient" else 1)
    if got != meaning:
        return (f"the {measure} of a {check['y']}-{check['x']} graph has units {got}, "
                f"not the units of {check['is']} {meaning}")
    return None


KINDS = {
    "transformation": transformation,
    "implication": implication,
    "sign_change": sign_change,
    "parallel": parallel,
    "trig_value": trig_value,
    "graph_measure": graph_measure,
}
