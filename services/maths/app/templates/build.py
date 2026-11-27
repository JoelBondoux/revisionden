"""Writes template items into content/ (``pnpm content:templates``) or checks they are current.

``python -m app.templates.build [--course <name>]`` writes each template's items, one JSON file
per template in the course's folder (``COURSES``; GCSE Maths Higher by default). A rebuild keeps the review record (``verification`` and
``checked_by``) of every item whose content has not changed, so pipeline results survive; a
changed item starts again as a new draft version. ``--check`` fails if the files differ from a
fresh generation (a hand edit, or a template changed without a rebuild).
"""

import argparse
import json
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from app.templates import alevel_cs, gcse_maths_higher
from app.templates.core import GenerationError, generate

REPO = Path(__file__).resolve().parents[4]
REVIEW_KEYS = ("verification", "checked_by")


@dataclass(frozen=True)
class Course:
    name: str
    templates: tuple
    out_dir: Path
    count: int
    title: str


COURSES = {
    "gcse-maths-higher": Course("gcse-maths-higher", tuple(gcse_maths_higher.TEMPLATES),
                                Path("content/items/gcse-maths-higher/templated"), 5,
                                "GCSE Maths Higher"),
    "alevel-cs": Course("alevel-cs", tuple(alevel_cs.TEMPLATES),
                        Path("content/items/alevel-computer-science/templated"), 7,
                        "A-Level Computer Science (OCR H446)"),
}
DEFAULT = COURSES["gcse-maths-higher"]
TEMPLATES = DEFAULT.templates
OUT_DIR = DEFAULT.out_dir
COUNT = DEFAULT.count


def _content(item: dict) -> dict:
    return {k: v for k, v in item.items() if k not in REVIEW_KEYS}


def _load(path: Path) -> list[dict]:
    return json.loads(path.read_text()) if path.exists() else []


def existing_prompts(items_dir: Path) -> frozenset[str]:
    """Questions already in the hand-written bank (template files are left out)."""
    prompts = set()
    for path in Path(items_dir).rglob("*.json"):
        if path.parent.name != OUT_DIR.name:
            prompts.update(i.get("prompt") for i in _load(path) if i.get("prompt"))
    return frozenset(prompts)


def _avoid() -> frozenset[str]:
    return existing_prompts(REPO / "content/items")


def build_file(template, out_dir: Path, now: str, count: int = COUNT) -> Path:
    path = Path(out_dir) / f"{template.id}.json"
    old = {i["id"]: i for i in _load(path)}
    items = generate(template, count, now, avoid=_avoid())
    for item in items:
        before = old.get(item["id"])
        if before is None:
            continue
        if _content(before) == _content(item):
            for key in REVIEW_KEYS:
                item[key] = before[key]
        else:
            item["verification"]["version"] = before["verification"]["version"] + 1
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n")
    return path


def check(out_dir: Path, count: int | None = None, course: Course = DEFAULT) -> list[str]:
    count = course.count if count is None else count
    problems = []
    names = set()
    for template in course.templates:
        path = Path(out_dir) / f"{template.id}.json"
        names.add(path.name)
        if not path.exists():
            problems.append(f"{path.name}: missing (run pnpm content:templates)")
            continue
        fresh = [_content(i) for i in generate(template, count, "1970-01-01T00:00:00Z", avoid=_avoid())]
        if [_content(i) for i in _load(path)] != fresh:
            problems.append(f"{path.name}: differs from a fresh generation "
                            "(run pnpm content:templates; never edit template items by hand)")
    if Path(out_dir).exists():
        for extra in sorted(p.name for p in Path(out_dir).glob("*.json") if p.name not in names):
            problems.append(f"{extra}: not made by any template")
    return problems


def _answer(item: dict) -> str:
    answer = item["answer"]
    if "solutions" in answer:
        return " or ".join(f"x = {s}" for s in answer["solutions"])
    if "expression" in answer:
        return answer["expression"].replace("*", " × ")
    if "option" in answer:
        return " | ".join(f"**{o}**" if i == answer["option"] else o
                          for i, o in enumerate(item["options"]))
    if "accepted" in answer:
        return answer["accepted"][0]
    return f"{answer.get('unit', '')}{answer['value']}"


def preview(out_dir: Path, course: Course = DEFAULT) -> str:
    """Every template item as plain markdown, for the owner to read before review."""
    title = "" if course is DEFAULT else f" ({course.title})"
    lines = [f"# Template questions: preview{title}", "",
             "Made by `pnpm content:templates` from the files in "
             f"`{course.out_dir.as_posix()}`. Do not edit: rebuild instead. How templates work: "
             "`docs/TEMPLATES.md`.", ""]
    for template in course.templates:
        items = _load(Path(out_dir) / f"{template.id}.json")
        lines += [f"## {template.id} ({template.topic}, {len(items)} questions)", ""]
        for n, item in enumerate(items, 1):
            checks = ", ".join(f"{c['name']} {c['result']}"
                               for c in item["verification"]["checks"])
            lines += [f"### {n}. {item['prompt']}", "",
                      f"- **Answer:** {_answer(item)}"]
            if item.get("steps"):
                lines.append("- **Worked steps:** " + " → ".join(f"`{s}`" for s in item["steps"]))
            lines += [f"- **Explanation:** {item['explanation']}",
                      f"- **Hint:** {item['hint']}"]
            if item.get("mark_scheme"):
                lines.append(f"- **Marks ({item['marks']}):** " + "; ".join(item["mark_scheme"]))
            lines += [f"- Seed {item['template']['seed']}, difficulty {item['difficulty']}, "
                      f"`{item['id']}`. Checks: {checks}.", ""]
    return "\n".join(lines)


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--course", default=DEFAULT.name, choices=sorted(COURSES))
    parser.add_argument("--out")
    parser.add_argument("--now", default=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"))
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--preview", help="write the owner preview (markdown) to this path")
    args = parser.parse_args(argv)
    course = COURSES[args.course]
    out = Path(args.out) if args.out else REPO / course.out_dir
    if args.preview:
        Path(args.preview).write_text(preview(out, course))
        return 0
    if args.check:
        problems = check(out, course=course)
        for problem in problems:
            print(problem, file=sys.stderr)
        return 1 if problems else 0
    try:
        for template in course.templates:
            print(build_file(template, out, args.now, count=course.count))
    except GenerationError as err:  # pragma: no cover - every template is tested to generate
        print(f"generation failed: {err}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main(sys.argv[1:]))
