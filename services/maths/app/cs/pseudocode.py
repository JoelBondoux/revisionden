"""An interpreter for OCR's exam reference pseudocode (H446 appendix 5d), for trace tables and
program output that are computed, never typed by hand.

Covered: assignment, ``global``, casting (``int``, ``str``, ``float``), ``print``, ``input``
(from a supplied list), ``for ... to ... [step] / next``, ``while / endwhile``, ``do / until``,
``if / elseif / else / endif``, ``switch / case / default / endswitch``, the arithmetic,
comparison and logical operators, ``.length`` and ``.substring``, functions and procedures with
``byVal`` and ``byRef``, recursion, arrays of any dimension, and ``//`` comments. Not covered
yet: files and classes.

Our choices where appendix 5d is silent (items must not depend on them): ``/`` gives a whole
number when it divides exactly; ``DIV`` and ``MOD`` round down (as Python); booleans print as
``true`` and ``false``; ``NOT`` binds looser than comparisons, so ``NOT a==b`` is ``NOT (a==b)``; ``^`` binds
tighter than a minus sign, so ``-2^2`` is -4.

Nothing is passed to Python's ``eval``: programs are tokenised, parsed and walked here, with a
step limit so a runaway loop stops.
"""
import copy
import re
from dataclasses import dataclass, field

MAX_STEPS = 100_000


class PseudocodeError(Exception):
    """A program that cannot be read or run; the message names the line."""


# ---------------------------------------------------------------- tokens

_TOKEN = re.compile(r"""
    (?P<space>\s+)
  | (?P<number>\d+\.\d+|\d+)
  | (?P<string>["“”][^"“”]*["“”])
  | (?P<word>(?:MOD|DIV)(?=\d)|[A-Za-z_][A-Za-z0-9_]*)
  | (?P<op>==|!=|<=|>=|[-+*/^<>=()\[\],.:])
""", re.VERBOSE)
_KEYWORD_OPS = {"MOD", "DIV", "AND", "OR", "NOT"}


@dataclass
class Tok:
    kind: str  # num, str, name, op
    value: object


def _strip_comment(line: str) -> str:
    in_string = False
    for i, ch in enumerate(line):
        if ch in "\"“”":
            in_string = not in_string
        elif not in_string and line.startswith("//", i):
            return line[:i]
    return line


def _tokenise(text: str, line_no: int) -> list[Tok]:
    tokens, at = [], 0
    while at < len(text):
        m = _TOKEN.match(text, at)
        if not m:
            raise PseudocodeError(f"line {line_no}: cannot read {text[at]!r}")
        at = m.end()
        kind = m.lastgroup
        value = m.group()
        if kind == "space":
            continue
        if kind == "number":
            tokens.append(Tok("num", float(value) if "." in value else int(value)))
        elif kind == "string":
            tokens.append(Tok("str", value[1:-1]))
        elif kind == "word":
            tokens.append(Tok("op", value) if value in _KEYWORD_OPS else Tok("name", value))
        else:
            tokens.append(Tok("op", value))
    return tokens


# ---------------------------------------------------------------- expressions


class _Expr:
    """Recursive descent over one line's tokens. Loosest first: OR, AND, NOT, comparison,
    + -, * / MOD DIV, unary minus, ^ (right to left), then calls, indexes and .length."""

    COMPARE = ("==", "!=", "<", "<=", ">", ">=")

    def __init__(self, tokens: list[Tok], line: int):
        self.t, self.i, self.line = tokens, 0, line

    def error(self, message: str):
        return PseudocodeError(f"line {self.line}: {message}")

    def peek(self, value=None):
        if self.i >= len(self.t):
            return None
        tok = self.t[self.i]
        if value is None:
            return tok
        return tok if tok.kind in ("op", "name") and tok.value == value else None

    def take(self, value=None):
        tok = self.peek(value)
        if tok is None:
            if value is None:
                raise self.error("an expression is missing")
            raise self.error(f"expected {value!r}" + (" (a bracket is not closed)"
                                                       if value in (")", "]") else ""))
        self.i += 1
        return tok

    def done(self) -> bool:
        return self.i >= len(self.t)

    def parse(self):
        node = self.or_()
        return node

    def or_(self):
        node = self.and_()
        while self.peek("OR"):
            self.take()
            node = ("bin", "OR", node, self.and_())
        return node

    def and_(self):
        node = self.not_()
        while self.peek("AND"):
            self.take()
            node = ("bin", "AND", node, self.not_())
        return node

    def not_(self):
        if self.peek("NOT"):
            self.take()
            return ("not", self.not_())
        return self.compare()

    def compare(self):
        node = self.add()
        tok = self.peek()
        if tok and tok.kind == "op" and tok.value in self.COMPARE:
            self.take()
            node = ("bin", tok.value, node, self.add())
        return node

    def add(self):
        node = self.mul()
        while (tok := self.peek()) and tok.kind == "op" and tok.value in ("+", "-"):
            self.take()
            node = ("bin", tok.value, node, self.mul())
        return node

    def mul(self):
        node = self.unary()
        while (tok := self.peek()) and tok.kind == "op" and tok.value in ("*", "/", "MOD", "DIV"):
            self.take()
            node = ("bin", tok.value, node, self.unary())
        return node

    def unary(self):
        if self.peek("-"):
            self.take()
            return ("neg", self.unary())
        return self.power()

    def power(self):
        node = self.postfix()
        if self.peek("^"):
            self.take()
            return ("bin", "^", node, self.unary())
        return node

    def args(self, close: str):
        items = []
        if not self.peek(close):
            items.append(self.parse())
            while self.peek(","):
                self.take()
                items.append(self.parse())
        self.take(close)
        return items

    def postfix(self):
        node = self.atom()
        while True:
            if self.peek("(") and node[0] == "var":
                self.take()
                node = ("call", node[1], self.args(")"))
            elif self.peek("["):
                self.take()
                node = ("index", node, self.args("]"))
            elif self.peek("."):
                self.take()
                name = self.take()
                if name.kind != "name":
                    raise self.error("expected a name after '.'")
                if name.value == "length":
                    node = ("length", node)
                elif name.value.lower() == "substring":
                    self.take("(")
                    node = ("substring", node, self.args(")"))
                else:
                    raise self.error(f"unknown string operation .{name.value}")
            else:
                return node

    def atom(self):
        tok = self.peek()
        if tok is None:
            raise self.error("an expression is missing")
        self.i += 1
        if tok.kind == "num":
            return ("lit", tok.value)
        if tok.kind == "str":
            return ("lit", tok.value)
        if tok.kind == "name":
            if tok.value in ("true", "false"):
                return ("lit", tok.value == "true")
            return ("var", tok.value)
        if tok.value == "(":
            node = self.parse()
            self.take(")")
            return node
        raise self.error(f"unexpected {tok.value!r}")


def _expression(tokens: list[Tok], line: int):
    parser = _Expr(tokens, line)
    node = parser.parse()
    if not parser.done():
        raise parser.error(f"unexpected {parser.peek().value!r}")
    return node


# ---------------------------------------------------------------- statements

@dataclass
class _Line:
    no: int
    tokens: list[Tok]

    @property
    def head(self) -> str:
        first = self.tokens[0]
        return first.value.lower() if first.kind == "name" else ""


def _split(tokens: list[Tok], value: str) -> int:
    """Index of the first top-level token ``value`` (outside brackets), or -1."""
    depth = 0
    for i, tok in enumerate(tokens):
        if tok.kind == "op" and tok.value in ("(", "["):
            depth += 1
        elif tok.kind == "op" and tok.value in (")", "]"):
            depth -= 1
        elif depth == 0 and tok.kind in ("op", "name") and tok.value == value:
            return i
    return -1


_ENDERS = {"endwhile", "endif", "endswitch", "endfunction", "endprocedure", "next", "until",
           "elseif", "else", "case", "default", "endclass"}


class _Program:
    def __init__(self, source: str):
        self.lines = []
        for no, raw in enumerate(source.splitlines(), start=1):
            text = _strip_comment(raw).strip()
            if text:
                self.lines.append(_Line(no, _tokenise(text, no)))
        self.at = 0
        self.subroutines = {}
        self.body = self.block(set())
        if self.at < len(self.lines):
            line = self.lines[self.at]
            raise PseudocodeError(f"line {line.no}: '{line.head}' without a matching start")

    def error(self, line: _Line, message: str):
        return PseudocodeError(f"line {line.no}: {message}")

    def block(self, stop: set) -> list:
        statements = []
        while self.at < len(self.lines):
            line = self.lines[self.at]
            if line.head in _ENDERS:
                if line.head in stop:
                    return statements
                raise self.error(line, f"'{line.head}' without a matching start")
            self.at += 1
            node = self.statement(line)
            if node is not None:
                statements.append(node)
        if stop:
            last = self.lines[-1].no if self.lines else 0
            raise PseudocodeError(f"line {last}: the program ends before "
                                  + " or ".join(sorted(stop)))
        return statements

    def expect(self, stop: str) -> _Line:
        line = self.lines[self.at]
        if line.head != stop:
            raise self.error(line, f"expected {stop}")
        self.at += 1
        return line

    def statement(self, line: _Line):
        t, head, no = line.tokens, line.head, line.no
        if head == "for":
            eq, to = _split(t, "="), _split(t, "to")
            step = _split(t, "step")
            if eq != 2 or to < 0 or t[1].kind != "name":
                raise self.error(line, "a for loop reads 'for i=start to end'")
            end = _expression(t[to + 1:step if step > 0 else None], no)
            by = _expression(t[step + 1:], no) if step > 0 else ("lit", 1)
            body = self.block({"next"})
            self.expect("next")
            return ("for", no, t[1].value, _expression(t[3:to], no), end, by, body)
        if head == "while":
            body = self.block({"endwhile"})
            self.expect("endwhile")
            return ("while", no, _expression(t[1:], no), body)
        if head == "do":
            body = self.block({"until"})
            until = self.expect("until")
            return ("do", no, body, _expression(until.tokens[1:], until.no))
        if head == "if":
            return self.if_(line)
        if head == "switch":
            return self.switch(line)
        if head in ("function", "procedure"):
            return self.subroutine(line, head)
        if head == "return":
            return ("return", no, _expression(t[1:], no) if len(t) > 1 else ("lit", None))
        if head == "global":
            return self.assignment(_Line(no, t[1:]), is_global=True)
        if head == "array":
            if len(t) < 4 or t[1].kind != "name" or t[2].value != "[":
                raise self.error(line, "an array reads 'array name[size]'")
            parser = _Expr(t[3:], no)
            sizes = parser.args("]")
            return ("array", no, t[1].value, sizes)
        if _split(t, "=") > 0:
            return self.assignment(line)
        return ("expr", no, _expression(t, no))

    def assignment(self, line: _Line, is_global: bool = False):
        t, no = line.tokens, line.no
        eq = _split(t, "=")
        if eq <= 0:
            raise self.error(line, "expected an assignment")
        target = _expression(t[:eq], no)
        if target[0] not in ("var", "index"):
            raise self.error(line, "only a variable or an array element can be assigned")
        if eq == len(t) - 1:
            raise self.error(line, "an expression is missing after '='")
        return ("assign", no, target, _expression(t[eq + 1:], no), is_global)

    def if_(self, line: _Line):
        branches, otherwise = [], []
        current = line
        while True:
            t = current.tokens
            if not t or t[-1].value != "then":
                raise self.error(current, "an if or elseif line ends with 'then'")
            start = 1
            branches.append((_expression(t[start:-1], current.no),
                             self.block({"elseif", "else", "endif"})))
            nxt = self.lines[self.at]
            self.at += 1
            if nxt.head == "elseif":
                current = nxt
                continue
            if nxt.head == "else":
                otherwise = self.block({"endif"})
                self.expect("endif")
            return ("if", line.no, branches, otherwise)

    def switch(self, line: _Line):
        t = line.tokens
        if t[-1].value != ":":
            raise self.error(line, "a switch line ends with ':'")
        subject = _expression(t[1:-1], line.no)
        cases, default = [], []
        while True:
            if self.at >= len(self.lines):
                raise self.error(line, "the program ends before endswitch")
            nxt = self.lines[self.at]
            self.at += 1
            if nxt.head == "case":
                if nxt.tokens[-1].value != ":":
                    raise self.error(nxt, "a case line ends with ':'")
                value = _expression(nxt.tokens[1:-1], nxt.no)
                cases.append((value, self.block({"case", "default", "endswitch"})))
            elif nxt.head == "default":
                default = self.block({"endswitch"})
            elif nxt.head == "endswitch":
                return ("switch", line.no, subject, cases, default)
            else:
                raise self.error(nxt, "expected case, default or endswitch")

    def subroutine(self, line: _Line, kind: str):
        t = line.tokens
        if len(t) < 4 or t[1].kind != "name" or t[2].value != "(" or t[-1].value != ")":
            raise self.error(line, f"a {kind} reads '{kind} name(parameters)'")
        params, i = [], 3
        while i < len(t) - 1:
            name = t[i]
            if name.kind != "name":
                raise self.error(line, "a parameter must be a name")
            mode = "byVal"
            i += 1
            if i < len(t) - 1 and t[i].value == ":":
                mode = t[i + 1].value
                if mode not in ("byVal", "byRef"):
                    raise self.error(line, "a parameter is passed byVal or byRef")
                i += 2
            params.append((name.value, mode))
            if i < len(t) - 1:
                if t[i].value != ",":
                    raise self.error(line, "parameters are separated by commas")
                i += 1
        end = "end" + kind
        body = self.block({end})
        self.expect(end)
        self.subroutines[t[1].value] = (kind, params, body)
        return None


# ---------------------------------------------------------------- running


class _Return(Exception):
    def __init__(self, value):
        self.value = value


def _show(value) -> str:
    if isinstance(value, bool):
        return "true" if value else "false"
    if value is None:
        return ""
    return str(value)


@dataclass
class Result:
    output: list[str]
    variables: dict
    trace: list[dict] = field(default_factory=list)


class _Machine:
    def __init__(self, program: _Program, inputs: list[str], max_steps: int):
        self.program, self.inputs, self.max_steps = program, list(inputs), max_steps
        self.globals, self.main, self.frames = {}, {}, []
        self.output, self.trace, self.steps = [], [], 0
        self.line = 0

    def error(self, message: str):
        return PseudocodeError(f"line {self.line}: {message}")

    # variables
    def scope(self) -> dict:
        return self.frames[-1] if self.frames else self.main

    def get(self, name: str):
        for place in (self.scope(), self.globals):
            if name in place:
                return place[name]
        raise self.error(f"{name} is not defined")

    def set(self, name: str, value, is_global: bool = False):
        if is_global:
            self.globals[name] = value
        elif name in self.globals and name not in self.scope():
            self.globals[name] = value
        else:
            self.scope()[name] = value
        self.trace.append({"line": self.line, name: value})

    # statements
    def tick(self, no: int):
        self.line = no
        self.steps += 1
        if self.steps > self.max_steps:
            raise self.error(f"stopped after {self.max_steps} steps (is a loop endless?)")

    def run_block(self, statements: list):
        for node in statements:
            self.run(node)

    def run(self, node):
        kind, no = node[0], node[1]
        self.tick(no)
        if kind == "assign":
            _, _, target, expr, is_global = node
            value = self.eval(expr)
            if target[0] == "var":
                self.set(target[1], value, is_global)
            else:
                array, where = self.element(target)
                array[where] = value
                self.trace.append({"line": no, self.describe(target): value})
        elif kind == "expr":
            self.eval(node[2], statement=True)
        elif kind == "for":
            _, _, name, start, end, by, body = node
            value, last, step = self.eval(start), self.eval(end), self.eval(by)
            if step == 0:
                raise self.error("a for loop's step cannot be 0")
            while (value <= last) if step > 0 else (value >= last):
                self.line = no
                self.set(name, value)
                self.run_block(body)
                self.tick(no)
                value += step
        elif kind == "while":
            while self.truth(node[2]):
                self.run_block(node[3])
                self.tick(no)
        elif kind == "do":
            while True:
                self.run_block(node[2])
                self.tick(no)
                if self.truth(node[3]):
                    break
        elif kind == "if":
            for condition, body in node[2]:
                if self.truth(condition):
                    self.run_block(body)
                    return
            self.run_block(node[3])
        elif kind == "switch":
            subject = self.eval(node[2])
            for value, body in node[3]:
                if self.eval(value) == subject:
                    self.run_block(body)
                    return
            self.run_block(node[4])
        elif kind == "return":
            raise _Return(self.eval(node[2]))
        elif kind == "array":
            sizes = [self.eval(s) for s in node[3]]
            self.set(node[2], self._make_array(sizes))

    def _make_array(self, sizes: list):
        if not all(isinstance(s, int) and s > 0 for s in sizes):
            raise self.error("array sizes are positive whole numbers")
        if len(sizes) == 1:
            return [None] * sizes[0]
        return [self._make_array(sizes[1:]) for _ in range(sizes[0])]

    def truth(self, expr) -> bool:
        value = self.eval(expr)
        if not isinstance(value, bool):
            raise self.error("a condition must be true or false")
        return value

    def describe(self, target) -> str:
        indexes = ",".join(_show(self.eval(i)) for i in target[2])
        return f"{target[1][1]}[{indexes}]"

    def element(self, target):
        array = self.eval(target[1])
        indexes = [self.eval(i) for i in target[2]]
        for depth, where in enumerate(indexes):
            if not isinstance(array, list):
                raise self.error("only an array can be indexed")
            if not isinstance(where, int) or not 0 <= where < len(array):
                raise self.error(f"index {_show(where)} is outside the array (0 to "
                                 f"{len(array) - 1})")
            if depth < len(indexes) - 1:
                array = array[where]
        return array, indexes[-1]

    # expressions
    def eval(self, node, statement: bool = False):
        kind = node[0]
        if kind == "lit":
            return node[1]
        if kind == "var":
            return self.get(node[1])
        if kind == "neg":
            value = self.eval(node[1])
            if isinstance(value, bool) or not isinstance(value, (int, float)):
                raise self.error("only a number can be made negative")
            return -value
        if kind == "not":
            value = self.eval(node[1])
            if not isinstance(value, bool):
                raise self.error("NOT needs true or false")
            return not value
        if kind == "bin":
            return self.binary(node[1], node[2], node[3])
        if kind == "index":
            array, where = self.element(node)
            return array[where]
        if kind == "length":
            value = self.eval(node[1])
            if not isinstance(value, (str, list)):
                raise self.error(".length needs a string or an array")
            return len(value)
        if kind == "substring":
            text = self.eval(node[1])
            if not isinstance(text, str) or len(node[2]) != 2:
                raise self.error(".substring needs a string and two numbers")
            start, count = (self.eval(a) for a in node[2])
            return text[start:start + count]
        return self.call(node[1], node[2], statement)

    def binary(self, op: str, left, right):
        if op == "AND":
            return self.truth(left) and self.truth(right)
        if op == "OR":
            return self.truth(left) or self.truth(right)
        a, b = self.eval(left), self.eval(right)
        if op == "==":
            return a == b
        if op == "!=":
            return a != b
        numbers = all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in (a, b))
        if op == "+":
            if isinstance(a, str) and isinstance(b, str):
                return a + b
            if not numbers:
                raise self.error(f"cannot add {_show(a)!r} and {_show(b)!r}; use str() to join")
            return a + b
        if op in ("<", "<=", ">", ">="):
            if not (numbers or (isinstance(a, str) and isinstance(b, str))):
                raise self.error(f"cannot compare {_show(a)!r} and {_show(b)!r}")
            return {"<": a < b, "<=": a <= b, ">": a > b, ">=": a >= b}[op]
        if not numbers:
            raise self.error(f"{op} needs two numbers")
        if op == "-":
            return a - b
        if op == "*":
            return a * b
        if op == "^":
            return a ** b
        if b == 0:
            raise self.error("division by zero")
        if op == "/":
            if isinstance(a, int) and isinstance(b, int) and a % b == 0:
                return a // b
            return a / b
        if op == "DIV":
            return a // b
        return a % b

    def call(self, name: str, args: list, statement: bool):
        builtins = {"print", "input", "int", "str", "float"}
        if name in builtins:
            values = [self.eval(a) for a in args]
            if name == "print":
                text = " ".join(_show(v) for v in values)
                self.output.append(text)
                self.trace.append({"line": self.line, "output": text})
                return None
            if name == "input":
                if not self.inputs:
                    raise self.error("input() was called but no more input was given")
                return self.inputs.pop(0)
            if len(values) != 1:
                raise self.error(f"{name}() takes one value")
            try:
                return {"int": int, "str": _show, "float": float}[name](values[0])
            except (TypeError, ValueError):
                raise self.error(f"{name}() cannot convert {_show(values[0])!r}") from None
        if name not in self.program.subroutines:
            raise self.error(f"{name} is not a function or procedure")
        kind, params, body = self.program.subroutines[name]
        if len(args) != len(params):
            raise self.error(f"{name} takes {len(params)} values, not {len(args)}")
        frame = {}
        for (param, mode), arg in zip(params, args):
            value = self.eval(arg)
            frame[param] = value if mode == "byRef" else copy.deepcopy(value)
        self.frames.append(frame)
        caller_line = self.line
        result = None
        try:
            self.run_block(body)
        except _Return as done:
            result = done.value
        finally:
            self.frames.pop()
            self.line = caller_line
        for (param, mode), arg in zip(params, args):
            if mode == "byRef" and arg[0] == "var":
                self.set(arg[1], frame[param])
        if kind == "function" and result is None and not statement:
            raise self.error(f"function {name} did not return a value")
        return result


def run(source: str, inputs: list[str] | None = None, max_steps: int = MAX_STEPS) -> Result:
    """Run a program. Returns what it printed, the main program's final variables (and any
    globals) and a trace: one entry per assignment or output, with its line."""
    machine = _Machine(_Program(source), inputs or [], max_steps)
    try:
        machine.run_block(machine.program.body)
    except _Return:
        raise machine.error("return is only allowed inside a function or procedure") from None
    except RecursionError:
        raise machine.error("too many nested calls (is a recursion endless?)") from None
    return Result(machine.output, {**machine.globals, **machine.main}, machine.trace)


def trace_table(source: str, inputs: list[str] | None = None) -> list[dict]:
    """The trace as rows: each row is the line and the one variable (or output) it changed."""
    return run(source, inputs).trace
