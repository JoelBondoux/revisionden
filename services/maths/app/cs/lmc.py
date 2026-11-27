"""Little Man Computer (OCR H446 1.2.4 (c); mnemonics from appendix 5d).

OCR's mnemonics and the alternatives it accepts: ADD, SUB, STA (STO), LDA (LOAD), BRA (BR),
BRZ (BZ), BRP (BP), INP (IN, INPUT), OUT, HLT (COB, END) and DAT. 100 mailboxes, each holding
-999 to 999. Our choices: BRP branches when the accumulator is zero or more; a value outside
-999 to 999 is an error rather than wrapping (questions avoid it).
"""
from dataclasses import dataclass, field

_CODES = {"ADD": 100, "SUB": 200, "STA": 300, "LDA": 500, "BRA": 600, "BRZ": 700, "BRP": 800}
_PLAIN = {"INP": 901, "OUT": 902, "HLT": 0}
_ALIASES = {"STO": "STA", "LOAD": "LDA", "BR": "BRA", "BZ": "BRZ", "BP": "BRP", "IN": "INP",
            "INPUT": "INP", "COB": "HLT", "END": "HLT"}
_NAMES = {v: k for k, v in {**_CODES}.items()}
MAILBOXES = 100
MAX_STEPS = 10_000


class LMCError(Exception):
    """A program that cannot be assembled or run."""


def _mnemonic(word: str) -> str | None:
    word = _ALIASES.get(word.upper(), word.upper())
    return word if word in _CODES or word in _PLAIN or word == "DAT" else None


def _takes_operand(mnemonic: str) -> bool:
    return mnemonic in _CODES or mnemonic == "DAT"


def _parse(source: str) -> list[tuple]:
    """(line number, label, mnemonic, operand) for each instruction."""
    rows = []
    for no, raw in enumerate(source.splitlines(), start=1):
        words = raw.split("//")[0].split()
        if not words:
            continue
        label, operand = None, None
        first = _mnemonic(words[0])
        if len(words) == 3:
            label, mnemonic, operand = words[0], _mnemonic(words[1]), words[2]
        elif len(words) == 2 and first and _takes_operand(first):
            mnemonic, operand = first, words[1]
        elif len(words) == 2:
            label, mnemonic = words[0], _mnemonic(words[1])
        elif len(words) == 1:
            mnemonic = first
        else:
            raise LMCError(f"line {no}: too many words")
        if mnemonic is None:
            raise LMCError(f"line {no}: unknown instruction {' '.join(words)!r}")
        if mnemonic in _CODES and operand is None:
            raise LMCError(f"line {no}: {mnemonic} needs an address")
        rows.append((no, label, mnemonic, operand))
    if len(rows) > MAILBOXES:
        raise LMCError(f"the program needs more than {MAILBOXES} mailboxes")
    return rows


def _value(text: str, labels: dict, no: int, is_data: bool) -> int:
    if text.lstrip("-").isdigit():
        value = int(text)
        if is_data and not -999 <= value <= 999:
            raise LMCError(f"line {no}: a mailbox holds -999 to 999")
        if not is_data and not 0 <= value < MAILBOXES:
            raise LMCError(f"line {no}: address {value} is not a mailbox")
        return value
    if text not in labels:
        raise LMCError(f"line {no}: label {text} is not defined")
    return labels[text]


def assemble(source: str) -> list[int]:
    """The 100 mailboxes after loading the program."""
    rows = _parse(source)
    labels = {}
    for address, (no, label, _, _) in enumerate(rows):
        if label is not None:
            if label in labels:
                raise LMCError(f"line {no}: label {label} is defined twice")
            labels[label] = address
    memory = [0] * MAILBOXES
    for address, (no, _, mnemonic, operand) in enumerate(rows):
        if mnemonic == "DAT":
            memory[address] = _value(operand, labels, no, True) if operand else 0
        elif mnemonic in _PLAIN:
            memory[address] = _PLAIN[mnemonic]
        else:
            memory[address] = _CODES[mnemonic] + _value(operand, labels, no, False)
    return memory


@dataclass
class LMCRun:
    output: list
    accumulator: int
    memory: list
    trace: list = field(default_factory=list)  # (address, mnemonic, accumulator after)


def run(source: str, inputs: list[int], max_steps: int = MAX_STEPS) -> LMCRun:
    memory, waiting = assemble(source), list(inputs)
    acc, pc, output, trace = 0, 0, [], []
    for _ in range(max_steps):
        word = memory[pc]
        address, here = word % 100, pc
        pc += 1
        if word == 0:
            trace.append((here, "HLT", acc))
            return LMCRun(output, acc, memory, trace)
        if word == 901:
            if not waiting:
                raise LMCError(f"INP at mailbox {here} but no more input was given")
            acc, name = waiting.pop(0), "INP"
        elif word == 902:
            output.append(acc)
            name = "OUT"
        else:
            name = _NAMES.get(word - address)
            if name is None:
                raise LMCError(f"mailbox {here} holds {word}, which is not an instruction")
            if name == "ADD":
                acc += memory[address]
            elif name == "SUB":
                acc -= memory[address]
            elif name == "STA":
                memory[address] = acc
            elif name == "LDA":
                acc = memory[address]
            elif name == "BRA" or (name == "BRZ" and acc == 0) or (name == "BRP" and acc >= 0):
                pc = address
        if not -999 <= acc <= 999:
            raise LMCError(f"the accumulator went outside -999 to 999 at mailbox {here}")
        trace.append((here, name, acc))
    raise LMCError(f"stopped after {max_steps} steps (is a loop endless?)")
