"""Proof of concept (research only): GCSE French vocabulary items from DfE Annex E.

Method (b) SOURCE-QUOTED. Every word and meaning is read from the DfE spreadsheet
"French, German and Spanish GCSE subject content: annex E" (September 2025, Open Government
Licence). Checks, all mechanical:
  1. cell check: the headword and English cells quoted in each citation are exactly the cells at
     the stated sheet and row of the file with the recorded SHA-256;
  2. uniqueness: the tested meaning is not also a meaning of another headword anywhere in the
     French sheets (Foundation and Higher, required and optional), so there is one right answer
     within the official list;
  3. distractors: taken from the same grammar group (plausible), and none of their English
     meanings overlaps any meaning of the answer (provably wrong within the list).
"""

import hashlib
import json
import re
import sys

import pandas as pd

# Usage: python poc_french.py <path to the downloaded annex E .xlsx> (never commit the file)
PATH = sys.argv[1] if len(sys.argv) > 1 else "annex_E.xlsx"
URL = ("https://assets.publishing.service.gov.uk/media/68c2aa12eeb238b20672a9be/"
       "French__German_and_Spanish_GCSE_subject_content_annex_E_September_2025.xlsx")
SHA = hashlib.sha256(open(PATH, "rb").read()).hexdigest()
SHEETS = ["French_required_words_(F)", "French_required_words_(H)",
          "French_optional_words_(F)", "French_optional_words_(H)"]


def load(sheet):
    df = pd.read_excel(PATH, sheet_name=sheet)
    df.columns = ["feature", "head", "english", "pos", "tag"]
    df["feature"] = df["feature"].ffill()
    df["row"] = df.index + 2  # spreadsheet row (row 1 is the header)
    return df.dropna(subset=["head"])


ALL = {s: load(s) for s in SHEETS}
F = ALL["French_required_words_(F)"]


def senses(english: str) -> set[str]:
    """Meanings in a cell: split on | ; and , (DfE Overview notes), strip person/gender notes."""
    text = re.sub(r"\((?:m|f|pl|nt|m, f|m, f before a vowel or h|mpl, mixed gender pl|emph|subj|obj|"
                  r"reflex|indirect obj)\)", "", str(english))
    out = set()
    for p in re.split(r"[|;,]", text):
        p = re.sub(r"\s+", " ", p).strip().lower()
        if p:
            out.add(p)
    return out


def row(head: str) -> pd.Series:
    hits = F[(F["head"].astype(str).str.strip() == head) & (F["tag"] == "Y")]
    assert len(hits) == 1, f"{head!r}: {len(hits)} required rows"
    return hits.iloc[0]


def cite(r, column, supports):
    letter = {"head": "B", "english": "C"}[column]
    return {"source_type": "dfe_subject_content", "publisher": "DfE",
            "title": "French, German and Spanish GCSE subject content: annex E",
            "document_ref": "Annex E (September 2025)", "url": URL,
            "location": f"sheet French_required_words_(F), row {r['row']}, cell {letter}{r['row']} "
                        f"(grammar feature: {r['feature']})",
            "quote": str(r[column]).strip(), "supports": supports,
            "retrieved_at": "2026-11-26", "sha256": SHA}


def cell_check(c) -> bool:
    sheet = c["location"].split()[1].rstrip(",")
    n = int(re.search(r"row (\d+)", c["location"]).group(1))
    col = re.search(r"cell ([A-Z])", c["location"]).group(1)
    raw = pd.read_excel(PATH, sheet_name=sheet, header=None)
    return str(raw.iat[n - 1, ord(col) - 65]).strip() == c["quote"]


def unique_meaning(r) -> list[str]:
    """Meanings of r that some OTHER headword in any French sheet also has."""
    mine = senses(r["english"])
    clashes = []
    for s, df in ALL.items():
        for _, o in df.iterrows():
            if str(o["head"]).strip().rstrip("*") == str(r["head"]).strip().rstrip("*"):
                continue
            both = mine & senses(o["english"])
            if both:
                clashes.append(f"{sorted(both)} also {o['head']} ({s} row {o['row']})")
    return clashes


def mc(head, distractor_heads, direction):
    r = row(head)
    ds = [row(h) for h in distractor_heads]
    for d in ds:
        assert d["feature"] == r["feature"], f"{d['head']} is not in the same grammar group"
        overlap = senses(d["english"]) & senses(r["english"])
        assert not overlap, f"distractor {d['head']} shares meaning {overlap}"
    if direction == "fr-en":
        prompt = f"What does '{r['head'].strip()}' mean?"
        options = [r["english"].strip()] + [d["english"].strip() for d in ds]
        cites = [cite(r, "head", ["question"]), cite(r, "english", ["answer"])] + [
            cite(d, "english", [f"distractor:{i + 1}"]) for i, d in enumerate(ds)]
    else:
        prompt = f"Which French word means '{r['english'].strip()}'?"
        options = [r["head"].strip()] + [d["head"].strip() for d in ds]
        cites = [cite(r, "english", ["question"]), cite(r, "head", ["answer"])] + [
            cite(d, "head", [f"distractor:{i + 1}"]) for i, d in enumerate(ds)]
    return {"type": "multiple_choice", "prompt": prompt, "options": options, "answer": {"option": 0},
            "citations": cites, "uniqueness_clashes": unique_meaning(r)}


def flash(head):
    r = row(head)
    return {"type": "flashcard", "front": r["head"].strip(), "back": r["english"].strip(),
            "citations": [cite(r, "head", ["front"]), cite(r, "english", ["back"])],
            "uniqueness_clashes": unique_meaning(r)}


ITEMS = [
    flash("pire(s)"),
    flash("ne...jamais"),
    mc("chaque", ["plusieurs", "même(s)", "autre(s)"], "fr-en"),
    mc("pire(s)", ["meilleur(e)(s)", "bon", "mal*"], "en-fr"),
    mc("devons", ["pouvons", "savons", "voulons"], "fr-en"),
]

if __name__ == "__main__":
    # Self-test: a distractor that shares a meaning must be refused.
    try:
        mc("tout(e)(s)", ["tous"], "fr-en")
        print("SELF-TEST FAILED")
        sys.exit(1)
    except AssertionError as err:
        print("self-test ok:", err)
    for i, it in enumerate(ITEMS, 1):
        it["id"] = f"dfe-fr-annexe-poc-{i:02d}"
        it["cell_check"] = all(cell_check(c) for c in it["citations"])
    print(json.dumps(ITEMS, indent=1, ensure_ascii=False))
