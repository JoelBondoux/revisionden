"""A-Level Computer Science templates (OCR H446, board provisional). Strand 1: data
representation, specification 1.4.1 (b) to (i).

Answers are written with the CS engine (``app.cs.bases``, ``app.cs.floating``). Each template's
``recheck`` reads the question text back and recomputes the answer by a second method (place
values, Python's own integer conversions, digit tables), so the two must agree.

Citations are the topic tree leaf's own citation (its quote passed the quote check), copied with
``supports`` set to ``question``: the specification shows the question is in scope; the answer
is backed by the engine. Every question states the conventions it depends on (bit widths, two's
complement, the floating point format), so no item relies on a choice the specification leaves
open.
"""

import json
import re
from decimal import Decimal
from fractions import Fraction
from pathlib import Path

from app.cs import bases, floating
from app.templates.core import IntParam, Rule, Template

_TREE = Path(__file__).resolve().parents[4] / "content/topic-trees/alevel-computer-science-ocr-h446.json"
_PLACES = [128, 64, 32, 16, 8, 4, 2, 1]
_HEX = "0123456789ABCDEF"
FP_FORMAT = ("In this floating point format the mantissa is 8 bits and the exponent is 4 bits, "
             "both in two's complement, with the binary point after the first bit of the "
             "mantissa.")


def _leaf_citation(topic: str) -> dict:
    def leaves(nodes):
        for node in nodes:
            yield from leaves(node["children"]) if "children" in node else [node]

    tree = json.loads(_TREE.read_text())
    leaf = next(n for n in leaves(tree["topics"]) if n["id"] == topic)
    [citation] = leaf["citations"]
    return {**citation, "supports": ["question"]}


def _topic(letter: str) -> str:
    return f"alevel-cs-ocr-1-4-1-{letter}"


def _short(prompt: str, accepted: list[str], hint: str, explanation: str) -> dict:
    return {"prompt": prompt, "answer": {"accepted": accepted}, "hint": hint,
            "explanation": explanation}


def _numeric(prompt: str, value: str, expression: str, hint: str, explanation: str) -> dict:
    """A denary answer, marked by value (1.1250 is 1.125). The maths engine re-evaluates
    ``expression`` (a place-value sum) and compares it with the answer: a third check."""
    return {"prompt": prompt, "answer": {"value": value}, "verify": {"expression": expression},
            "hint": hint, "explanation": explanation}


def _hex_forms(text: str) -> list[str]:
    """How a student may write a hexadecimal answer (case and spaces are ignored in marking)."""
    return [text, f"0{text}", f"0x{text}"]


def _plural(n: int, word: str) -> str:
    return f"{n} {word}" if n == 1 else f"{n} {word}s"


def _signed(n: int) -> str:
    return f"({n})" if n < 0 else str(n)


def _list(words: list[str]) -> str:
    return words[0] if len(words) == 1 else ", ".join(words[:-1]) + " and " + words[-1]


def _nibbles(bits: str) -> str:
    return " ".join(bits[i:i + 4] for i in range(0, len(bits), 4))


def _match(pattern: str, prompt: str):
    m = re.fullmatch(pattern, prompt)
    if not m:
        raise ValueError(f"the question does not read as expected: {prompt!r}")
    return m


def _answer_errors(item: dict, expected: str) -> list[str]:
    if "value" in item["answer"]:
        given = item["answer"]["value"]
        if Fraction(given) != Fraction(expected):
            return [f"answer {given!r}, recomputed {expected!r}"]
        return []
    accepted = item["answer"]["accepted"]
    if accepted[0] != expected:
        return [f"answer {accepted[0]!r}, recomputed {expected!r}"]
    return []


# ---- second methods (independent of app.cs) ----

def _by_division(n: int, base: int, width: int = 0) -> str:
    digits = ""
    while n:
        digits = _HEX[n % base] + digits
        n //= base
    return (digits or "0").rjust(width, "0")


def _place_value(bits: str) -> int:
    return sum(p for p, b in zip(_PLACES[-len(bits):], bits) if b == "1")


def _signed_place_value(bits: str) -> int:
    return -int(bits[0]) * 2 ** (len(bits) - 1) + _place_value(bits[1:])


def _mantissa_value(bits: str) -> Fraction:
    return -int(bits[0]) + sum(Fraction(int(b), 2 ** i) for i, b in enumerate(bits[1:], 1))


def _fp_value(m: str, e: str) -> Fraction:
    return _mantissa_value(m) * Fraction(2) ** _signed_place_value(e)


def _decimal(value: Fraction) -> str:
    """A dyadic fraction as an exact decimal, without trailing zeros."""
    text = format(Decimal(value.numerator) / Decimal(value.denominator), "f")
    if "." in text:
        text = text.rstrip("0").rstrip(".")
    return "0" if text in ("-0", "") else text


def _places(value: Fraction) -> int:
    text = _decimal(value)
    return len(text.split(".")[1]) if "." in text else 0


# ---- 1.4.1 (b) positive integers in binary ----

def _write_den_bin(p):
    n = p["n"]
    bits = bases.to_binary(n, 8)
    used = [str(v) for v, b in zip(_PLACES, bits) if b == "1"]
    return _short(
        f"Write the denary number {n} as an 8-bit unsigned binary number.",
        [bits, _nibbles(bits)],
        "Write the place values 128, 64, 32, 16, 8, 4, 2, 1 and take the biggest ones that fit.",
        f"{n} = {' + '.join(used)}. Put a 1 under each of those place values and a 0 under the "
        f"others: {bits}. Keep the leading zeros so there are 8 bits.")


def _check_den_bin(p, item):
    n = int(_match(r"Write the denary number (\d+) as an 8-bit unsigned binary number\.",
                   item["prompt"]).group(1))
    return _answer_errors(item, _by_division(n, 2, 8))


def _write_bin_den(p):
    n = p["n"]
    bits = bases.to_binary(n, 8)
    used = [str(v) for v, b in zip(_PLACES, bits) if b == "1"]
    return _numeric(
        f"What is the 8-bit unsigned binary number {bits} in denary?",
        str(n), " + ".join(used),
        "Write 128, 64, 32, 16, 8, 4, 2, 1 above the bits and add the place values that have a 1.",
        f"The 1s are under {_list(used)}. {' + '.join(used)} = {n}.")


def _check_bin_den(p, item):
    bits = _match(r"What is the 8-bit unsigned binary number ([01]{8}) in denary\?",
                  item["prompt"]).group(1)
    return _answer_errors(item, str(_place_value(bits)))


# ---- 1.4.1 (c) negative numbers ----

def _write_den_twos(p):
    n = p["n"]
    positive = bases.to_binary(-n, 8)
    flipped = "".join("1" if b == "0" else "0" for b in positive)
    bits = bases.to_twos_complement(n, 8)
    return _short(
        f"Write the denary number {n} as an 8-bit two's complement binary number.",
        [bits, _nibbles(bits)],
        "Write the positive number in 8 bits, flip every bit, then add 1.",
        f"{-n} in 8 bits is {positive}. Flip every bit: {flipped}. Add 1: {bits}. Check: the "
        f"first bit is worth -128, and -128 + {n + 128} = {n}.")


def _check_den_twos(p, item):
    n = int(_match(r"Write the denary number (-\d+) as an 8-bit two's complement binary number\.",
                   item["prompt"]).group(1))
    return _answer_errors(item, _by_division(n + 256, 2, 8))


def _write_twos_den(p):
    n = p["n"]
    bits = bases.to_twos_complement(n, 8)
    rest = n + 128
    places = [str(v) for v, b in zip(_PLACES[1:], bits[1:]) if b == "1"]
    return _numeric(
        f"The 8-bit two's complement binary number {bits} represents which denary number?",
        str(n), " + ".join(["-128", *places]),
        "In 8-bit two's complement the first bit is worth -128; the others keep their usual "
        "place values.",
        f"The first bit is 1, worth -128. The other bits {bits[1:]} are worth {rest}. "
        f"-128 + {rest} = {n}.")


def _check_twos_den(p, item):
    bits = _match(r"The 8-bit two's complement binary number ([01]{8}) represents which denary "
                  r"number\?", item["prompt"]).group(1)
    return _answer_errors(item, str(_signed_place_value(bits)))


def _write_sign_mag(p):
    n = p["n"]
    bits = bases.to_sign_magnitude(n, 8)
    return _short(
        f"Write the denary number {n} in 8-bit sign and magnitude binary.",
        [bits, _nibbles(bits)],
        "The first bit is the sign (1 for negative); the other 7 bits are the size of the number.",
        f"The number is negative, so the sign bit is 1. {-n} in 7 bits is {bits[1:]}. "
        f"Together: {bits}.")


def _check_sign_mag(p, item):
    n = int(_match(r"Write the denary number (-\d+) in 8-bit sign and magnitude binary\.",
                   item["prompt"]).group(1))
    return _answer_errors(item, "1" + _by_division(-n, 2, 7))


# ---- 1.4.1 (d) addition and subtraction ----

def _write_add(p):
    a, b = p["a"], p["b"]
    x, y = bases.to_binary(a, 8), bases.to_binary(b, 8)
    total = bases.add_unsigned(x, y)
    return _short(
        f"Add the 8-bit unsigned binary numbers {x} and {y}. Give the answer as 8 bits.",
        [total.result, _nibbles(total.result)],
        "Add column by column from the right: 1 + 1 = 0 carry 1, and 1 + 1 + 1 = 1 carry 1.",
        f"Working from the right, the carries go into the columns marked 1 in {total.carries}. "
        f"The sum is {total.result}. Check in denary: {a} + {b} = {a + b}.")


def _check_add(p, item):
    m = _match(r"Add the 8-bit unsigned binary numbers ([01]{8}) and ([01]{8})\. Give the answer "
               r"as 8 bits\.", item["prompt"])
    return _answer_errors(item, format(int(m.group(1), 2) + int(m.group(2), 2), "08b"))


def _write_sub(p):
    a, b = p["a"], p["b"]
    x, y = bases.to_twos_complement(a, 8), bases.to_twos_complement(b, 8)
    neg = bases.negate(y)
    diff = bases.subtract_twos_complement(x, y)
    return _short(
        f"Using 8-bit two's complement, subtract {y} from {x}. Give the answer as 8 bits.",
        [diff.result, _nibbles(diff.result)],
        "To subtract, make the second number negative (flip the bits and add 1), then add. "
        "Ignore any carry out of the 8th bit.",
        f"Negate {y}: {neg}. Add {x} + {neg} = {diff.result}, ignoring any carry out of the "
        f"8th bit. Check in denary: {a} - {_signed(b)} = {a - b}.")


def _check_sub(p, item):
    m = _match(r"Using 8-bit two's complement, subtract ([01]{8}) from ([01]{8})\. Give the "
               r"answer as 8 bits\.", item["prompt"])
    value = _signed_place_value(m.group(2)) - _signed_place_value(m.group(1))
    if not -128 <= value <= 127:
        return [f"{value} does not fit in 8 bits"]
    return _answer_errors(item, format(value % 256, "08b"))


# ---- 1.4.1 (e) and (f) hexadecimal ----

def _write_den_hex(p):
    n = p["n"]
    text = bases.to_hex(n)
    q, r = divmod(n, 16)
    steps = f"{n} ÷ 16 = {q} remainder {r}"
    if q >= 16:
        steps += f"; {q} ÷ 16 = {q // 16} remainder {q % 16}"
    return _short(
        f"Write the denary number {n} in hexadecimal.",
        _hex_forms(text),
        "Divide by 16 and keep the remainders; 10 to 15 are written A to F.",
        f"{steps}. Reading the digits from the last division: {text}.")


def _check_den_hex(p, item):
    n = int(_match(r"Write the denary number (\d+) in hexadecimal\.", item["prompt"]).group(1))
    return _answer_errors(item, _by_division(n, 16))


def _write_hex_bin(p):
    n = p["n"]
    text = bases.to_hex(n)
    bits = bases.hex_to_binary(text, 8)
    parts = ", ".join(f"{d} = {bases.to_binary(int(d, 16), 4)}" for d in text)
    return _short(
        f"Write the hexadecimal number {text} as an 8-bit binary number.",
        [bits, _nibbles(bits)],
        "Each hexadecimal digit is exactly 4 bits.",
        f"{parts}. Together: {bits}.")


_NIBBLE = {d: format(i, "04b") for i, d in enumerate(_HEX)}


def _check_hex_bin(p, item):
    text = _match(r"Write the hexadecimal number ([0-9A-F]{2}) as an 8-bit binary number\.",
                  item["prompt"]).group(1)
    return _answer_errors(item, "".join(_NIBBLE[d] for d in text))


def _write_bin_hex(p):
    n = p["n"]
    bits = bases.to_binary(n, 8)
    text = bases.binary_to_hex(bits)
    def digit(group: str) -> str:
        value = int(group, 2)
        return f"{group} = {value}" + (f" = {_HEX[value]}" if value > 9 else "")

    return _short(
        f"Write the 8-bit binary number {bits} in hexadecimal.",
        _hex_forms(text),
        "Split the bits into two groups of 4 and write each group as one hexadecimal digit.",
        f"{digit(bits[:4])} and {digit(bits[4:])}, so the answer is {text}.")


def _check_bin_hex(p, item):
    bits = _match(r"Write the 8-bit binary number ([01]{8}) in hexadecimal\.",
                  item["prompt"]).group(1)
    return _answer_errors(item, format(int(bits, 2), "X"))


def _write_hex_den(p):
    n = p["n"]
    text = bases.to_hex(n)
    terms = [f"{d} × {16 ** (len(text) - 1 - i)}" for i, d in enumerate(text)]
    values = [str(int(d, 16) * 16 ** (len(text) - 1 - i)) for i, d in enumerate(text)]
    return _numeric(
        f"What is the hexadecimal number {text} in denary?",
        str(n), " + ".join(terms).replace("×", "*").replace("A", "10").replace("B", "11")
        .replace("C", "12").replace("D", "13").replace("E", "14").replace("F", "15"),
        "The place values in hexadecimal are 256, 16 and 1; A to F are 10 to 15.",
        f"{' + '.join(terms)} = {' + '.join(values)} = {n}.")


def _check_hex_den(p, item):
    text = _match(r"What is the hexadecimal number ([0-9A-F]{2,3}) in denary\?",
                  item["prompt"]).group(1)
    return _answer_errors(item, str(int(text, 16)))


# ---- 1.4.1 (g) and (h) floating point ----

def _fp(m: int, e: int) -> tuple[str, str]:
    return bases.to_twos_complement(m, 8), bases.to_twos_complement(e, 4)


def _normalised_int(m: int) -> bool:
    return 64 <= m <= 127 or -128 <= m <= -65


def _value_of(p, m="m", e="e") -> Fraction:
    return Fraction(p[m], 128) * Fraction(2) ** p[e]


def _write_fp_den(p):
    mantissa, exponent = _fp(p["m"], p["e"])
    mval = Fraction(p["m"], 128)
    value = _value_of(p)
    return _numeric(
        f"{FP_FORMAT} What denary number does the mantissa {mantissa} with exponent {exponent} "
        "represent?",
        _decimal(value), f"{p['m']}/128 * 2^({p['e']})",
        "Work out the exponent first. Then move the binary point in the mantissa that many places "
        "(right if positive, left if negative).",
        f"The exponent {exponent} is {p['e']}. The mantissa {mantissa} is {_decimal(mval)} "
        + ("(its first bit is 1, worth -1). " if mantissa[0] == "1" else
           "(its first bit is 0, so it is positive). ")
        + f"{_decimal(mval)} × 2^{p['e']} = {_decimal(value)}.")


def _check_fp_den(p, item):
    m = _match(re.escape(FP_FORMAT) + r" What denary number does the mantissa ([01]{8}) with "
               r"exponent ([01]{4}) represent\?", item["prompt"])
    return _answer_errors(item, _decimal(_fp_value(m.group(1), m.group(2))))


def _write_den_fp(p):
    value = _value_of(p)
    mantissa, exponent = floating.encode(value, 8, 4)
    return _short(
        f"{FP_FORMAT} Write the denary number {_decimal(value)} as a normalised floating point "
        "number. Give the mantissa, then a space, then the exponent.",
        [f"{mantissa} {exponent}", f"{mantissa}, {exponent}"],
        "Write the number in binary, then move the point until the mantissa starts 01 (positive) "
        "or 10 (negative). The exponent counts how far the point moved.",
        f"A normalised mantissa starts 01 or 10. {_decimal(value)} = {_decimal(Fraction(p['m'], 128))}"
        f" × 2^{p['e']}, so the mantissa is {mantissa} and the exponent is {p['e']}, which is "
        f"{exponent} in 4-bit two's complement.")


def _fp_answer_errors(item: dict, value: Fraction) -> list[str]:
    parts = item["answer"]["accepted"][0].split()
    if len(parts) != 2 or not re.fullmatch(r"[01]{8}", parts[0]) or not re.fullmatch(
            r"[01]{4}", parts[1]):
        return [f"answer {item['answer']['accepted'][0]!r} is not an 8-bit mantissa and a 4-bit "
                "exponent"]
    mantissa, exponent = parts
    errors = []
    if mantissa[0] == mantissa[1]:
        errors.append(f"mantissa {mantissa} is not normalised")
    if _fp_value(mantissa, exponent) != value:
        errors.append(f"answer is worth {_fp_value(mantissa, exponent)}, not {value}")
    return errors


def _check_den_fp(p, item):
    m = _match(re.escape(FP_FORMAT) + r" Write the denary number (-?\d+(?:\.\d+)?) as a "
               r"normalised floating point number\. Give the mantissa, then a space, then the "
               r"exponent\.", item["prompt"])
    return _fp_answer_errors(item, Fraction(Decimal(m.group(1))))


def _write_normalise(p):
    k = p["k"]
    raw_m = p["m"] // 2 ** k   # an arithmetic shift right by k (the rules keep it exact)
    mantissa, exponent = _fp(raw_m, p["e"] + k)
    good_m, good_e = floating.normalise(mantissa, exponent)
    return _short(
        f"{FP_FORMAT} The mantissa {mantissa} with exponent {exponent} is not normalised. "
        "Normalise it. Give the mantissa, then a space, then the exponent.",
        [f"{good_m} {good_e}", f"{good_m}, {good_e}"],
        "Shift the mantissa left until its first two bits are different (01 or 10). Take one off "
        "the exponent for every place you shift.",
        f"Shift {mantissa} left {_plural(k, 'place')} to get {good_m}, which starts "
        f"{good_m[:2]}. The exponent goes down by {k}: {p['e'] + k} - {k} = {p['e']}, which is "
        f"{good_e}. The value is unchanged: {_decimal(_value_of(p))}.")


def _check_normalise(p, item):
    m = _match(re.escape(FP_FORMAT) + r" The mantissa ([01]{8}) with exponent ([01]{4}) is not "
               r"normalised\. Normalise it\. Give the mantissa, then a space, then the exponent\.",
               item["prompt"])
    if m.group(1)[0] != m.group(1)[1]:
        return ["the question's mantissa is already normalised"]
    return _fp_answer_errors(item, _fp_value(m.group(1), m.group(2)))


def _write_fp_add(p):
    a, b = _fp(p["m"], p["e"]), _fp(p["m2"], p["e2"])
    va, vb = _value_of(p), _value_of(p, "m2", "e2")
    mantissa, exponent = floating.add(a, b, 8, 4)
    return _short(
        f"{FP_FORMAT} Add the floating point numbers with mantissa {a[0]}, exponent {a[1]} and "
        f"mantissa {b[0]}, exponent {b[1]}. Give the normalised answer: the mantissa, then a "
        "space, then the exponent.",
        [f"{mantissa} {exponent}", f"{mantissa}, {exponent}"],
        "Make the exponents the same (or convert both to denary), add, then normalise the result.",
        f"The first number is {_decimal(va)} and the second is {_decimal(vb)}. Their sum is "
        f"{_decimal(va + vb)}. Normalised, that is mantissa {mantissa} and exponent {exponent}.")


def _check_fp_add(p, item):
    m = _match(re.escape(FP_FORMAT) + r" Add the floating point numbers with mantissa ([01]{8}), "
               r"exponent ([01]{4}) and mantissa ([01]{8}), exponent ([01]{4})\. Give the "
               r"normalised answer: the mantissa, then a space, then the exponent\.",
               item["prompt"])
    total = _fp_value(m.group(1), m.group(2)) + _fp_value(m.group(3), m.group(4))
    return _fp_answer_errors(item, total)


def _encodable(value: Fraction) -> bool:
    try:
        floating.encode(value, 8, 4)
        return value != 0
    except ValueError:
        return False


# ---- 1.4.1 (i) shifts and masks ----

_SHIFTS = {1: ("logical", "left"), 2: ("logical", "right"), 3: ("arithmetic", "right")}
_OPS = {1: "AND", 2: "OR", 3: "XOR"}


def _write_shift(p):
    kind, direction = _SHIFTS[p["kind"]]
    bits = bases.to_binary(p["n"], 8)
    result = bases.shift(bits, p["k"], direction=direction, kind=kind)
    fill = ("copies of the sign bit" if kind == "arithmetic" else "0s")
    return _short(
        f"Apply a {kind} shift {direction} by {_plural(p['k'], 'place')} to the 8-bit binary "
        f"number {bits}.",
        [result, _nibbles(result)],
        "Move every bit along; bits that fall off the end are lost. A logical shift fills the gap "
        "with 0s; an arithmetic shift right fills it with copies of the sign bit.",
        f"Moving {bits} {direction} by {_plural(p['k'], 'place')} loses "
        f"{_plural(p['k'], 'bit')} off the "
        f"{'left' if direction == 'left' else 'right'} and fills the gap with {fill}: {result}.")


def _check_shift(p, item):
    m = _match(r"Apply a (logical|arithmetic) shift (left|right) by (\d) places? to the 8-bit "
               r"binary number ([01]{8})\.", item["prompt"])
    kind, direction, k, n = m.group(1), m.group(2), int(m.group(3)), int(m.group(4), 2)
    if direction == "left":
        value = (n << k) & 0xFF
    elif kind == "logical":
        value = n >> k
    else:
        value = ((n - 256 if n >= 128 else n) >> k) & 0xFF
    return _answer_errors(item, format(value, "08b"))


def _write_mask(p):
    op = _OPS[p["op"]]
    bits, mask = bases.to_binary(p["n"], 8), bases.to_binary(p["mask"], 8)
    result = bases.apply_mask(bits, mask, op)
    rule = {"AND": "1 only where both bits are 1", "OR": "1 where either bit is 1",
            "XOR": "1 where the bits are different"}[op]
    return _short(
        f"The 8-bit binary number {bits} is combined with the mask {mask} using {op}. What is "
        "the result?",
        [result, _nibbles(result)],
        f"Line the two numbers up and combine each pair of bits: {op} gives {rule}.",
        f"Bit by bit, {op} gives {rule}: {bits} {op} {mask} = {result}.")


def _check_mask(p, item):
    m = _match(r"The 8-bit binary number ([01]{8}) is combined with the mask ([01]{8}) using "
               r"(AND|OR|XOR)\. What is the result\?", item["prompt"])
    a, b = int(m.group(1), 2), int(m.group(2), 2)
    value = {"AND": a & b, "OR": a | b, "XOR": a ^ b}[m.group(3)]
    return _answer_errors(item, format(value, "08b"))


# ---- the templates ----

ENGINE_NOTE = ("Template cross-check: the CS engine (services/maths/app/cs) wrote the answer, and "
               "the template's recheck read the question text back and recomputed the answer by "
               "a second method (place values, Python's own conversions, digit tables or bit "
               "weights); the two agreed.")


def _fact(statement: str, ask: str) -> dict:
    return {"statement": statement, "ask": ask}


TWOS_PLACES = _fact(
    "In 8-bit two's complement the leftmost bit has place value -128 and the other bits keep "
    "their usual place values 64, 32, 16, 8, 4, 2 and 1.",
    "In 8-bit two's complement binary, what is the place value of each bit?")
TWOS_NEGATE = _fact(
    "To make the two's complement negative of a binary number, invert every bit and then add 1.",
    "How do you find the two's complement negative of a binary number?")
SIGN_MAGNITUDE = _fact(
    "In sign and magnitude binary the leftmost bit is the sign (1 for negative, 0 for positive) "
    "and the remaining bits give the size of the number.",
    "How does sign and magnitude binary show whether a number is negative, and its size?")
MANTISSA_PLACES = _fact(
    "In a two's complement mantissa with the binary point after the first bit, the first bit is "
    "worth -1 and the bits after the point are worth 1/2, 1/4, 1/8 and so on.",
    "In a two's complement fixed point mantissa with the binary point after the first bit, what "
    "is each bit worth?")
NORMALISED = _fact(
    "A floating point number with a two's complement mantissa is normalised when the first two "
    "bits of the mantissa are different: 01 for a positive number, 10 for a negative number.",
    "How can you tell whether a floating point number with a two's complement mantissa is "
    "normalised?")
SHIFT_FILL = _fact(
    "In a logical shift the bits moved off the end are lost and the empty places are filled with "
    "0s; in an arithmetic shift right the empty places are filled with copies of the sign bit.",
    "When binary bits are shifted, what happens to the bits moved off the end, and what fills "
    "the empty places in a logical shift and in an arithmetic shift right?")
MASK_RULES = _fact(
    "Combining bits with AND gives 1 only where both bits are 1, with OR gives 1 where either bit "
    "is 1, and with XOR gives 1 where the two bits are different.",
    "For each pair of bits, what do AND, OR and XOR give?")


def _with_facts(write, facts):
    if not facts:
        return write

    def wrapped(p):
        return {**write(p), "facts": [dict(f) for f in facts]}
    return wrapped


def _t(slug, letter, write, recheck, params, rules=(), difficulty=1, seconds=60, marks=1,
       facts=(), kind="short_answer"):
    topic = _topic(letter)
    write = _with_facts(write, facts)
    return Template(
        id=f"{topic}-{slug}", version=1, topic=topic, learning_point=f"{topic}-lp-{slug}",
        type=kind, difficulty=difficulty, expected_seconds=seconds, marks=marks,
        source_ref=f"OCR H446 specification 1.4.1({letter})", citations=(_leaf_citation(topic),),
        params=tuple(params), rules=tuple(rules), write=write, recheck=recheck,
        engine_tool="revisionden-cs-engine", engine_note=ENGINE_NOTE)


_N8 = IntParam("n", 1, 255)
_MANTISSA = IntParam("m", -128, 127)
_NORMALISED = Rule("the mantissa is normalised", lambda p: _normalised_int(p["m"]))
_NICE = Rule("the value has at most 4 decimal places", lambda p: _places(_value_of(p)) <= 4)

TEMPLATES = [
    _t("denary-to-binary", "b", _write_den_bin, _check_den_bin, [IntParam("n", 20, 255)]),
    _t("binary-to-denary", "b", _write_bin_den, _check_bin_den, [IntParam("n", 20, 255)],
       kind="numeric"),
    _t("denary-to-twos-complement", "c", _write_den_twos, _check_den_twos,
       [IntParam("n", -128, -1)], difficulty=2, seconds=90, facts=(TWOS_PLACES, TWOS_NEGATE)),
    _t("twos-complement-to-denary", "c", _write_twos_den, _check_twos_den,
       [IntParam("n", -128, -1)], difficulty=2, seconds=90, facts=(TWOS_PLACES,),
       kind="numeric"),
    _t("denary-to-sign-magnitude", "c", _write_sign_mag, _check_sign_mag,
       [IntParam("n", -127, -1)], difficulty=2, seconds=60, facts=(SIGN_MAGNITUDE,)),
    _t("binary-addition", "d", _write_add, _check_add,
       [IntParam("a", 17, 200), IntParam("b", 17, 200)],
       [Rule("the sum fits in 8 bits", lambda p: p["a"] + p["b"] <= 255)],
       difficulty=2, seconds=120),
    _t("twos-complement-subtraction", "d", _write_sub, _check_sub,
       [IntParam("a", -60, 60, exclude=(0,)), IntParam("b", -60, 60, exclude=(0,))],
       [Rule("the numbers are different", lambda p: p["a"] != p["b"])],
       difficulty=3, seconds=180, marks=2, facts=(TWOS_NEGATE,)),
    _t("denary-to-hexadecimal", "e", _write_den_hex, _check_den_hex, [IntParam("n", 26, 4095)],
       [Rule("the answer uses a letter", lambda p: any(c in "ABCDEF" for c in format(p["n"],
                                                                                     "X")))],
       difficulty=2, seconds=90),
    _t("hexadecimal-to-binary", "f", _write_hex_bin, _check_hex_bin, [IntParam("n", 16, 255)]),
    _t("binary-to-hexadecimal", "f", _write_bin_hex, _check_bin_hex, [IntParam("n", 16, 255)]),
    _t("hexadecimal-to-denary", "f", _write_hex_den, _check_hex_den, [IntParam("n", 16, 4095)],
       [Rule("the number uses a letter, so it cannot be mistaken for denary",
             lambda p: any(c in "ABCDEF" for c in format(p["n"], "X")))],
       difficulty=2, seconds=90, kind="numeric"),
    _t("floating-point-to-denary", "g", _write_fp_den, _check_fp_den,
       [_MANTISSA, IntParam("e", -3, 6)], [_NORMALISED, _NICE], difficulty=3, seconds=180,
       marks=2, facts=(MANTISSA_PLACES,), kind="numeric"),
    _t("denary-to-floating-point", "g", _write_den_fp, _check_den_fp,
       [_MANTISSA, IntParam("e", -3, 6)], [_NORMALISED, _NICE], difficulty=4, seconds=240,
       marks=2, facts=(MANTISSA_PLACES, NORMALISED)),
    _t("normalise-floating-point", "g", _write_normalise, _check_normalise,
       [_MANTISSA, IntParam("e", -4, 3), IntParam("k", 1, 3)],
       [_NORMALISED, Rule("the shift right loses no bits", lambda p: p["m"] % 2 ** p["k"] == 0),
        Rule("the exponent stays in range", lambda p: p["e"] + p["k"] <= 7)],
       difficulty=4, seconds=180, marks=2, facts=(NORMALISED,)),
    _t("floating-point-addition", "h", _write_fp_add, _check_fp_add,
       [_MANTISSA, IntParam("e", -1, 4), IntParam("m2", -128, 127), IntParam("e2", -1, 4)],
       [_NORMALISED, Rule("the second mantissa is normalised",
                          lambda p: _normalised_int(p["m2"])),
        Rule("the sum can be held exactly",
             lambda p: _encodable(_value_of(p) + _value_of(p, "m2", "e2"))),
        Rule("the numbers are worth different amounts",
             lambda p: _value_of(p) != _value_of(p, "m2", "e2"))],
       difficulty=5, seconds=300, marks=3, facts=(MANTISSA_PLACES, NORMALISED)),
    _t("shifts", "i", _write_shift, _check_shift,
       [IntParam("n", 1, 255), IntParam("k", 1, 3), IntParam("kind", 1, 3)],
       [Rule("the shift changes the number", lambda p: bases.shift(
           bases.to_binary(p["n"], 8), p["k"], direction=_SHIFTS[p["kind"]][1],
           kind=_SHIFTS[p["kind"]][0]) != bases.to_binary(p["n"], 8))],
       difficulty=2, seconds=90, facts=(SHIFT_FILL,)),
    _t("masks", "i", _write_mask, _check_mask,
       [IntParam("n", 1, 254), IntParam("mask", 1, 254), IntParam("op", 1, 3)],
       [Rule("the mask changes the number", lambda p: bases.apply_mask(
           bases.to_binary(p["n"], 8), bases.to_binary(p["mask"], 8), _OPS[p["op"]])
           != bases.to_binary(p["n"], 8))],
       difficulty=2, seconds=90, facts=(MASK_RULES,)),
]
