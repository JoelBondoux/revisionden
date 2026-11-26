"""Pilot templates for Pearson Edexcel GCSE Mathematics (1MA1), Higher tier.

Each citation is copied exactly from items already in the same topic whose quote check passed
(docs/VERIFICATION.md); a test checks that, so no citation is new.
"""

import re
from math import gcd
from decimal import Decimal
from fractions import Fraction

from sympy import Poly, Symbol, expand, solve

from app.equivalence import parse, parse_equation
from app.templates.core import IntParam, Rule, Template
from app.templates.text import bracket, linear, polynomial, signed_term, sum_of, times

X, Y = Symbol("x"), Symbol("y")

_SPEC = {
    "source_type": "specification",
    "publisher": "Pearson Edexcel",
    "title": "Pearson Edexcel Level 1/Level 2 GCSE (9–1) in Mathematics (1MA1) Specification",
    "document_ref": "1MA1 Issue 2 (June 2015)",
    "url": "https://qualifications.pearson.com/content/dam/pdf/GCSE/mathematics/2015/"
           "specification-and-sample-assesment/gcse-maths-2015-specification.pdf",
}
_SHA = "c30745f274663c5f910e3706ea836c6f7e95e0a00ff38eac860622232ed84f8b"
_HIGHER = "Higher tier knowledge, skills and understanding"


def _cite(location: str, quote: str, retrieved_at: str) -> dict:
    return {**_SPEC, "location": f"{_HIGHER}, {location}", "quote": quote,
            "retrieved_at": retrieved_at, "supports": ["question"], "sha256": _SHA}


def _ref(code: str) -> str:
    return f"Pearson Edexcel GCSE Mathematics (1MA1) content reference {code}"


def _mono(coef: int, letter: str = "") -> str:
    return signed_term(coef, letter, first=True)


def _same(a, b) -> bool:
    return expand(a - b) == 0


# --- A4: expanding two binomials -----------------------------------------------------------

def _brackets_write(p: dict) -> dict:
    a, b, m, n = p["a"], p["b"], p["p"], p["q"]
    expr = f"({linear(a, m)})({linear(b, n)})"
    coefs = [int(c) for c in Poly(expand((a * X + m) * (b * X + n)), X).all_coeffs()]
    answer = polynomial(coefs)
    four = sum_of([(a * b, "x^2"), (a * n, "x"), (m * b, "x"), (m * n, "")])
    ax, bx = _mono(a, "x"), _mono(b, "x")
    products = (f"{ax} × {bx} = {_mono(a * b, 'x^2')}, {ax} × {bracket(n)} = {_mono(a * n, 'x')}, "
                f"{bracket(m)} × {bx} = {_mono(m * b, 'x')} and {bracket(m)} × {bracket(n)} = "
                f"{m * n}")
    middle = sum_of([(a * n, "x"), (m * b, "x")])
    simple = a == b == 1
    return {
        "difficulty": 2 if simple else 3,
        "expected_seconds": 60 if simple else 90,
        "prompt": f"Expand and simplify {expr}. Use the Power key (^) for powers.",
        "answer": {"expression": answer},
        "verify": {"method": "expression", "expression": expr, "form": "expanded"},
        "steps": [expr, four, answer],
        "mark_scheme": ["M1 for at least three of the four terms correct", f"A1 for {answer}"],
        "hint": "Multiply each term in the first bracket by each term in the second bracket, "
                "then collect the x terms.",
        "explanation": (f"Multiply each term in the first bracket by each term in the second: "
                        f"{products}. Collect the x terms: {middle} = {_mono(coefs[1], 'x')}. "
                        f"So {expr} = {answer}."),
    }


def _brackets_recheck(p: dict, item: dict) -> list[str]:
    a, b, m, n = p["a"], p["b"], p["p"], p["q"]
    errors = []
    match = re.fullmatch(r"Expand and simplify (\(.+\)\(.+\))\. Use the Power key \(\^\) for powers\.",
                         item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    shown = parse(match.group(1), exact=True)
    if not _same(shown, (a * X + m) * (b * X + n)):
        errors.append(f"the question shows {match.group(1)}, not the parameters' brackets")
    if item["verify"]["expression"] != match.group(1):
        errors.append("verify.expression is not the expression in the question")
    # The expansion by the grid method, in whole numbers (no SymPy expand).
    expected = [a * b, a * n + b * m, m * n]
    got = Poly(parse(item["answer"]["expression"], exact=True), X).all_coeffs()
    if [int(c) for c in got] != expected:
        errors.append(f"answer {item['answer']['expression']} has coefficients {got}, "
                      f"expected {expected}")
    return errors


EXPAND_DOUBLE_BRACKETS = Template(
    id="gcse-maths-h-a4-double-brackets",
    version=2,  # v2: "Use the Power key (^) for powers." (F9, #254)
    topic="gcse-maths-h-a4",
    learning_point="gcse-maths-h-a4-lp-expand",
    type="worked_maths",
    difficulty=2,
    expected_seconds=60,
    marks=2,
    source_ref=_ref("A4"),
    citations=(_cite("2. Algebra, Notation, vocabulary and manipulation, content reference A4 "
                     "(page 14; PDF page 26)", "expanding products of two or more binomials",
                     "2026-11-24"),),
    params=(IntParam("a", 1, 2), IntParam("b", 1, 3), IntParam("p", -9, 9, exclude=(0,)),
            IntParam("q", -9, 9, exclude=(0,))),
    rules=(
        Rule("the x terms do not cancel", lambda p: p["a"] * p["q"] + p["b"] * p["p"] != 0),
        Rule("the first bracket has the smaller x coefficient", lambda p: p["a"] <= p["b"]),
        Rule("the brackets are different", lambda p: (p["a"], p["p"]) != (p["b"], p["q"])),
        Rule("neither bracket has a common factor",
             lambda p: gcd(p["a"], p["p"]) == 1 and gcd(p["b"], p["q"]) == 1),
    ),
    write=_brackets_write,
    recheck=_brackets_recheck,
)


# --- A17: linear equations with the unknown on both sides ----------------------------------

def _rhs(p: dict) -> int:
    return (p["a"] - p["c"]) * p["s"] + p["b"]


def _linear_write(p: dict) -> dict:
    a, b, c, s = p["a"], p["b"], p["c"], p["s"]
    d, k = _rhs(p), p["a"] - p["c"]
    equation = f"{linear(a, b)} = {linear(c, d)}"
    collected = f"{linear(k, b)} = {d}"
    isolated = f"{_mono(k, 'x')} = {d - b}"
    move = f"Add {-b} to" if b < 0 else f"Subtract {b} from"
    return {
        "difficulty": 3 if s < 0 else 2,
        "prompt": f"Solve {equation}",
        "answer": {"solutions": [str(s)]},
        "verify": {"method": "solve", "equation": equation, "variable": "x"},
        "steps": [equation, collected, isolated, f"x = {s}"],
        "mark_scheme": [f"M1 for {collected} or {isolated}", f"A1 for x = {s}"],
        "hint": "Get the x terms on one side and the numbers on the other side.",
        "explanation": (f"Subtract {_mono(c, 'x')} from both sides: {collected}. {move} both "
                        f"sides: {isolated}. Divide both sides by {k}: x = {s}. Check: "
                        f"{times(a, s)} {signed_term(b, '', False)} = {a * s + b} and "
                        f"{times(c, s)} {signed_term(d, '', False)} = {c * s + d}."),
    }


def _linear_recheck(p: dict, item: dict) -> list[str]:
    a, b, c, s = p["a"], p["b"], p["c"], p["s"]
    match = re.fullmatch(r"Solve (.+) = (.+)", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    errors = []
    left, right = parse(match.group(1), exact=True), parse(match.group(2), exact=True)
    if not (_same(left, a * X + b) and _same(right, c * X + _rhs(p))):
        errors.append(f"the question shows {match.group(1)} = {match.group(2)}, not the "
                      "parameters' equation")
    if item["verify"]["equation"] != f"{match.group(1)} = {match.group(2)}":
        errors.append("verify.equation is not the equation in the question")
    roots = solve(left - right, X)
    if roots != [s] or item["answer"]["solutions"] != [str(s)]:
        errors.append(f"the equation's solutions are {roots}, the answer says "
                      f"{item['answer']['solutions']}")
    return errors


LINEAR_BOTH_SIDES = Template(
    id="gcse-maths-h-a17-unknown-both-sides",
    version=1,
    topic="gcse-maths-h-a17",
    learning_point="gcse-maths-h-a17-lp-solve-linear",
    type="worked_maths",
    difficulty=2,
    expected_seconds=50,
    marks=2,
    source_ref=_ref("A17"),
    citations=(_cite("2. Algebra, Solving equations and inequalities, content reference A17 "
                     "(page 15; PDF page 27)",
                     "solve linear equations in one unknown algebraically (including those with "
                     "the unknown on both sides of the equation)", "2026-11-25"),),
    params=(IntParam("a", 3, 9), IntParam("c", 1, 7), IntParam("b", -12, 12, exclude=(0,)),
            IntParam("s", -6, 9, exclude=(0,))),
    rules=(
        Rule("x is left with a coefficient of at least 2", lambda p: p["a"] - p["c"] >= 2),
        Rule("the right-hand number is not zero", lambda p: _rhs(p) != 0),
        Rule("the right-hand number is at most 40 in size", lambda p: abs(_rhs(p)) <= 40),
    ),
    write=_linear_write,
    recheck=_linear_recheck,
)


# --- A19: simultaneous linear equations by elimination -------------------------------------

def _system(p: dict) -> tuple[int, int, int, int, int, int]:
    a1, b1, a2 = p["a1"], p["b1"], p["a2"]
    b2 = b1 if p["same"] else -b1
    x0, y0 = p["x0"], p["y0"]
    return a1, b1, a1 * x0 + b1 * y0, a2, b2, a2 * x0 + b2 * y0


def _eq(a: int, b: int, c: int) -> str:
    return f"{sum_of([(a, 'x'), (b, 'y')])} = {c}"


def _elimination_write(p: dict) -> dict:
    a1, b1, c1, a2, b2, c2 = _system(p)
    x0, y0 = p["x0"], p["y0"]
    first, second = _eq(a1, b1, c1), _eq(a2, b2, c2)
    if p["same"]:
        how, k, cx = "Subtract the second equation from the first", a1 - a2, c1 - c2
    else:
        how, k, cx = "Add the equations", a1 + a2, c1 + c2
    rest = c1 - a1 * x0
    y_step = f"so y = {rest}" if b1 == 1 else f"so {b1}y = {rest} and y = {y0}"
    check = f"{times(a2, x0)} {'+' if b2 > 0 else '-'} {times(abs(b2), y0)} = {c2}"
    return {
        "difficulty": 3 if p["same"] else 2,
        "prompt": f"Solve the simultaneous equations {first} and {second}.",
        "answer": {"accepted": [f"x = {x0}, y = {y0}"], "any_order": True},
        "hint": ("The y terms are the same, so subtract one equation from the other to make y "
                 "disappear." if p["same"] else
                 "The y terms have opposite signs, so add the equations to make y disappear."),
        "explanation": (f"{how} to eliminate y: {_mono(k, 'x')} = {cx}, so x = {x0}. Substitute "
                        f"x = {x0} into {first}: {a1 * x0} {signed_term(b1, 'y', False)} = {c1}, "
                        f"{y_step}. Check in {second}: {check}."),
    }


def _elimination_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"Solve the simultaneous equations (.+) and (.+)\.", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    errors = []
    a1, b1, c1, a2, b2, c2 = _system(p)
    shown = [parse_equation(match.group(1)), parse_equation(match.group(2))]
    if not (_same(shown[0], a1 * X + b1 * Y - c1) and _same(shown[1], a2 * X + b2 * Y - c2)):
        errors.append("the question's equations are not the parameters' equations")
    solutions = solve(shown, [X, Y], dict=True)
    answer = re.fullmatch(r"x = (-?\d+), y = (-?\d+)", item["answer"]["accepted"][0])
    if len(solutions) != 1 or not answer:
        return [*errors, f"expected one solution in the form x = a, y = b, got {solutions}"]
    if (solutions[0][X], solutions[0][Y]) != (int(answer.group(1)), int(answer.group(2))):
        errors.append(f"the equations solve to {solutions[0]}, the answer says "
                      f"{item['answer']['accepted'][0]}")
    return errors


SIMULTANEOUS_ELIMINATION = Template(
    id="gcse-maths-h-a19-elimination",
    version=2,  # v2: the hint names the one operation that removes y (adversarial review)
    topic="gcse-maths-h-a19",
    learning_point="gcse-maths-h-a19-lp-linear-linear",
    type="short_answer",
    difficulty=2,
    expected_seconds=120,
    marks=3,
    source_ref=_ref("A19"),
    citations=(_cite("2. Algebra, Solving equations and inequalities, content reference A19 "
                     "(page 15; PDF page 27)",
                     "solve two simultaneous equations in two variables (linear/linear or "
                     "linear/quadratic) algebraically", "2026-11-25"),),
    params=(IntParam("a1", 1, 6), IntParam("b1", 1, 5), IntParam("a2", 1, 6),
            IntParam("same", 0, 1), IntParam("x0", -5, 6, exclude=(0,)),
            IntParam("y0", -5, 6, exclude=(0,))),
    rules=(
        Rule("eliminating y leaves at least 2x",
             lambda p: (p["a1"] - p["a2"] if p["same"] else p["a1"] + p["a2"]) >= 2),
        Rule("x and y have different values", lambda p: p["x0"] != p["y0"]),
        Rule("no equation has 0 on the right", lambda p: 0 not in (_system(p)[2], _system(p)[5])),
        Rule("the numbers on the right are at most 40 in size",
             lambda p: max(abs(_system(p)[2]), abs(_system(p)[5])) <= 40),
    ),
    write=_elimination_write,
    recheck=_elimination_recheck,
)


# --- N12: percentage increase and decrease with a multiplier -------------------------------

def _decimal(value: Fraction) -> str:
    text = format(Decimal(value.numerator) / Decimal(value.denominator), "f")
    return text.rstrip("0").rstrip(".") if "." in text else text


def _percent_write(p: dict) -> dict:
    amount, pct, up = p["amount"], p["percent"], p["up"] == 1
    whole = 100 + pct if up else 100 - pct
    multiplier = _decimal(Fraction(whole, 100))
    change = amount * pct // 100
    new = amount * whole // 100
    word, sign, op = ("increased", "+", "plus") if up else ("decreased", "-", "minus")
    return {
        "prompt": f"A price of £{amount} is {word} by {pct}%. Work out the new price.",
        "answer": {"value": str(new), "unit": "£"},
        "verify": {"expression": f"{amount} * {whole}/100"},
        "mark_scheme": [f"M1 for {amount} × {multiplier}, or {pct}% of {amount} = {change}",
                        f"A1 for {new}"],
        "hint": f"Work out the multiplier: 100% {op} {pct}%, written as a decimal.",
        "explanation": (f"The new price is 100% {sign} {pct}% = {whole}% of the old price. "
                        f"{whole}% as a decimal is {multiplier}, so multiply by {multiplier}: "
                        f"£{amount} × {multiplier} = £{new}. Check: {pct}% of £{amount} is "
                        f"£{change}, and £{amount} {sign} £{change} = £{new}."),
    }


def _percent_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"A price of £(\d+) is (increased|decreased) by (\d+)%\. Work out the "
                         r"new price\.", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    amount, pct = int(match.group(1)), int(match.group(3))
    up = match.group(2) == "increased"
    errors = []
    if (amount, pct, up) != (p["amount"], p["percent"], p["up"] == 1):
        errors.append("the question's numbers are not the parameters")
    # Percentage of the amount, then add or take it away, in exact fractions.
    change = Fraction(amount) * pct / 100
    expected = amount + change if up else amount - change
    if Fraction(item["answer"]["value"]) != expected or item["answer"].get("unit") != "£":
        errors.append(f"answer £{item['answer']['value']} is not £{expected}")
    return errors


PERCENTAGE_CHANGE = Template(
    id="gcse-maths-h-n12-percentage-change",
    version=1,
    topic="gcse-maths-h-n12",
    learning_point="gcse-maths-h-n12-lp-percentage-operator",
    type="numeric",
    difficulty=2,
    expected_seconds=60,
    marks=2,
    source_ref=_ref("N12"),
    citations=(_cite("1. Number, Fractions, decimals and percentages, content reference N12 "
                     "(page 13; PDF page 25)", "interpret fractions and percentages as operators",
                     "2026-11-25"),),
    params=(IntParam("amount", 20, 900, step=20), IntParam("percent", 5, 45, step=5),
            IntParam("up", 0, 1)),
    rules=(
        Rule("the new price is a whole number of pounds",
             lambda p: p["amount"] * p["percent"] % 100 == 0),
    ),
    write=_percent_write,
    recheck=_percent_recheck,
)


# --- N9: multiplying numbers in standard form ----------------------------------------------

def _standard(value: Fraction) -> tuple[Fraction, int]:
    """value = mantissa × 10^shift with 1 ≤ mantissa < 10 (for 1 ≤ value < 100)."""
    return (value / 10, 1) if value >= 10 else (value, 0)


def _standard_write(p: dict) -> dict:
    a, b = Fraction(p["at"], 10), Fraction(p["bt"], 10)
    m, n = p["m"], p["n"]
    sa, sb = _decimal(a), _decimal(b)
    product = a * b
    mantissa, shift = _standard(product)
    sp, sm, power = _decimal(product), _decimal(mantissa), m + n + shift
    answer = f"{sm} × 10^{power}"
    steps = [f"({sa} × 10^{m}) × ({sb} × 10^{n})", f"({sa} × {sb}) × 10^({m}+{n})",
             f"{sp} × 10^{m + n}"]
    explanation = (f"Multiply the numbers: {sa} × {sb} = {sp}. To multiply powers of 10, add "
                   f"their indices: 10^{m} × 10^{n} = 10^({m} + {n}) = 10^{m + n}. This gives "
                   f"{sp} × 10^{m + n}.")
    if shift:
        steps.append(answer)
        explanation += (f" In standard form the first number is at least 1 and less than 10. "
                        f"{sp} = {sm} × 10^1, so {sp} × 10^{m + n} = {sm} × 10^1 × 10^{m + n} = "
                        f"{sm} × 10^{power}.")
        ordinary = f"{int(product * 10 ** (m + n)):,}".replace(",", " ")
        mark = f"M1 for {sp} × 10^{m + n} or {ordinary}"
    else:
        explanation += f" {sp} is at least 1 and less than 10, so this is already standard form."
        mark = f"M1 for {sa} × {sb} = {sp} or 10^{m} × 10^{n} = 10^{m + n}"
    return {
        "difficulty": 3 if shift else 2,
        "expected_seconds": 100 if shift else 80,
        "prompt": f"Work out ({sa} × 10^{m}) × ({sb} × 10^{n}). Give your answer in standard form.",
        "answer": {"expression": answer, "form": "standard_form"},
        "verify": {"method": "expression", "expression": steps[0]},
        "steps": steps,
        "mark_scheme": [mark, f"A1 for {sm} × 10^{power}"],
        "hint": "Multiply the numbers, then multiply the powers of 10 by adding their indices.",
        "explanation": explanation,
    }


def _standard_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"Work out \((\S+) × 10\^(\d+)\) × \((\S+) × 10\^(\d+)\)\. Give your "
                         r"answer in standard form\.", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    a, m, b, n = Fraction(match.group(1)), int(match.group(2)), Fraction(match.group(3)), int(
        match.group(4))
    errors = []
    if (a, b, m, n) != (Fraction(p["at"], 10), Fraction(p["bt"], 10), p["m"], p["n"]):
        errors.append("the question's numbers are not the parameters")
    answer = re.fullmatch(r"(\d+(?:\.\d+)?) × 10\^(\d+)", item["answer"]["expression"])
    if not answer:
        return [*errors, f"answer {item['answer']['expression']} is not written A × 10^n"]
    mantissa, power = Fraction(answer.group(1)), int(answer.group(2))
    if not 1 <= mantissa < 10:
        errors.append(f"answer {item['answer']['expression']} is not in standard form")
    if mantissa * Fraction(10) ** power != a * b * Fraction(10) ** (m + n):
        errors.append(f"answer {item['answer']['expression']} is not the product")
    return errors


STANDARD_FORM_MULTIPLY = Template(
    id="gcse-maths-h-n9-standard-form-multiply",
    version=5,  # v2: indices; v3: M1 ordinary number; v4: answer.form; v5: × not * (review)
    topic="gcse-maths-h-n9",
    learning_point="gcse-maths-h-n9-lp-calculate",
    type="worked_maths",
    difficulty=3,
    expected_seconds=100,
    marks=2,
    source_ref=_ref("N9"),
    citations=(
        _cite("1. Number, Structure and calculation, content reference N9 (page 12; PDF page 24)",
              "calculate with and interpret standard form", "2026-11-25"),
        _cite("1. Number, Structure and calculation, content reference N9 (page 12; PDF page 24)",
              "where 1 ≤ A < 10 and n is an integer", "2026-11-25"),
    ),
    params=(IntParam("at", 11, 99), IntParam("bt", 11, 99), IntParam("m", 2, 9),
            IntParam("n", 2, 9)),
    rules=(
        Rule("one number is a whole number", lambda p: p["at"] % 10 == 0 or p["bt"] % 10 == 0),
        Rule("the numbers are different", lambda p: p["at"] != p["bt"]),
    ),
    write=_standard_write,
    recheck=_standard_recheck,
)


# --- A18: quadratic equations by factorising -------------------------------------------------

def _quadratic_write(p: dict) -> dict:
    r1, r2 = p["r1"], p["r2"]
    b, c = -(r1 + r2), r1 * r2
    equation = f"{polynomial([1, b, c])} = 0"
    first, second = linear(1, -r1), linear(1, -r2)
    factorised = f"({first})({second}) = 0"
    return {
        "difficulty": 3 if (r1 < 0 and r2 < 0) else 2,
        "prompt": f"Solve {equation} by factorising.",
        "answer": {"solutions": [str(r1), str(r2)]},
        "verify": {"method": "solve", "equation": equation, "variable": "x"},
        "steps": [equation, factorised, f"x = {r1} or x = {r2}"],
        "mark_scheme": [f"M1 for ({first})({second})", f"A1 for both x = {r1} and x = {r2}"],
        "hint": f"Find two numbers that multiply to give {c} and add to give {b}.",
        "explanation": (f"Find two numbers that multiply to give {c} and add to give {b}: "
                        f"{-r1} and {-r2}, because {bracket(-r1)} × {bracket(-r2)} = {c} and "
                        f"{-r1} + {bracket(-r2)} = {b}. So {factorised}. One of the brackets "
                        f"must be 0: {first} = 0 gives x = {r1}, and {second} = 0 gives "
                        f"x = {r2}."),
    }


def _quadratic_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"Solve (.+) = 0 by factorising\.", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    errors = []
    shown = parse(match.group(1), exact=True)
    if not _same(shown, (X - p["r1"]) * (X - p["r2"])):
        errors.append(f"the question shows {match.group(1)}, not the parameters' quadratic")
    roots = set(solve(shown, X))
    given = {parse(s, exact=True) for s in item["answer"]["solutions"]}
    if roots != given or len(item["answer"]["solutions"]) != 2:
        errors.append(f"the equation's solutions are {roots}, the answer says "
                      f"{item['answer']['solutions']}")
    return errors


QUADRATIC_FACTORISING = Template(
    id="gcse-maths-h-a18-quadratic-factorising",
    version=3,  # v2: one A1 for both roots; v3: "by factorising" in the question (review)
    topic="gcse-maths-h-a18",
    learning_point="gcse-maths-h-a18-lp-factorising",
    type="worked_maths",
    difficulty=2,
    expected_seconds=60,
    marks=2,
    source_ref=_ref("A18"),
    citations=(_cite("2. Algebra, Solving equations and inequalities, content reference A18 "
                     "(page 15; PDF page 27)",
                     "solve quadratic equations (including those that require rearrangement) "
                     "algebraically by factorising", "2026-11-25"),),
    params=(IntParam("r1", -9, 9, exclude=(0,)), IntParam("r2", -9, 9, exclude=(0,))),
    rules=(
        Rule("the roots are different, larger one first", lambda p: p["r1"] > p["r2"]),
        Rule("there is an x term", lambda p: p["r1"] + p["r2"] != 0),
        Rule("the number term is at most 40 in size", lambda p: abs(p["r1"] * p["r2"]) <= 40),
    ),
    write=_quadratic_write,
    recheck=_quadratic_recheck,
)


# --- A25: nth term of a linear sequence -------------------------------------------------------

def _nth(p: dict) -> tuple[int, int]:
    """The nth term is d n + c."""
    return p["d"], p["first"] - p["d"]


def _terms(p: dict) -> list[int]:
    d, c = _nth(p)
    return [d * n + c for n in range(1, 5)]


def _nth_write(p: dict) -> dict:
    d, c = _nth(p)
    terms = _terms(p)
    answer = linear(d, c, "n") if d > 0 or c < 0 else f"{c} - {_mono(-d, 'n')}"
    accepted = [answer, f"{terms[0]} {'+' if d > 0 else '-'} {abs(d)}(n - 1)"]
    g = gcd(d, c)
    if g > 1 and d > 0:
        accepted.append(f"{g}({linear(d // g, c // g, 'n')})")
    elif g > 1 and c > 0:
        accepted.append(f"{g}({c // g} - {_mono(-d // g, 'n')})")
    move = f"add {c}" if c > 0 else f"subtract {-c}"
    return {
        "difficulty": 2 if d > 0 else 3,
        "expected_seconds": 45 if d > 0 else 60,
        "prompt": ("Find an expression for the nth term of the sequence "
                   f"{', '.join(map(str, terms))}, ..."),
        "answer": {"accepted": list(dict.fromkeys(accepted)), "any_order": True},
        "hint": "Work out the difference between the terms first.",
        "explanation": (f"The terms go {'up' if d > 0 else 'down'} by {abs(d)} each time, so the "
                        f"nth term starts {_mono(d, 'n')}. When n = 1, {_mono(d, 'n')} = {d}, and "
                        f"the first term is {terms[0]}, so {move}: the nth term is {answer}. "
                        f"Check: n = 2 gives {d} × 2 {signed_term(c, '', False)} = {terms[1]}."),
    }


def _nth_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"Find an expression for the nth term of the sequence (.+), \.\.\.",
                         item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    shown = [int(t) for t in match.group(1).split(", ")]
    errors = []
    if shown != _terms(p):
        errors.append("the question's terms are not the parameters' sequence")
    n = Symbol("n")
    for accepted in item["answer"]["accepted"]:
        expr = parse(accepted, exact=True)
        values = [expr.subs(n, k) for k in range(1, len(shown) + 1)]
        if values != shown:
            errors.append(f"{accepted} gives {values}, not the terms {shown}")
    return errors


LINEAR_NTH_TERM = Template(
    id="gcse-maths-h-a25-linear-nth-term",
    version=2,  # v2: also accepts the first-term and factorised forms (adversarial review)
    topic="gcse-maths-h-a25",
    learning_point="gcse-maths-h-a25-lp-linear-nth",
    type="short_answer",
    difficulty=2,
    expected_seconds=45,
    marks=2,
    source_ref=_ref("A25"),
    citations=(_cite("2. Algebra, Sequences, content reference A25 (page 15; PDF page 27)",
                     "term of linear and quadratic sequences", "2026-11-25"),),
    params=(IntParam("d", -7, 9, exclude=(-1, 0, 1)), IntParam("first", -10, 30, exclude=(0,))),
    rules=(
        Rule("the nth term has a number part", lambda p: _nth(p)[1] != 0),
        Rule("every term shown is between -30 and 60",
             lambda p: all(-30 <= t <= 60 for t in _terms(p))),
    ),
    write=_nth_write,
    recheck=_nth_recheck,
)


# --- N10: two recurring digits as a fraction --------------------------------------------------

def _recurring_write(p: dict) -> dict:
    digits = f"{p['a']}{p['b']}"
    k = int(digits)
    simple = Fraction(k, 99)
    g = 99 // simple.denominator
    tail = (f" Simplify by dividing by {g}: {simple}." if g > 1
            else f" {k}/99 is already in its simplest form.")
    return {
        "difficulty": 4,
        "expected_seconds": 90,
        "prompt": (f"Write 0.{digits * 3}... (the digits {digits} recur) as a fraction in its "
                   "simplest form."),
        "answer": {"value": f"{simple.numerator}/{simple.denominator}",
                   "form": "simplest_fraction"},
        "verify": {"expression": f"{k}/99"},
        "mark_scheme": [f"M1 for 99x = {k} or {k}/99", f"A1 for {simple}"],
        "hint": "Let x be the decimal. Two digits recur, so work out 100x - x.",
        "explanation": (f"Let x = 0.{digits * 2}... Two digits recur, so multiply by 100: "
                        f"100x = {digits}.{digits * 2}... Subtract: 100x - x = {digits}.{digits * 2}... - "
                        f"0.{digits * 2}..., so 99x = {k} and x = {k}/99.{tail}"),
    }


def _recurring_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"Write 0\.(\d+)\.\.\. \(the digits (\d\d) recur\) as a fraction in "
                         r"its simplest form\.", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    digits = match.group(2)
    errors = []
    if digits != f"{p['a']}{p['b']}" or match.group(1) != digits * 3:
        errors.append("the question's digits are not the parameters")
    num, den = (int(v) for v in item["answer"]["value"].split("/"))
    if gcd(num, den) != 1:
        errors.append(f"answer {num}/{den} is not in its simplest form")
    # Long division of the answer must give the recurring digits, block after block.
    remainder, shown = num, ""
    for _ in range(12):
        remainder *= 10
        shown += str(remainder // den)
        remainder %= den
    if num >= den or shown != digits * 6:
        errors.append(f"{num}/{den} is 0.{shown}..., not 0.{digits * 6}...")
    return errors


RECURRING_DECIMAL = Template(
    id="gcse-maths-h-n10-recurring-decimal",
    version=3,  # v2: subtraction in full (review); v3: answer.form simplest_fraction (S2e)
    topic="gcse-maths-h-n10",
    learning_point="gcse-maths-h-n10-lp-recurring",
    type="numeric",
    difficulty=4,
    expected_seconds=90,
    marks=2,
    source_ref=_ref("N10"),
    citations=(_cite("1. Number, Fractions, decimals and percentages, content reference N10 "
                     "(page 13; PDF page 25)", "change recurring decimals", "2026-11-25"),),
    params=(IntParam("a", 1, 9), IntParam("b", 0, 9)),
    rules=(Rule("the two digits are different", lambda p: p["a"] != p["b"]),),
    write=_recurring_write,
    recheck=_recurring_recheck,
)


# --- N5: the product rule for counting --------------------------------------------------------

def _count_write(p: dict) -> dict:
    a, b, c = p["a"], p["b"], p["c"]
    expr = f"{a}*{b}*{c}"
    return {
        "difficulty": 2,
        "expected_seconds": 60,
        "prompt": (f"A café offers {a} starters, {b} main courses and {c} desserts. A meal is "
                   "one starter, one main course and one dessert. How many different meals can "
                   "be chosen?"),
        "answer": {"expression": str(a * b * c)},
        "verify": {"method": "expression", "expression": expr},
        "steps": [expr, f"{a * b}*{c}", str(a * b * c)],
        "mark_scheme": [f"M1 for {a} × {b} × {c}", f"A1 for {a * b * c}"],
        "hint": "Multiply the number of choices for each course.",
        "explanation": (f"Each of the {a} starters can go with each of the {b} main courses, "
                        f"which gives {a} × {b} = {a * b} pairs. Each pair can go with each of "
                        f"the {c} desserts: {a * b} × {c} = {a * b * c} meals."),
    }


def _count_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"A café offers (\d+) starters, (\d+) main courses and (\d+) desserts\. "
                         r"A meal is one starter, one main course and one dessert\. How many "
                         r"different meals can be chosen\?", item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    a, b, c = (int(v) for v in match.groups())
    errors = []
    if (a, b, c) != (p["a"], p["b"], p["c"]):
        errors.append("the question's numbers are not the parameters")
    # Count the meals one by one rather than multiplying.
    meals = sum(1 for _ in range(a) for _ in range(b) for _ in range(c))
    if item["answer"]["expression"] != str(meals):
        errors.append(f"there are {meals} meals, the answer says {item['answer']['expression']}")
    return errors


PRODUCT_RULE = Template(
    id="gcse-maths-h-n5-product-rule",
    version=1,
    topic="gcse-maths-h-n5",
    learning_point="gcse-maths-h-n5-lp-product-rule",
    type="worked_maths",
    difficulty=2,
    expected_seconds=60,
    marks=2,
    source_ref=_ref("N5"),
    citations=(_cite("1. Number, Structure and calculation, content reference N5 (page 12; PDF "
                     "page 24)", "apply systematic listing strategies, including use of the "
                     "product rule for counting", "2026-11-25"),),
    params=(IntParam("a", 2, 8), IntParam("b", 2, 9), IntParam("c", 2, 7)),
    rules=(Rule("there are at most 300 meals", lambda p: p["a"] * p["b"] * p["c"] <= 300),),
    write=_count_write,
    recheck=_count_recheck,
)


# --- A7: composite functions ------------------------------------------------------------------

def _composite_values(p: dict) -> tuple[int, int]:
    """(inner value, answer) for fg(k) (order 0) or gf(k) (order 1)."""
    f = lambda x: p["p"] * x + p["q"]  # noqa: E731
    g = lambda x: x * x + p["r"]  # noqa: E731
    inner = g(p["k"]) if p["order"] == 0 else f(p["k"])
    return inner, (f(inner) if p["order"] == 0 else g(inner))


def _composite_write(p: dict) -> dict:
    k, a, q, r = p["k"], p["p"], p["q"], p["r"]
    f_text, g_text = linear(a, q), polynomial([1, 0, r])
    name, first, second = ("fg", "g", "f") if p["order"] == 0 else ("gf", "f", "g")
    inner, answer = _composite_values(p)
    square = lambda v: f"{bracket(v)}^2" + (f" {signed_term(r, '', False)}" if r else "")  # noqa: E731
    line = lambda v: f"{a} × {bracket(v)} {signed_term(q, '', False)}"  # noqa: E731
    work = {"f": line, "g": square}
    expr = (f"{a}*(({k})^2 + ({r})) + ({q})" if p["order"] == 0
            else f"(({a})*({k}) + ({q}))^2 + ({r})")
    return {
        "difficulty": 3,
        "expected_seconds": 60,
        "prompt": f"f(x) = {f_text} and g(x) = {g_text}. Work out {name}({k}).",
        "answer": {"value": str(answer)},
        "verify": {"expression": expr},
        "mark_scheme": [f"M1 for {first}({k}) = {inner}", f"A1 for {answer}"],
        "hint": f"{name}({k}) means {second}({first}({k})): work out {first}({k}) first.",
        "explanation": (f"{name}({k}) means {second}({first}({k})), so work out {first} first: "
                        f"{first}({k}) = {work[first](k)} = {inner}. Then {second}({inner}) = "
                        f"{work[second](inner)} = {answer}."),
    }


def _composite_recheck(p: dict, item: dict) -> list[str]:
    match = re.fullmatch(r"f\(x\) = (.+) and g\(x\) = (.+)\. Work out (fg|gf)\((-?\d+)\)\.",
                         item["prompt"])
    if not match:
        return ["the question is not in the expected words"]
    f, g = parse(match.group(1), exact=True), parse(match.group(2), exact=True)
    name, k = match.group(3), int(match.group(4))
    errors = []
    if not (_same(f, p["p"] * X + p["q"]) and _same(g, X**2 + p["r"]) and k == p["k"]
            and name == ("fg" if p["order"] == 0 else "gf")):
        errors.append("the question's functions are not the parameters")
    outer, inner = (f, g) if name == "fg" else (g, f)
    expected = outer.subs(X, inner.subs(X, k))
    if parse(item["answer"]["value"], exact=True) != expected:
        errors.append(f"{name}({k}) is {expected}, the answer says {item['answer']['value']}")
    return errors


COMPOSITE_FUNCTION = Template(
    id="gcse-maths-h-a7-composite-function",
    version=1,
    topic="gcse-maths-h-a7",
    learning_point="gcse-maths-h-a7-lp-composite",
    type="numeric",
    difficulty=3,
    expected_seconds=60,
    marks=2,
    source_ref=_ref("A7"),
    citations=(_cite("2. Algebra, Notation, vocabulary and manipulation, content reference A7 "
                     "(page 14; PDF page 26)", "interpret the succession of two functions as a "
                     "‘composite function’", "2026-11-25"),),
    params=(IntParam("p", 2, 5), IntParam("q", -9, 9, exclude=(0,)), IntParam("r", -5, 5),
            IntParam("k", -4, 5, exclude=(0,)), IntParam("order", 0, 1)),
    rules=(Rule("the answer is at most 200 in size",
                lambda p: abs(_composite_values(p)[1]) <= 200),),
    write=_composite_write,
    recheck=_composite_recheck,
)

TEMPLATES = (EXPAND_DOUBLE_BRACKETS, LINEAR_BOTH_SIDES, SIMULTANEOUS_ELIMINATION,
             PERCENTAGE_CHANGE, STANDARD_FORM_MULTIPLY,
             # T1c: thin topics
             QUADRATIC_FACTORISING, LINEAR_NTH_TERM, RECURRING_DECIMAL, PRODUCT_RULE,
             COMPOSITE_FUNCTION)
