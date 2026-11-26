"""Proof of concept (research only): GCSE physics numeric items from DfE equations.

Method (a) COMPUTED. Every equation comes from DfE "Biology, Chemistry and Physics GCSE subject
content" (June 2015, updated May 2019), Appendix 1, under the Open Government Licence. For each
item:
  1. write(): exact Fractions + pint (non_int_type=Fraction) convert to SI, compute, round.
  2. engine: the existing maths engine (services/maths app.content_check, kind "value") confirms
     the rounded answer against the SI expression.
  3. recheck(): reads numbers and units back from the question TEXT with a hand-written prefix
     table (no pint), recomputes, and checks pint dimensionality of the answer unit.
  4. distractors: computed misconceptions; each must differ from the answer (and each other)
     at the accuracy asked for, or the item is refused.
"""

import json
import random
import re
import sys
from fractions import Fraction

import pint

# Run from the repository root: python docs/research/question-generation-poc/poc_physics.py
from pathlib import Path  # noqa: E402

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "services" / "maths"))
from app.content_check import run_check  # noqa: E402

ureg = pint.UnitRegistry(non_int_type=Fraction)

DFE = {
    "source_type": "dfe_subject_content",
    "publisher": "DfE",
    "title": "Biology, Chemistry and Physics GCSE subject content",
    "document_ref": "June 2015 (updated May 2019)",
    "url": "https://assets.publishing.service.gov.uk/media/5cd2b951ed915d50c208b4d5/GCSE_single_science_updated_May_2019.pdf",
    "location": "Appendix 1, Equations in physics, (a) (page 46; PDF page 46)",
    "retrieved_at": "2026-11-26",
    "sha256": "511abad44dc6752a4d92bd8176e6a56e5eae3bd2f3159f10e18638c65039ad62",
    "supports": ["question"],
}


def sig(x: Fraction, n: int) -> str:
    """Round half up to n significant figures, written plainly (no standard form)."""
    from decimal import Decimal, ROUND_HALF_UP
    d = Decimal(x.numerator) / Decimal(x.denominator)
    places = n - 1 - d.adjusted()
    q = d.quantize(Decimal(1).scaleb(-places), rounding=ROUND_HALF_UP)
    return format(q, "f")


# Each template: equation quote, unknown, givens with display units, SI answer unit,
# misconceptions as functions of the SI givens and the raw (unconverted) givens.
TEMPLATES = [
    {
        "id": "dfe-phys-wave-speed", "quote": "wave speed = frequency x wavelength",
        "givens": [("frequency", "f", 2, 40, 1, "Hz"), ("wavelength", "lam", 5, 95, 5, "cm")],
        "prompt": "A water wave has a frequency of {f} Hz and a wavelength of {lam} cm. "
                  "Calculate the wave speed in m/s. Give your answer to 2 significant figures.",
        "si": lambda g: g["f"] * g["lam"], "unit": "m/s", "dim": "[length]/[time]", "sf": 2,
        "wrong": {"wavelength left in cm": lambda si, raw: raw["f"] * raw["lam"],
                  "divided instead of multiplied": lambda si, raw: si["f"] / si["lam"]},
        "context": "water wave",
    },
    {
        "id": "dfe-phys-charge-flow", "quote": "charge flow = current x time",
        "givens": [("current", "I", 50, 900, 50, "mA"), ("time", "t", 2, 15, 1, "min")],
        "prompt": "A current of {I} mA flows through a lamp for {t} minutes. "
                  "Calculate the charge that flows, in coulombs. Give your answer to 2 significant figures.",
        "si": lambda g: g["I"] * g["t"], "unit": "C", "dim": "[current]*[time]", "sf": 2,
        "wrong": {"time left in minutes": lambda si, raw: si["I"] * raw["t"],
                  "current left in mA": lambda si, raw: raw["I"] * si["t"]},
        "context": "lamp",
    },
    {
        "id": "dfe-phys-potential-difference", "quote": "potential difference = current x resistance",
        "givens": [("current", "I", 2, 40, 2, "mA"), ("resistance", "R", 1, 12, 1, "kΩ")],
        "prompt": "A current of {I} mA flows through a resistor of resistance {R} kΩ. "
                  "Calculate the potential difference across the resistor in volts. Give your answer to 2 significant figures.",
        "si": lambda g: g["I"] * g["R"], "unit": "V", "dim": "[mass]*[length]**2/[current]/[time]**3", "sf": 2,
        "wrong": {"divided instead of multiplied": lambda si, raw: si["I"] / si["R"],
                  "only the mA converted": lambda si, raw: si["I"] * raw["R"]},
        "context": "resistor",
    },
    {
        "id": "dfe-phys-momentum", "quote": "momentum = mass x velocity",
        "givens": [("mass", "m", 50, 950, 50, "g"), ("velocity", "v", 2, 30, 1, "m/s")],
        "prompt": "A ball of mass {m} g moves at a velocity of {v} m/s. "
                  "Calculate its momentum in kg m/s. Give your answer to 2 significant figures.",
        "si": lambda g: g["m"] * g["v"], "unit": "kg*m/s", "dim": "[mass]*[length]/[time]", "sf": 2,
        "wrong": {"mass left in grams": lambda si, raw: raw["m"] * si["v"],
                  "divided instead of multiplied": lambda si, raw: si["m"] / si["v"]},
        "context": "ball",
    },
    {
        "id": "dfe-phys-force", "quote": "force = mass x acceleration",
        "givens": [("mass", "m", 200, 1800, 100, "g"), ("acceleration", "a", 2, 25, 1, "m/s²")],
        "prompt": "A trolley of mass {m} g accelerates at {a} m/s². "
                  "Calculate the resultant force on the trolley in newtons. Give your answer to 2 significant figures.",
        "si": lambda g: g["m"] * g["a"], "unit": "N", "dim": "[mass]*[length]/[time]**2", "sf": 2,
        "wrong": {"mass left in grams": lambda si, raw: raw["m"] * si["a"],
                  "divided instead of multiplied": lambda si, raw: si["m"] / si["a"]},
        "context": "trolley",
    },
]

PINT_UNIT = {"Hz": "hertz", "cm": "centimetre", "mA": "milliampere", "min": "minute",
             "kΩ": "kiloohm", "g": "gram", "m/s": "metre/second", "m/s²": "metre/second**2"}


def to_si_pint(value: int, unit: str) -> Fraction:
    q = ureg.Quantity(Fraction(value), PINT_UNIT[unit]).to_base_units()
    return Fraction(q.magnitude)


def to_si_by_hand(value: Fraction, unit: str) -> Fraction:
    """Independent of pint: a small hand-written table."""
    table = {"Hz": 1, "cm": Fraction(1, 100), "mA": Fraction(1, 1000), "min": 60,
             "kΩ": 1000, "g": Fraction(1, 1000), "m/s": 1, "m/s²": 1}
    return value * table[unit]


def recheck(t, prompt: str, answer: str) -> list[str]:
    problems = []
    found = re.findall(r"(\d+(?:\.\d+)?) (Hz|cm|mA|minutes|kΩ|g|m/s²|m/s)\b", prompt)
    found = [(Fraction(v), "min" if u == "minutes" else u) for v, u in found]
    if len(found) != len(t["givens"]):
        return [f"read {len(found)} quantities from the question, expected {len(t['givens'])}"]
    si = {}
    for (name, key, *_r, unit), (v, u) in zip(t["givens"], found):
        if u != unit:
            problems.append(f"{name}: question says {u}, template says {unit}")
        si[key] = to_si_by_hand(v, u)
    # Recompute from the cited equation TEXT, not from the template's own formula:
    # "momentum = mass x velocity" -> product of the named quantities.
    names = [w.strip() for w in t["quote"].split("=")[1].split(" x ")]
    by_name = {name: key for (name, key, *_r) in t["givens"]}
    if sorted(names) != sorted(by_name):
        return problems + [f"equation quantities {names} do not match the givens {list(by_name)}"]
    value = Fraction(1)
    for name in names:
        value *= si[by_name[name]]
    if sig(value, t["sf"]) != answer:
        problems.append(f"recomputed answer {sig(value, t['sf'])} differs from {answer}")
    if ureg.Quantity(1, t["unit"]).dimensionality != ureg.get_dimensionality(t["dim"]):
        problems.append(f"unit {t['unit']} does not have dimension {t['dim']}")
    return problems


def generate(t, seed: int) -> dict:
    rng = random.Random(f"{t['id']}:{seed}")
    for _ in range(500):
        raw = {key: rng.choice(range(lo, hi + 1, step)) for (_n, key, lo, hi, step, _u) in t["givens"]}
        si = {key: to_si_pint(raw[key], unit) for (_n, key, _l, _h, _s, unit) in t["givens"]}
        exact = t["si"](si)
        answer = sig(exact, t["sf"])
        if Fraction(answer) == 0:
            continue
        wrong = {why: sig(f(si, raw), t["sf"]) for why, f in t["wrong"].items()}
        values = [answer, *wrong.values()]
        if len(set(Fraction(v) for v in values)) != len(values):
            continue  # a misconception gives the right answer (or two give the same): redraw
        break
    else:
        raise RuntimeError("no fair draw")
    prompt = t["prompt"].format(**raw)
    si_expr = " * ".join(f"({si[key].numerator}/{si[key].denominator})" for (_n, key, *_r) in t["givens"])
    engine = run_check({"id": t["id"], "kind": "value", "expression": si_expr, "answer": answer,
                        "significant_figures": t["sf"]})
    problems = recheck(t, prompt, answer)
    if not engine["ok"] or problems:
        raise RuntimeError(f"cross-check failed: {engine} {problems}")
    return {
        "id": f"{t['id']}-{seed:02d}", "type": "numeric", "prompt": prompt,
        "answer": {"value": answer, "unit": t["unit"].replace("*", " "), "significant_figures": t["sf"]},
        "exact": {"quantity": t["dim"]},
        "computed_distractors": wrong,
        "explanation_si": {key: str(si[key]) for key in si},
        "checks": {"maths-engine": engine, "recheck": "pass", "units-dimension": "pass"},
        "citation": {**DFE, "quote": t["quote"]},
    }


if __name__ == "__main__":
    # Self-test: a deliberately broken template must be caught.
    broken = dict(TEMPLATES[0], si=lambda g: g["f"] * g["lam"] * 2)
    try:
        generate(broken, 1)
        print("SELF-TEST FAILED: broken template was not caught")
        sys.exit(1)
    except RuntimeError as err:
        print("self-test ok: broken template refused:", str(err)[:80])
    out = [generate(t, 1) for t in TEMPLATES]
    print(json.dumps(out, indent=1, ensure_ascii=False))
