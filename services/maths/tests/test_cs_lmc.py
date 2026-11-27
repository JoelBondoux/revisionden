"""Computer Science engine: Little Man Computer (OCR H446 1.2.4 (c), appendix 5d mnemonics)."""
import pytest

from app.cs.lmc import LMCError, assemble, run

ADD_TWO = """
        INP
        STA FIRST
        INP
        ADD FIRST
        OUT
        HLT
FIRST   DAT
"""

COUNTDOWN = """
        INP
LOOP    OUT
        SUB ONE
        BRP LOOP
        HLT
ONE     DAT 1
"""


def test_adding_two_inputs():
    assert run(ADD_TWO, [5, 7]).output == [12]


def test_a_countdown_loop_with_branch_if_positive():
    result = run(COUNTDOWN, [3])
    assert result.output == [3, 2, 1, 0]
    assert result.accumulator == -1


def test_branch_if_zero_and_branch_always():
    program = """
        INP
        BRZ ZERO
        LDA ONE
        BRA DONE
ZERO    LDA TWO
DONE    OUT
        HLT
ONE     DAT 1
TWO     DAT 2
"""
    assert run(program, [0]).output == [2]
    assert run(program, [9]).output == [1]


def test_the_accepted_alternative_mnemonics():  # appendix 5d: STO, LOAD, BR, BZ, BP, IN, COB...
    program = """
        IN
        STO X
        LOAD X
        BZ END
        BP END
        BR END
END     OUT
        COB
X       DAT
"""
    assert run(program, [4]).output == [4]
    assert run("INPUT\nOUT\nEND", [6]).output == [6]


def test_assembly_puts_each_instruction_in_a_mailbox():
    memory = assemble(ADD_TWO)
    assert memory[:7] == [901, 306, 901, 106, 902, 0, 0]


def test_numeric_addresses_are_allowed():
    assert run("INP\nSTA 9\nLDA 9\nOUT\nHLT", [8]).output == [8]


def test_a_trace_records_each_instruction():
    result = run("INP\nOUT\nHLT", [2])
    assert result.trace == [(0, "INP", 2), (1, "OUT", 2), (2, "HLT", 2)]


@pytest.mark.parametrize("source, words", [
    ("FOO 1", "FOO"),
    ("LDA MISSING\nHLT", "MISSING"),
    ("BRA LOOP\nLOOP HLT\nLOOP HLT", "twice"),
    ("DAT 1000", "999"),
    ("\n".join(["HLT"] * 101), "100"),
    ("ADD", "address"),
])
def test_programs_that_cannot_be_assembled(source, words):
    with pytest.raises(LMCError, match=words):
        assemble(source)


def test_runtime_problems():
    with pytest.raises(LMCError, match="input"):
        run("INP\nHLT", [])
    with pytest.raises(LMCError, match="steps"):
        run("LOOP BRA LOOP", [], max_steps=50)
    with pytest.raises(LMCError, match="999"):
        run("INP\nADD X\nHLT\nX DAT 999", [5])


def test_more_assembly_and_running_errors():
    with pytest.raises(LMCError, match="too many words"):
        assemble("A B C D")
    with pytest.raises(LMCError, match="not a mailbox"):
        assemble("LDA 100")
    with pytest.raises(LMCError, match="not an instruction"):
        run("BRA 2\nHLT\nDAT 400", [])
