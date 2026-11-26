"""Question templates: typed parameters, rules, and a writer that turns parameters into an item.

A template's ``write`` builds the question, answer, worked steps and explanation from the same
parameters, so the answer is correct by construction. Every instance is then cross-checked two
independent ways before it is accepted (``cross_check``):

1. the maths engine's content checks (``app.content_check``, the code ``pnpm content:validate``
   runs) re-verify the answer against ``verify`` and every line of ``steps``;
2. the template's own ``recheck`` reads the question text back with the engine's parser and
   recomputes the answer by a different method from the parameters.

Any disagreement raises ``GenerationError``, so a wrong item can never be written.
"""

import hashlib
import random
from dataclasses import dataclass, field
from typing import Callable

import sympy

from app.content_check import run_checks

MAX_TRIES = 5000


class GenerationError(Exception):
    """A template could not make a correct item."""


@dataclass(frozen=True)
class IntParam:
    """A whole-number parameter: ``low`` to ``high`` in steps of ``step``, minus ``exclude``."""

    name: str
    low: int
    high: int
    exclude: tuple[int, ...] = ()
    step: int = 1

    def __post_init__(self):
        if not self.values():
            raise ValueError(f"parameter {self.name} has no allowed value")

    def values(self) -> list[int]:
        return [v for v in range(self.low, self.high + 1, self.step) if v not in self.exclude]

    def allows(self, value: int) -> bool:
        return value in self.values()

    def sample(self, rng: random.Random) -> int:
        return rng.choice(self.values())


@dataclass(frozen=True)
class Rule:
    """A constraint the parameters must meet, such as "the answer is a whole number"."""

    description: str
    holds: Callable[[dict], bool]


@dataclass(frozen=True)
class Template:
    id: str
    version: int
    topic: str
    learning_point: str
    type: str
    difficulty: int
    expected_seconds: int
    marks: int
    source_ref: str
    citations: tuple[dict, ...]
    params: tuple[IntParam, ...]
    rules: tuple[Rule, ...]
    write: Callable[[dict], dict]
    recheck: Callable[[dict, dict], list[str]]
    tags: tuple[str, ...] = field(default=())

    @property
    def slug(self) -> str:
        return self.id[len(self.topic) + 1:]


def _rng(template: Template, seed: int) -> random.Random:
    # The key is fixed at version 1 (its original form), so a wording fix (a new version)
    # keeps each seed's numbers and the items' review history stays comparable.
    digest = hashlib.sha256(f"{template.id}:1:{seed}".encode()).digest()
    return random.Random(int.from_bytes(digest[:8], "big"))


def draw_params(template: Template, seed: int) -> dict:
    """The parameters for one seed: the first draw that meets every rule."""
    rng = _rng(template, seed)
    broken = None
    for _ in range(MAX_TRIES):
        params = {p.name: p.sample(rng) for p in template.params}
        broken = next((r for r in template.rules if not r.holds(params)), None)
        if broken is None:
            return params
    raise GenerationError(
        f"{template.id} seed {seed}: no parameters met the rule {broken.description!r}")


def engine_checks(item: dict) -> list[dict]:
    """The maths engine checks for an item, as ``pnpm content:validate`` builds them."""
    checks = []
    if item["type"] == "numeric":
        check = {"id": item["id"], "kind": "value", "expression": item["verify"]["expression"],
                 "answer": item["answer"]["value"]}
        for key in ("tolerance", "decimal_places", "significant_figures", "form"):
            if key in item["answer"]:
                check[key] = item["answer"][key]
        checks.append(check)
    elif item["type"] == "worked_maths":
        verify, answer = item["verify"], item["answer"]
        if verify["method"] == "solve":
            checks.append({"id": item["id"], "kind": "solve", "equation": verify["equation"],
                           "variable": verify.get("variable", "x"),
                           "solutions": answer["solutions"]})
            expected = {"solutions": answer["solutions"]}
        else:
            check = {"id": item["id"], "kind": "expression", "expression": verify["expression"],
                     "answer": answer["expression"]}
            expected = {"expression": verify["expression"]}
            # answer.form (fraction, standard_form, ...) or verify.form (factorised, expanded).
            form = answer.get("form", verify.get("form"))
            if form:
                check["form"] = expected["form"] = form
            checks.append(check)
        checks.append({"id": f"{item['id']}#steps", "kind": "working", "lines": item["steps"],
                       "expected": expected})
    return checks


def cross_check(template: Template, params: dict, item: dict) -> list[str]:
    """Every disagreement between the item and an independent recomputation (empty: none)."""
    errors = [f"maths engine: {r['error']} ({r['id']})"
              for r in run_checks(engine_checks(item)) if not r["ok"]]
    try:
        errors += [f"recheck: {e}" for e in template.recheck(params, item)]
    except (ValueError, KeyError, TypeError, IndexError, ArithmeticError, sympy.SympifyError) as err:
        errors.append(f"recheck: could not read the item: {err}")
    return errors


def make_item(template: Template, seed: int, now: str) -> dict:
    """One content item from one seed, or GenerationError if any check disagrees."""
    params = draw_params(template, seed)
    q = template.write(params)
    item = {
        "id": f"{template.topic}-t-{template.slug}-{seed:02d}",
        "topic": template.topic,
        "type": template.type,
        "difficulty": q.get("difficulty", template.difficulty),
        "learning_point": template.learning_point,
        "expected_seconds": q.get("expected_seconds", template.expected_seconds),
        "prompt": q["prompt"],
        "answer": q["answer"],
    }
    for key in ("verify", "steps"):
        if key in q:
            item[key] = q[key]
    item["marks"] = template.marks
    for key in ("mark_scheme", "hint", "explanation"):
        if key in q:
            item[key] = q[key]
    if template.tags:
        item["tags"] = list(template.tags)
    item["source_ref"] = template.source_ref
    item["checked_by"] = ["maths-engine", "author"]
    item["citations"] = [dict(c) for c in template.citations]
    item["template"] = {"id": template.id, "version": template.version, "seed": seed}
    errors = cross_check(template, params, item)
    if errors:
        raise GenerationError(f"{template.id} seed {seed}: " + "; ".join(errors))
    item["verification"] = {
        "status": "draft",
        "version": 1,
        "checks": [
            {
                "name": "grounded-writing",
                "result": "pass",
                "tool": "revisionden-maths-templates",
                "tool_version": f"{template.id} v{template.version}",
                "at": now,
                "notes": (f"Generated from template {template.id} (version {template.version}, "
                          f"seed {seed}) written from the cited specification point. Question, "
                          "answer, steps and explanation come from the same parameters."),
            },
            {
                "name": "maths-engine",
                "result": "pass",
                "tool": "revisionden-maths-engine",
                "tool_version": f"sympy {sympy.__version__}",
                "at": now,
                "notes": ("Template cross-check: the content checks re-verified the answer and "
                          "every step, and the question text was read back and the answer "
                          "recomputed by a second method."),
            },
        ],
    }
    return item


def _core(prompt: str) -> str:
    return prompt.strip().rstrip(".").strip()


def repeats(prompt: str, others) -> bool:
    """True when the question is one of ``others``, or one only adds words to the other
    (``Solve x^2 + x - 12 = 0 by factorising.`` repeats ``Solve x^2 + x - 12 = 0``)."""
    mine = _core(prompt)
    for other in others:
        short, long = sorted((mine, _core(other)), key=len)
        if long == short or long.startswith(short + " "):
            return True
    return False


def generate(template: Template, count: int, now: str, avoid=frozenset()) -> list[dict]:
    """``count`` items with different questions, from seeds 1, 2, 3, ...

    Seeds that repeat an earlier question, or a question in ``avoid`` (the hand-written bank),
    are skipped, so each item still records the one seed that remakes it.
    """
    items, prompts = [], list(avoid)
    seed = 0
    while len(items) < count:
        seed += 1
        if seed > count * 50:
            raise GenerationError(f"{template.id}: fewer than {count} different questions")
        item = make_item(template, seed, now)
        if repeats(item["prompt"], prompts):
            continue
        prompts.append(item["prompt"])
        items.append(item)
    return items
