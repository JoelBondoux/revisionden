"""A-Level Computer Science templates (OCR H446). Strand 2: Boolean algebra, specification 1.4.3
(a) to (e).

Answers are written with the CS engine (``app.cs.logic``: truth tables, simplification, Karnaugh
maps, adders). Each template's ``recheck`` reads the question text back and checks the answer by
a second method that does not use ``app.cs.logic``: its own evaluator built on Python's ``ast``
module (OCR's binding, NOT then AND then XOR then OR, is Python's for ``~ & ^ |``), structural
matching of the two expressions for the named rules, and binary arithmetic for the adder.

A free-text Boolean expression cannot be marked as text (one function has many correct forms),
so a question asks for something with exactly one right form: a column of bits, one bit, a count,
or one of four options where exactly one is equivalent. Every question states what it depends on
(row order, Karnaugh map order, when a flip-flop changes).
"""

import ast
import json
import re
from itertools import combinations, permutations, product
from pathlib import Path

from app.cs import logic
from app.templates.core import IntParam, Rule, Template

_TREE = Path(__file__).resolve().parents[4] / "content/topic-trees/alevel-computer-science-ocr-h446.json"
GRAY = ["00", "01", "11", "10"]


def _leaf_citation(topic: str) -> dict:
    def leaves(nodes):
        for node in nodes:
            yield from leaves(node["children"]) if "children" in node else [node]

    tree = json.loads(_TREE.read_text())
    leaf = next(n for n in leaves(tree["topics"]) if n["id"] == topic)
    [citation] = leaf["citations"]
    return {**citation, "supports": ["question"]}


# ---- the second method: an evaluator that does not use app.cs.logic ----

_BIN = {ast.BitAnd: lambda a, b: a & b, ast.BitOr: lambda a, b: a | b,
        ast.BitXor: lambda a, b: a ^ b}


def _python(text: str) -> str:
    return text.replace("¬", "~").replace("∧", "&").replace("∨", "|").replace("⊕", "^")


def _tree(text: str) -> ast.AST:
    return ast.parse(_python(text), mode="eval").body


def _value(node: ast.AST, values: dict) -> int:
    if isinstance(node, ast.Name):
        return values[node.id]
    if isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Invert):
        return 1 - _value(node.operand, values)
    if isinstance(node, ast.BinOp) and type(node.op) in _BIN:
        return _BIN[type(node.op)](_value(node.left, values), _value(node.right, values))
    raise ValueError(f"not a Boolean expression: {ast.dump(node)}")


def _column(text: str, letters: str) -> list[int]:
    node = _tree(text)
    return [_value(node, dict(zip(letters, bits)))
            for bits in product((0, 1), repeat=len(letters))]


def _match(pattern: str, prompt: str):
    m = re.fullmatch(pattern, prompt)
    if not m:
        raise ValueError(f"the question does not read as expected: {prompt!r}")
    return m


def _only_right_option(item: dict, wanted: list[int], letters: str) -> list[str]:
    same = [i for i, o in enumerate(item["options"]) if _column(o, letters) == wanted]
    if same != [item["answer"]["option"]]:
        return [f"options matching the question: {same}, answer {item['answer']['option']}"]
    return []


# ---- shared writing helpers ----

def _bits(row) -> str:
    return "".join(map(str, row))


def _rows(n: int) -> str:
    return ", ".join(_bits(r) for r in product((0, 1), repeat=n))


def _negate(literal: str) -> str:
    return literal[1:] if literal.startswith("¬") else f"¬{literal}"


def _place(right: str, wrong: list[str], pos: int) -> tuple[list[str], int]:
    options = list(wrong)
    options.insert(pos, right)
    return options, pos


def _wrong_options(right: str, original: str, candidates: list[str], start: int) -> list[str]:
    """Three candidates, all different, none equivalent to the original (so one option is
    right), taken in a rotating order so items do not all share the same distractors."""
    seen, found = {right}, []
    for c in candidates:
        if c not in seen and not logic.equivalent(c, original):
            seen.add(c)
            found.append(c)
    if len(found) < 3:
        raise ValueError("not enough wrong options")
    k = start % len(found)
    return (found[k:] + found[:k])[:3]


def _terms(sop: str) -> list[list[str]]:
    """The literals of each term of a sum of products written by logic.simplify."""
    if sop in ("0", "1"):
        return [[sop]]
    return [t.strip("()").split(" ∧ ") for t in sop.split(" ∨ ")]


def _sop(terms: list[list[str]]) -> str:
    many = len(terms) > 1
    return " ∨ ".join(f"({' ∧ '.join(t)})" if many and len(t) > 1 else " ∧ ".join(t)
                      for t in terms)


def _mutations(sop: str) -> list[str]:
    """Near misses of a sum of products: one literal negated, a term dropped, AND and OR
    swapped, a literal dropped."""
    terms = _terms(sop)
    out = []
    for i, term in enumerate(terms):
        for j in range(len(term)):
            out.append(_sop(terms[:i] + [term[:j] + [_negate(term[j])] + term[j + 1:]]
                            + terms[i + 1:]))
    for i in range(len(terms)):
        if len(terms) > 1:
            out.append(_sop(terms[:i] + terms[i + 1:]))
    out.append(" ∧ ".join(f"({' ∨ '.join(t)})" if len(t) > 1 else t[0] for t in terms)
               if len(terms) > 1 else " ∨ ".join(terms[0]))
    for i, term in enumerate(terms):
        for j in range(len(term)):
            if len(term) > 1:
                out.append(_sop(terms[:i] + [term[:j] + term[j + 1:]] + terms[i + 1:]))
    return [o for o in out if o]


# ---- 1.4.3 (d) truth tables ----

SHAPES = [
    "A ∧ B", "A ∨ B", "A ⊕ B",
    "(A ∧ B) ∨ C", "(A ∨ B) ∧ C", "(A ⊕ B) ∧ C", "¬(A ∧ B) ∨ C", "¬(A ∨ B) ∧ C",
    "(A ∧ B) ∨ (B ∧ C)", "(A ∨ B) ∧ (A ∨ C)", "(A ⊕ B) ∨ C", "¬(A ⊕ B) ∧ C",
]


def _with_nots(shape: str, mask: int) -> str:
    """Put NOT in front of each letter whose bit is set (A is bit 0, B bit 1, C bit 2)."""
    return re.sub(r"\b([ABC])\b", lambda m: f"¬{m.group(1)}"
                  if mask >> "ABC".index(m.group(1)) & 1 else m.group(1), shape)


def _shape_expr(p) -> str:
    return _with_nots(SHAPES[p["shape"]], p["nots"])


def _interesting_column(p) -> bool:
    column = [out for _, out in logic.truth_table(_shape_expr(p))]
    letters = logic.variables(_shape_expr(p))
    plain = {tuple(row[i] for row, _ in logic.truth_table(_shape_expr(p)))
             for i in range(len(letters))}
    return len(set(column)) == 2 and tuple(column) not in plain


def _write_truth_table(p):
    expr = _shape_expr(p)
    letters = "".join(logic.variables(expr))
    table = logic.truth_table(expr)
    column = "".join(str(out) for _, out in table)
    worked = "; ".join(f"{_bits(row)} gives {out}" for row, out in table)
    return {
        "prompt": f"Complete the truth table for Q = {expr}. Work row by row with {letters} = "
                  f"{_rows(len(letters))} (top row first) and give the Q column as one string of "
                  "bits, top row first.",
        "answer": {"accepted": [column]},
        "hint": "Take one row at a time: put in the values of the letters, work out each bracket, "
                "then the operation outside it.",
        "explanation": f"Row by row ({letters}): {worked}. So the Q column is {column}.",
    }


def _check_truth_table(p, item):
    m = _match(r"Complete the truth table for Q = (.+)\. Work row by row with ([A-C]+) = "
               r"([01, ]+) \(top row first\) and give the Q column as one string of bits, top row "
               r"first\.", item["prompt"])
    expr, letters = m.group(1), m.group(2)
    if m.group(3) != _rows(len(letters)):
        return ["the rows are not listed in counting order"]
    expected = "".join(map(str, _column(expr, letters)))
    given = item["answer"]["accepted"][0]
    return [] if given == expected else [f"answer {given!r}, recomputed {expected!r}"]


# ---- 1.4.3 (b) simplifying an expression ----

PRODUCTS = [f"{x} ∧ {y}" for a, b in (("A", "B"), ("A", "C"), ("B", "C"))
            for x, y in ((a, b), (a, f"¬{b}"), (f"¬{a}", b), (f"¬{a}", f"¬{b}"))]


def _long_expr(p) -> str:
    return " ∨ ".join(f"({PRODUCTS[p[k]]})" for k in ("t1", "t2", "t3"))


def _simplifies_well(p) -> bool:
    if not p["t1"] < p["t2"] < p["t3"]:
        return False
    expr = _long_expr(p)
    short = logic.simplify(expr)
    return (short not in ("0", "1") and len(logic.variables(expr)) == 3
            and logic.literal_count(short) <= logic.literal_count(expr) - 3)


def _simplify_options(p):
    expr = _long_expr(p)
    right = logic.simplify(expr)
    wrong = _wrong_options(right, expr, _mutations(right) + [PRODUCTS[p["t1"]]], p["t1"])
    return expr, right, _place(right, wrong, p["pos"])


def _has_options(p) -> bool:
    try:
        _simplify_options(p)
        return True
    except ValueError:
        return False


def _write_simplify(p):
    expr, right, (options, answer) = _simplify_options(p)
    return {
        "prompt": f"Which of these is equivalent to {expr}?",
        "options": options,
        "answer": {"option": answer},
        "hint": "Compare truth tables, or look for terms that share letters and simplify them "
                "together.",
        "explanation": f"{right} has the same truth table as {expr} on all 8 rows; each other "
                       "option differs on at least one row.",
    }


def _check_equivalent_to(p, item):
    m = _match(r"(?:Using De Morgan's laws, which|Which) of these is equivalent to (.+)\?",
               item["prompt"])
    return _only_right_option(item, _column(m.group(1), "ABC"), "ABC")


# ---- 1.4.3 (b) Karnaugh maps ----

def _minterms_expr(mask: int, letters: str) -> str:
    terms = []
    for i, row in enumerate(product((0, 1), repeat=len(letters))):
        if mask >> i & 1:
            terms.append("(" + " ∧ ".join(x if v else f"¬{x}" for x, v in zip(letters, row))
                         + ")")
    return " ∨ ".join(terms)


BLOCKS4 = [" ∧ ".join(f"¬{x}" if neg else x for x, neg in zip(chosen, signs))
           for size in (2, 3) for chosen in combinations("ABCD", size)
           for signs in product((0, 1), repeat=size)]


def _mask(p, letters) -> int:
    """The cells holding 1: drawn directly for three letters, or as 2 or 3 blocks of cells for
    four (a random 16-cell map rarely simplifies to a short answer)."""
    if len(letters) == 3:
        return p["m"]
    blocks = [BLOCKS4[p[k]] for k in ("g1", "g2", "g3") if p[k] < len(BLOCKS4)]
    expr = " ∨ ".join(f"({b})" for b in blocks)
    return sum(1 << i for i, row in enumerate(product((0, 1), repeat=4))
               if _value(_tree(expr), dict(zip("ABCD", row))))


def _kmap_options(p, letters):
    expr = _minterms_expr(_mask(p, letters), letters)
    right = logic.simplify(expr)
    wrong = _wrong_options(right, expr, _mutations(right), _mask(p, letters))
    return expr, right, _place(right, wrong, p["pos"])


def _kmap_ok(letters, most_terms):
    def holds(p):
        if len(letters) == 4 and not p["g1"] < p["g2"] < p["g3"]:
            return False
        mask = _mask(p, letters)
        ones = bin(mask).count("1")
        if not 2 <= ones <= 2 ** len(letters) - 2:
            return False
        right = logic.simplify(_minterms_expr(mask, letters))
        if len(logic.variables(right)) < 2 or len(_terms(right)) > most_terms:
            return False
        try:
            _kmap_options(p, letters)
            return True
        except ValueError:
            return False
    return holds


def _kmap_prompt(kmap, letters) -> str:
    rows_name, row_codes = kmap.rows
    cols_name, col_codes = kmap.cols
    lines = "; ".join(f"{rows_name} = {code}: {' '.join(map(str, cells))}"
                      for code, cells in zip(row_codes, kmap.cells))
    row_order = "" if len(row_codes) == 2 else f" in the order {', '.join(row_codes)}"
    return (f"This Karnaugh map shows the output Q for inputs {', '.join(letters[:-1])} and "
            f"{letters[-1]}. The rows are {rows_name}{row_order}; the columns are {cols_name} in "
            f"the order {', '.join(col_codes)}. {lines}. Which expression gives Q as its simplest sum of "
            "products?")


def _write_kmap(letters):
    def write(p):
        expr, right, (options, answer) = _kmap_options(p, letters)
        kmap = logic.karnaugh_map(expr)
        return {
            "prompt": _kmap_prompt(kmap, letters),
            "options": options,
            "answer": {"option": answer},
            "hint": "Find the largest blocks of neighbouring 1s, then write one term for each "
                    "block using only the letters that stay the same across it.",
            "explanation": f"{right} is 1 in exactly the cells that hold 1, and no sum of "
                           "products with fewer letters is; each other option gives a different "
                           "map.",
        }
    return write


def _check_kmap(letters):
    def check(p, item):
        rows = re.findall(r"(?:A|AB) = ([01]{1,2}): ([01](?: [01])+)", item["prompt"])
        if "the columns are" not in item["prompt"] or "00, 01, 11, 10" not in item["prompt"]:
            return ["the map does not state its order"]
        split = 1 if len(letters) < 4 else 2
        want = {}
        for code, cells in rows:
            for col, value in zip(GRAY, cells.split()):
                want[code + col] = int(value)
        if len(want) != 2 ** len(letters) or any(len(c) != split for c, _ in rows):
            return ["the map does not have one cell for every input"]
        target = [want[_bits(r)] for r in product((0, 1), repeat=len(letters))]
        errors = _only_right_option(item, target, letters)
        right = item["options"][item["answer"]["option"]]
        # simplest: no single literal can be dropped and still match the map
        for shorter in _mutations(right):
            if (sum(c.isalpha() for c in shorter) < sum(c.isalpha() for c in right)
                    and _column(shorter, letters) == target):
                errors.append(f"{shorter} is shorter and also matches")
        return errors
    return check


# ---- 1.4.3 (c) De Morgan's laws and the named rules ----

PAIRS = [("A", "B"), ("A", "C"), ("B", "C")]


def _de_morgan_parts(p):
    a, b = PAIRS[p["pair"]]
    x = f"¬{a}" if p["nots"] & 1 else a
    y = f"¬{b}" if p["nots"] & 2 else b
    op, dual = ("∧", "∨") if p["op"] == 1 else ("∨", "∧")
    return x, y, op, dual


def _de_morgan_options(p):
    x, y, op, dual = _de_morgan_parts(p)
    original = f"¬({x} {op} {y})"
    right = f"{_negate(x)} {dual} {_negate(y)}"
    candidates = [f"{_negate(x)} {op} {_negate(y)}", f"{x} {dual} {y}", f"{x} {op} {y}",
                  f"{_negate(x)} {dual} {y}", f"{x} {dual} {_negate(y)}"]
    wrong = _wrong_options(right, original, candidates, p["pair"] + p["nots"])
    return original, right, _place(right, wrong, p["pos"])


def _write_de_morgan(p):
    original, right, (options, answer) = _de_morgan_options(p)
    return {
        "prompt": f"Using De Morgan's laws, which of these is equivalent to {original}?",
        "options": options,
        "answer": {"option": answer},
        "hint": "Move the NOT inside the bracket: what happens to each letter, and to the "
                "operation between them?",
        "explanation": f"{original} becomes {right}: each part inside the bracket is negated "
                       "(two NOTs cancel) and the operation between them changes.",
    }


RULE_NAMES = ["De Morgan's laws", "Distribution", "Association", "Commutation",
              "Double negation"]


_RULE_PHRASE = {"De Morgan's laws": "one of De Morgan's laws", "Distribution": "distribution",
                "Association": "association", "Commutation": "commutation",
                "Double negation": "double negation"}


def _rule_pair(p) -> tuple[str, str]:
    x, y, z = list(permutations("ABC"))[p["perm"]]
    op, other = ("∧", "∨") if p["op"] == 1 else ("∨", "∧")
    return {
        0: (f"¬({x} {op} {y})", f"¬{x} {other} ¬{y}"),
        1: (f"{x} {op} ({y} {other} {z})", f"({x} {op} {y}) {other} ({x} {op} {z})"),
        2: (f"({x} {op} {y}) {op} {z}", f"{x} {op} ({y} {op} {z})"),
        3: (f"{x} {op} {y}", f"{y} {op} {x}"),
        4: (f"¬¬{x} {op} {y}", f"{x} {op} {y}"),
    }[p["rule"]]


def _rule_options(p):
    right = RULE_NAMES[p["rule"]]
    others = [n for n in RULE_NAMES if n != right]
    del others[p["drop"]]
    options = [right] + others
    k = p["turn"]
    options = options[k:] + options[:k]
    return options, options.index(right)


def _write_rule(p):
    before, after = _rule_pair(p)
    options, answer = _rule_options(p)
    return {
        "prompt": f"Which rule of Boolean algebra turns {before} into {after}?",
        "options": options,
        "answer": {"option": answer},
        "hint": "Look at what changes: the order, the brackets, the NOTs, or the operations.",
        "explanation": f"{before} and {after} have the same truth table, and the step from one to "
                       f"the other is {_RULE_PHRASE[options[answer]]}.",
    }


def _same(a: ast.AST, b: ast.AST) -> bool:
    return ast.dump(a) == ast.dump(b)


def _strip_double_nots(node: ast.AST) -> ast.AST:
    if (isinstance(node, ast.UnaryOp) and isinstance(node.op, ast.Invert)
            and isinstance(node.operand, ast.UnaryOp) and isinstance(node.operand.op, ast.Invert)):
        return _strip_double_nots(node.operand.operand)
    if isinstance(node, ast.BinOp):
        return ast.BinOp(_strip_double_nots(node.left), node.op, _strip_double_nots(node.right))
    if isinstance(node, ast.UnaryOp):
        return ast.UnaryOp(node.op, _strip_double_nots(node.operand))
    return node


def _not(node: ast.AST) -> ast.AST:
    return ast.UnaryOp(ast.Invert(), node)


def _rule_name(before: ast.AST, after: ast.AST) -> str | None:
    """Which named rule rewrites ``before`` into ``after``, read from their shapes."""
    swap = {ast.BitAnd: ast.BitOr, ast.BitOr: ast.BitAnd}
    if isinstance(before, ast.UnaryOp) and isinstance(before.operand, ast.BinOp) and isinstance(
            after, ast.BinOp):
        inner = before.operand
        if (type(after.op) is swap.get(type(inner.op)) and _same(after.left, _not(inner.left))
                and _same(after.right, _not(inner.right))):
            return "De Morgan's laws"
    if isinstance(before, ast.BinOp) and isinstance(after, ast.BinOp):
        if (type(before.op) is type(after.op) and _same(before.left, after.right)
                and _same(before.right, after.left)):
            return "Commutation"
        if (isinstance(before.left, ast.BinOp) and isinstance(after.right, ast.BinOp)
                and type(before.op) is type(before.left.op) is type(after.op)
                is type(after.right.op)
                and _same(before.left.left, after.left)
                and _same(before.left.right, after.right.left)
                and _same(before.right, after.right.right)):
            return "Association"
        if (isinstance(before.right, ast.BinOp) and isinstance(after.left, ast.BinOp)
                and isinstance(after.right, ast.BinOp)
                and type(after.op) is type(before.right.op)
                and type(after.left.op) is type(after.right.op) is type(before.op)
                and _same(after.left.left, before.left) and _same(after.right.left, before.left)
                and _same(after.left.right, before.right.left)
                and _same(after.right.right, before.right.right)):
            return "Distribution"
    if not _same(before, after) and _same(_strip_double_nots(before), after):
        return "Double negation"
    return None


def _check_rule(p, item):
    m = _match(r"Which rule of Boolean algebra turns (.+) into (.+)\?", item["prompt"])
    before, after = m.group(1), m.group(2)
    if _column(before, "ABC") != _column(after, "ABC"):
        return [f"{before} and {after} are not equivalent"]
    name = _rule_name(_tree(before), _tree(after))
    given = item["options"][item["answer"]["option"]]
    return [] if name == given else [f"answer {given!r}, recomputed {name!r}"]


# ---- 1.4.3 (a) defining a problem ----

# Each problem is written twice: as an OCR expression and, independently, as a Python rule the
# recheck uses on the sentence.
PROBLEMS = [
    ("A ∧ B", "Q is 1 only when A and B are both 1.", lambda a, b, c: a and b),
    ("A ∨ B", "Q is 1 when A is 1, when B is 1, or when both are 1.", lambda a, b, c: a or b),
    ("A ⊕ B", "Q is 1 when exactly one of A and B is 1.", lambda a, b, c: a != b),
    ("¬A ∧ B", "Q is 1 only when A is 0 and B is 1.", lambda a, b, c: not a and b),
    ("¬(A ∨ B)", "Q is 1 only when A and B are both 0.", lambda a, b, c: not a and not b),
    ("(A ∧ B) ∨ C", "Q is 1 when A and B are both 1, and also whenever C is 1.",
     lambda a, b, c: (a and b) or c),
    ("(A ∨ B) ∧ C", "Q is 1 only when C is 1 and at least one of A and B is 1.",
     lambda a, b, c: (a or b) and c),
    ("A ∧ ¬C", "Q is 1 only when A is 1 and C is 0.", lambda a, b, c: a and not c),
    ("(A ∧ ¬B) ∨ C", "Q is 1 when A is 1 and B is 0, and also whenever C is 1.",
     lambda a, b, c: (a and not b) or c),
    ("(A ⊕ B) ∧ ¬C", "Q is 1 only when C is 0 and exactly one of A and B is 1.",
     lambda a, b, c: (a != b) and not c),
]
_INTRO = "The inputs A, B and C are each 1 (true) or 0 (false). "


def _relabel(text: str, perm: tuple) -> str:
    return re.sub(r"\b([ABC])\b", lambda m: perm["ABC".index(m.group(1))], text)


def _define_options(p):
    perm = list(permutations("ABC"))[p["perm"]]
    expr = _relabel(PROBLEMS[p["problem"]][0], perm)
    others = [_relabel(e, perm) for e, _, _ in PROBLEMS]
    candidates = (_mutations(logic.simplify(expr)) + others[p["problem"] + 1:]
                  + others[:p["problem"]])
    wrong = _wrong_options(expr, expr, candidates, p["problem"])
    return perm, expr, _place(expr, wrong, p["pos"])


def _write_define(p):
    perm, expr, (options, answer) = _define_options(p)
    sentence = _relabel(PROBLEMS[p["problem"]][1], perm)
    return {
        "prompt": f"{_INTRO}{sentence} Which expression defines Q?",
        "options": options,
        "answer": {"option": answer},
        "hint": "Turn each part of the sentence into symbols: which letters must be 1, which "
                "must be 0, and are the parts joined by AND or by OR?",
        "explanation": f"{expr} is 1 for exactly the inputs the sentence describes; each other "
                       "option is 1 for a different set of inputs.",
    }


def _check_define(p, item):
    m = _match(re.escape(_INTRO) + r"(.+) Which expression defines Q\?", item["prompt"])
    for perm in permutations("ABC"):
        for _, sentence, rule in PROBLEMS:
            if _relabel(sentence, perm) == m.group(1):
                # original letter i is now called perm[i]
                wanted = [int(bool(rule(*(dict(zip("ABC", row))[x] for x in perm))))
                          for row in product((0, 1), repeat=3)]
                return _only_right_option(item, wanted, "ABC")
    return ["the sentence is not one the recheck knows"]


# ---- 1.4.3 (e) full adders and D type flip-flops ----

def _write_full_adder(p):
    total = logic.full_adder(p["a"], p["b"], p["c"])
    output = "carry out" if p["out"] == 2 else "sum"
    value = total[1] if output == "carry out" else total[0]
    ones = p["a"] + p["b"] + p["c"]
    return {
        "prompt": f"A full adder has inputs A = {p['a']}, B = {p['b']} and carry in {p['c']}. "
                  f"What is the value of the {output}?",
        "answer": {"accepted": [str(value)]},
        "hint": "A full adder adds the three input bits together, as in a column of binary "
                "addition.",
        "explanation": f"{_plural(ones, 'input')} {'is' if ones == 1 else 'are'} 1, so the three "
                       f"bits add up to {ones}, which is {format(ones, '02b')} in binary: carry "
                       f"out {total[1]}, sum {total[0]}. The {output} is {value}.",
    }


def _plural(n, word):
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _check_full_adder(p, item):
    m = _match(r"A full adder has inputs A = ([01]), B = ([01]) and carry in ([01])\. What is "
               r"the value of the (sum|carry out)\?", item["prompt"])
    if [int(g) for g in m.group(1, 2, 3)] != [p["a"], p["b"], p["c"]]:
        return ["the inputs in the question are not the drawn ones"]
    total = sum(int(g) for g in m.group(1, 2, 3))
    expected = str(total // 2 if m.group(4) == "carry out" else total % 2)
    given = item["answer"]["accepted"][0]
    return [] if given == expected else [f"answer {given!r}, recomputed {expected!r}"]


_ORDINAL = ["1st", "2nd", "3rd", "4th"]
_FLIP_RULE = ("A D type flip-flop changes its output Q only at a rising edge of the clock: at "
              "each rising edge Q takes the value D has at that moment, and between rising edges "
              "Q holds its value.")


def _d_values(p) -> list[int]:
    return [p["d"] >> (3 - i) & 1 for i in range(4)]


def _write_flip_flop(p):
    d, q0 = _d_values(p), p["q0"]
    setting = (f"{_FLIP_RULE} Q starts at {q0}. At the 1st, 2nd, 3rd and 4th rising edges D is "
               f"{', '.join(map(str, d[:3]))} and {d[3]}.")
    qs = [q0] + d
    if p["ask"] == 1:
        k = p["k"]
        return {
            "prompt": f"{setting} What is Q just after the {_ORDINAL[k - 1]} rising edge?",
            "answer": {"accepted": [str(d[k - 1])]},
            "hint": "At a rising edge, look only at D at that moment.",
            "explanation": f"At the {_ORDINAL[k - 1]} rising edge D is {d[k - 1]}, so Q becomes "
                           f"{d[k - 1]} and holds it until the next rising edge.",
        }
    changes = sum(qs[i] != qs[i + 1] for i in range(4))
    return {
        "prompt": f"{setting} How many times does Q change value over the four rising edges?",
        "answer": {"accepted": [str(changes)]},
        "hint": "Write down Q after each rising edge, starting from its first value, and count "
                "the changes.",
        "explanation": f"Q goes {', '.join(map(str, qs))}: it changes "
                       f"{_plural(changes, 'time')}.",
    }


def _check_flip_flop(p, item):
    m = _match(re.escape(_FLIP_RULE) + r" Q starts at ([01])\. At the 1st, 2nd, 3rd and 4th "
               r"rising edges D is ([01]), ([01]), ([01]) and ([01])\. (?:What is Q just after "
               r"the (\d)(?:st|nd|rd|th) rising edge\?|How many times does Q change value over "
               r"the four rising edges\?)", item["prompt"])
    q = int(m.group(1))
    d = [int(m.group(i)) for i in range(2, 6)]
    if (q, d) != (p["q0"], _d_values(p)):
        return ["the values in the question are not the drawn ones"]
    after, changes = [], 0
    for value in d:  # simulate the clock edge by edge
        changes += value != q
        q = value
        after.append(q)
    expected = str(after[int(m.group(6)) - 1]) if m.group(6) else str(changes)
    given = item["answer"]["accepted"][0]
    return [] if given == expected else [f"answer {given!r}, recomputed {expected!r}"]


# ---- facts (decision 0009): rules the specification names but does not state ----

def _fact(statement: str, ask: str) -> dict:
    return {"statement": statement, "ask": ask}


NOTATION = _fact(
    "In OCR's Boolean notation ∧ means AND, ∨ means OR, ¬ means NOT and ⊕ means XOR (exclusive "
    "OR).",
    "In OCR A-Level Computer Science Boolean algebra, what do the symbols ∧, ∨, ¬ and ⊕ mean?")
KMAP_GROUPS = _fact(
    "In a Karnaugh map, each group of 1s must be a rectangle of 1, 2, 4 or 8 cells, groups may "
    "wrap around the edges of the map, and each group gives one term of the simplified "
    "expression.",
    "What shapes and sizes can the groups of 1s in a Karnaugh map be, can they wrap around the "
    "edges, and what does each group give?")
DE_MORGAN = _fact(
    "De Morgan's laws: ¬(A ∧ B) is equivalent to ¬A ∨ ¬B, and ¬(A ∨ B) is equivalent to ¬A ∧ ¬B.",
    "What do De Morgan's laws say in Boolean algebra?")
DOUBLE_NEGATION = _fact(
    "Double negation: ¬¬A is equivalent to A.",
    "What does the double negation rule say in Boolean algebra?")
RULES = _fact(
    "Commutation: A ∧ B ≡ B ∧ A and A ∨ B ≡ B ∨ A. Association: (A ∧ B) ∧ C ≡ A ∧ (B ∧ C), and "
    "the same for ∨. Distribution: A ∧ (B ∨ C) ≡ (A ∧ B) ∨ (A ∧ C) and A ∨ (B ∧ C) ≡ (A ∨ B) ∧ "
    "(A ∨ C).",
    "What do the commutation, association and distribution rules say in Boolean algebra?")
FULL_ADDER = _fact(
    "A full adder adds three bits (A, B and carry in): its sum output is 1 when an odd number of "
    "the inputs are 1, and its carry out is 1 when two or more of the inputs are 1.",
    "What are the sum and carry out of a full adder for each combination of its three inputs?")
FLIP_FLOP = _fact(
    "A D type flip-flop is edge-triggered: at each rising edge of the clock its output Q takes "
    "the value of the D input, and Q holds that value until the next rising edge.",
    "How does the output of a D type flip-flop respond to its D input and the clock?")


# ---- the templates ----

ENGINE_NOTE = ("Template cross-check: the CS engine (services/maths/app/cs/logic) wrote the "
               "answer, and the template's recheck read the question text back and checked it by "
               "a second method (its own evaluator built on Python's ast module, the shapes of the "
               "two expressions, or binary arithmetic); the two agreed.")


def _with_facts(write, facts):
    if not facts:
        return write

    def wrapped(p):
        return {**write(p), "facts": [dict(f) for f in facts]}
    return wrapped


def _t(slug, letter, write, recheck, params, rules=(), difficulty=2, seconds=90, marks=1,
       facts=(), kind="multiple_choice"):
    topic = f"alevel-cs-ocr-1-4-3-{letter}"
    return Template(
        id=f"{topic}-{slug}", version=1, topic=topic, learning_point=f"{topic}-lp-{slug}",
        type=kind, difficulty=difficulty, expected_seconds=seconds, marks=marks,
        source_ref=f"OCR H446 specification 1.4.3({letter})", citations=(_leaf_citation(topic),),
        params=tuple(params), rules=tuple(rules), write=_with_facts(write, facts),
        recheck=recheck, engine_tool="revisionden-cs-engine", engine_note=ENGINE_NOTE)


_POS = IntParam("pos", 0, 3)
_PERM = IntParam("perm", 0, 5)


def _options_exist(build):
    def holds(p):
        try:
            build(p)
            return True
        except ValueError:
            return False
    return Rule("there are three different wrong options", holds)


TEMPLATES = [
    _t("define-a-problem", "a", _write_define, _check_define,
       [IntParam("problem", 0, len(PROBLEMS) - 1), _PERM, _POS],
       [_options_exist(_define_options)], facts=(NOTATION,)),
    _t("simplify-expression", "b", _write_simplify, _check_equivalent_to,
       [IntParam("t1", 0, 11), IntParam("t2", 0, 11), IntParam("t3", 0, 11), _POS],
       [Rule("the expression simplifies by at least 3 letters", _simplifies_well),
        Rule("there are three different wrong options", _has_options)],
       difficulty=3, seconds=150, facts=(NOTATION,)),
    _t("karnaugh-map-three-letters", "b", _write_kmap("ABC"), _check_kmap("ABC"),
       [IntParam("m", 1, 254), _POS], [Rule("the map simplifies to at most 2 terms",
                                            _kmap_ok("ABC", 2))],
       difficulty=3, seconds=150, facts=(NOTATION, KMAP_GROUPS)),
    _t("karnaugh-map-four-letters", "b", _write_kmap("ABCD"), _check_kmap("ABCD"),
       [IntParam("g1", 0, len(BLOCKS4) - 1), IntParam("g2", 0, len(BLOCKS4) - 1),
        IntParam("g3", 0, len(BLOCKS4)), _POS], [Rule("the map simplifies to at most 3 terms",
                                              _kmap_ok("ABCD", 3))],
       difficulty=4, seconds=240, marks=2, facts=(NOTATION, KMAP_GROUPS)),
    _t("de-morgan", "c", _write_de_morgan, _check_equivalent_to,
       [IntParam("pair", 0, 2), IntParam("nots", 0, 3), IntParam("op", 1, 2), _POS],
       [_options_exist(_de_morgan_options)], facts=(NOTATION, DE_MORGAN, DOUBLE_NEGATION)),
    _t("name-the-rule", "c", _write_rule, _check_rule,
       [IntParam("rule", 0, 4), _PERM, IntParam("op", 1, 2), IntParam("drop", 0, 3),
        IntParam("turn", 0, 3)],
       facts=(NOTATION, RULES, DE_MORGAN, DOUBLE_NEGATION)),
    _t("truth-table", "d", _write_truth_table, _check_truth_table,
       [IntParam("shape", 0, len(SHAPES) - 1), IntParam("nots", 0, 7)],
       [Rule("the column is not constant and not just one input", _interesting_column)],
       seconds=150, kind="short_answer", facts=(NOTATION,)),
    _t("full-adder", "e", _write_full_adder, _check_full_adder,
       [IntParam("a", 0, 1), IntParam("b", 0, 1), IntParam("c", 0, 1), IntParam("out", 1, 2)],
       seconds=60, kind="short_answer", facts=(FULL_ADDER,)),
    _t("d-type-flip-flop", "e", _write_flip_flop, _check_flip_flop,
       [IntParam("d", 0, 15), IntParam("q0", 0, 1), IntParam("ask", 1, 2), IntParam("k", 1, 4)],
       seconds=90, kind="short_answer", facts=(FLIP_FLOP,)),
]
