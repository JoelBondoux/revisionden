"""Computer Science engine: OCR exam reference pseudocode (H446 appendix 5d).

Each program's output is worked by hand. Examples marked "spec" follow the shape of the
appendix 5d examples.
"""
import random
import re

import pytest

from app.cs.pseudocode import PseudocodeError, run, trace_table


def row(line, name, value, cell=None):
    """An assignment row: what the program named, the value, and the storage actually written."""
    return {"line": line, "name": name, "value": value, "cell": cell or name}


def out(source, inputs=()):
    return run(source, inputs=list(inputs)).output


def test_count_controlled_loop_includes_both_ends():  # spec: prints hello 8 times
    assert out('for i=0 to 7\n    print("Hello")\nnext i') == ["Hello"] * 8


def test_count_controlled_loop_with_a_step():
    assert out("for i=10 to 0 step -5\n print(i)\nnext i") == ["10", "5", "0"]
    assert out("for i=3 to 1\n print(i)\nnext i") == []


def test_condition_controlled_loops():  # spec: the password loops
    loop = 'answer=""\nwhile answer!="computer"\n    answer=input("What is the password?")\nendwhile\nprint(answer)'
    assert out(loop, ["cat", "computer"]) == ["computer"]
    until = 'do\n    answer=input("What is the password?")\nuntil answer=="computer"\nprint("in")'
    assert out(until, ["dog", "cat", "computer"]) == ["in"]


def test_input_runs_out_is_an_error():
    with pytest.raises(PseudocodeError, match="input"):
        run('x=input("?")', inputs=[])


@pytest.mark.parametrize("entry, shown", [("a", "You selected A"), ("b", "You selected B"),
                                          ("z", "Unrecognised selection")])
def test_if_elseif_else(entry, shown):  # spec
    program = '''entry=input("?")
if entry=="a" then
        print("You selected A")
elseif entry=="b" then
        print("You selected B")
else
        print("Unrecognised selection")
endif'''
    assert out(program, [entry]) == [shown]


@pytest.mark.parametrize("entry, shown", [("A", "You selected A"), ("B", "You selected B"),
                                          ("C", "Unrecognised selection")])
def test_switch_case(entry, shown):  # spec
    program = '''entry=input("?")
switch entry:
        case "A":
                print("You selected A")
        case "B":
                print("You selected B")
        default:
                print("Unrecognised selection")
endswitch'''
    assert out(program, [entry]) == [shown]


@pytest.mark.parametrize("expr, value", [
    ("6+5", "11"), ("6-5", "1"), ("12*2", "24"), ("12/2", "6"), ("7/2", "3.5"),
    ("12MOD5", "2"), ("12 MOD 5", "2"), ("17DIV5", "3"), ("17 DIV 5", "3"), ("3^4", "81"),
    ("2+3*4", "14"), ("(2+3)*4", "20"), ("2^3^2", "512"), ("-3+1", "-2"), ("10-2-3", "5"),
    ("-7 DIV 2", "-4"), ("-7 MOD 2", "1"),
])
def test_arithmetic(expr, value):  # spec: the arithmetic operator examples
    assert out(f"print({expr})") == [value]


@pytest.mark.parametrize("expr, value", [
    ("3==3", "true"), ("3!=3", "false"), ("2<3", "true"), ("3<=3", "true"), ("4>5", "false"),
    ("5>=5", "true"), ("true AND false", "false"), ("true OR false", "true"),
    ("NOT false", "true"), ("1<2 AND 2<3", "true"), ("NOT 1==2", "true"), ('"a"=="a"', "true"),
])
def test_comparison_and_logical_operators(expr, value):
    assert out(f"print({expr})") == [value]


def test_strings():  # spec: length and substring from the 0th character
    program = 'someText="Computer Science"\nprint(someText.length)\nprint(someText.substring(3,3))'
    assert out(program) == ["16", "put"]
    assert out('print("ab"+"cd")') == ["abcd"]
    assert out('s="Hello"\nprint(s.subString(1,3))') == ["ell"]


def test_casting():  # spec
    assert out('print(str(3)+"x")') == ["3x"]
    assert out('print(int("3")+1)') == ["4"]
    assert out('print(float("3.14")*2)') == ["6.28"]


def test_curly_quotes_are_read_as_quotes():
    assert out("name=“Bob”\nprint(name)") == ["Bob"]


def test_comments_are_ignored():  # spec
    assert out('print("Hello World") //This is a comment\n// a whole-line comment') == [
        "Hello World"]


def test_functions_and_procedures():  # spec
    program = '''function triple(number)
    return number*3
endfunction
procedure greeting(name)
    print("hello"+name)
endprocedure
y=triple(7)
print(y)
greeting("Hamish")'''
    assert out(program) == ["21", "helloHamish"]


def test_parameters_are_by_value_unless_by_ref():  # spec: foobar(x:byVal, y:byRef)
    program = '''procedure foobar(x:byVal, y:byRef)
    x=x+1
    y=y+1
endprocedure
a=1
b=1
foobar(a,b)
print(a)
print(b)'''
    assert out(program) == ["1", "2"]


def test_arrays_are_zero_based():  # spec
    program = '''array names[5]
names[0]="Ahmad"
names[1]="Ben"
names[2]="Catherine"
names[3]="Dana"
names[4]="Elijah"
print(names[3])'''
    assert out(program) == ["Dana"]
    assert out('Array board[8,8]\nboard[0,0]="rook"\nprint(board[0,0])') == ["rook"]


def test_array_index_out_of_range_is_an_error():
    with pytest.raises(PseudocodeError, match="line 2"):
        run("array a[3]\na[3]=1")


def test_local_variables_stay_inside_the_subroutine():
    program = "procedure p()\n    temp=5\nendprocedure\np()\nprint(temp)"
    with pytest.raises(PseudocodeError, match="temp"):
        run(program)


def test_global_variables_are_shared():  # spec: global userid = 123
    program = '''global userid = 123
procedure bump()
    userid = userid + 1
endprocedure
bump()
print(userid)'''
    assert out(program) == ["124"]


def test_recursion():
    program = '''function factorial(n)
    if n<=1 then
        return 1
    endif
    return n*factorial(n-1)
endfunction
print(factorial(5))'''
    assert out(program) == ["120"]


def test_return_leaves_a_loop_early():
    program = '''function firstOver(limit)
    for i=0 to 100
        if i*i>limit then
            return i
        endif
    next i
    return -1
endfunction
print(firstOver(50))'''
    assert out(program) == ["8"]


def test_a_runaway_loop_is_stopped():
    with pytest.raises(PseudocodeError, match="steps"):
        run("x=0\nwhile true\n    x=x+1\nendwhile", max_steps=1000)


@pytest.mark.parametrize("source, words", [
    ("while true\n print(1)", "endwhile"),
    ("if x==1\n print(1)\nendif", "then"),
    ("print(1", "bracket"),
    ("x=", "expression"),
    ("next i", "next"),
])
def test_syntax_errors_name_the_problem(source, words):
    with pytest.raises(PseudocodeError, match=words):
        run(source)


@pytest.mark.parametrize("source, words", [
    ("print(y)", "y"), ("print(1/0)", "zero"), ("print(1+\"a\")", "add"),
    ("x=nothing(1)", "nothing"),
])
def test_runtime_errors_name_the_problem(source, words):
    with pytest.raises(PseudocodeError, match=words):
        run(source)


def test_a_trace_records_every_assignment_and_output_with_its_line():
    program = "x=0\nfor i=1 to 3\n    x=x+i\nnext i\nprint(x)"
    rows = trace_table(program)
    assert rows == [
        row(1, "x", 0), row(2, "i", 1), row(3, "x", 1), row(2, "i", 2),
        row(3, "x", 3), row(2, "i", 3), row(3, "x", 6), {"line": 5, "output": "6"},
    ]


def test_the_final_variables_are_reported():
    assert run("a=2\nb=a*3").variables == {"a": 2, "b": 6}


@pytest.mark.parametrize("source, words", [
    ("x = 1 @ 2", "cannot read"),
    ("x = s.upper()", "unknown string operation"),
    ("x = s.1", "name after"),
    ("x = )", "unexpected"),
    ("x = 1 2", "unexpected"),
    ("for 1=0 to 3\nnext i", "for loop reads"),
    ("do\n print(1)", "until"),
    ("switch x\nendswitch", "ends with ':'"),
    ('switch x:\n case "a"\nendswitch', "ends with ':'"),
    ("switch x:\n print(1)\nendswitch", "expected case"),
    ("switch x:", "endswitch"),
    ("function f\nendfunction", "reads"),
    ("function f(1)\nendfunction", "parameter must be a name"),
    ("function f(a:byPointer)\nendfunction", "byVal or byRef"),
    ("function f(a b)\nendfunction", "commas"),
    ("array", "array reads"),
    ("global = 3", "assignment"),
    ("1 = 2", "only a variable"),
    ("while true\n print(1)\nendif", "endif"),
    ("if true then\n print(1)\nelse\n print(2)\nnext i", "next"),
    ("for i=0 to 2\n print(i)\nendwhile", "endwhile"),
])
def test_more_syntax_errors(source, words):
    with pytest.raises(PseudocodeError, match=words):
        run(source)


@pytest.mark.parametrize("source, words", [
    ("for i=0 to 3 step 0\nnext i", "step cannot be 0"),
    ("array a[0]", "positive whole numbers"),
    ("if 1 then\nendif", "true or false"),
    ("x=5\nprint(x[0])", "only an array"),
    ('print(-"a")', "negative"),
    ("print(NOT 1)", "NOT needs"),
    ("print(5.length)", ".length needs"),
    ('print("abc".substring(1))', ".substring needs"),
    ('print(1 < "a")', "cannot compare"),
    ('print("a" - "b")', "two numbers"),
    ('print(int("x"))', "cannot convert"),
    ("print(int(1, 2))", "takes one value"),
    ("function f(a)\n return a\nendfunction\nprint(f(1, 2))", "takes 1 values"),
    ("function f()\n x=1\nendfunction\nprint(f())", "did not return"),
    ("return 5", "only allowed inside"),
    ("function f(n)\n return f(n+1)\nendfunction\nprint(f(1))", "nested calls|steps"),
])
def test_more_runtime_errors(source, words):
    with pytest.raises(PseudocodeError, match=words):
        run(source)


def test_smaller_features():
    assert out("print(-2^2)") == ["-4"]                         # power binds tighter than minus
    assert out('print("b" > "a")') == ["true"]                 # strings compare alphabetically
    assert out("x=3\nx=x-1\nprint(x*2, x)") == ["4 2"]          # print joins values with spaces
    assert out("array a[2]\na[0]=4\nprint(a.length)") == ["2"]
    assert out("procedure p()\n return\nendprocedure\np()\nprint(1)") == ["1"]
    assert out("print(7 MOD 4)") == ["3"]
    assert out("print(true AND NOT false)") == ["true"]
    assert out('print(str(true))') == ["true"]


def test_byref_and_byval_arrays():
    program = '''procedure fill(a:byRef, b:byVal)
    a[0]=9
    b[0]=9
endprocedure
array x[1]
array y[1]
x[0]=1
y[0]=1
fill(x, y)
print(x[0])
print(y[0])'''
    assert out(program) == ["9", "1"]


def test_two_dimensional_trace_names_the_element():
    rows = trace_table("array g[2,2]\ng[1,0]=5")
    assert rows[-1] == row(2, "g[1,0]", 5)


# Codex review on #428 (P2s): byRef binds to the caller's storage; trace rows are snapshots;
# an array index is evaluated once.

def test_two_byref_parameters_on_the_same_variable_share_it():
    program = '''procedure p(a:byRef, b:byRef)
    a=2
    print(b)
endprocedure
x=1
p(x,x)
print(x)'''
    assert out(program) == ["2", "2"]


def test_byref_on_an_array_element_updates_the_element():
    program = '''procedure bump(n:byRef)
    n=n+1
endprocedure
array a[2]
a[0]=5
bump(a[0])
print(a[0])'''
    assert out(program) == ["6"]


def test_byref_passes_through_nested_calls_and_globals():
    program = '''global total = 1
procedure inner(t:byRef)
    t=t*10
endprocedure
procedure outer(t:byRef)
    inner(t)
endprocedure
outer(total)
print(total)'''
    assert out(program) == ["10"]


def test_byref_on_an_expression_is_just_its_value():
    program = "procedure p(n:byRef)\n    n=n+1\n    print(n)\nendprocedure\np(3+4)"
    assert out(program) == ["8"]


def test_trace_rows_keep_the_value_at_that_step():
    rows = trace_table("array a[1]\na[0]=1\na[0]=2")
    assert rows[0] == row(1, "a", [None])
    assert rows[1] == row(2, "a[0]", 1)
    assert rows[2] == row(3, "a[0]", 2)
    nested = trace_table("array a[1]\nb=a\na[0]=9")
    assert nested[1] == row(2, "b", [None])


def test_an_array_index_is_evaluated_once():
    program = '''global count = 0
function next()
    count = count + 1
    return count - 1
endfunction
array a[3]
a[next()] = 7
print(a[0])
print(count)'''
    result = run(program)
    assert result.output == ["7", "1"]
    assert row(7, "a[0]", 7) in result.trace
    assert run('array a[2]\na[int(input("?"))]=4\nprint(a[1])', inputs=["1"]).output == ["4"]



# Codex review on #428, round 2: trace metadata never clashes with a variable's name, and a
# chained index (a[0][1]) is labelled with the whole target.

def test_a_variable_called_line_or_output_keeps_its_own_row():
    rows = trace_table("line=7\noutput=2\nprint(line)")
    assert rows == [row(1, "line", 7), row(2, "output", 2), {"line": 3, "output": "7"}]


def test_chained_indexes_are_labelled_with_the_whole_target():
    rows = trace_table("array a[2,2]\na[0][1]=7\na[1][1]=8\na[1,0]=9")
    assert rows[1:] == [row(2, "a[0][1]", 7), row(3, "a[1][1]", 8), row(4, "a[1,0]", 9)]
    assert run("array a[2,2]\na[0][1]=7\nprint(a[0][1])\nprint(a[0,1])").output == ["7", "7"]


def test_a_byref_write_names_the_parameter_and_the_cell_it_changed():
    program = """procedure setTo(t:byRef, v)
    t=v
endprocedure
array a[2,2]
setTo(a[1][0], 5)
x=0
setTo(x, 3)"""
    rows = [r for r in trace_table(program) if "name" in r and r["name"] == "t"]
    assert rows == [row(2, "t", 5, "a[1][0]"), row(2, "t", 3, "x")]


def _canonical(label):
    name, rest = re.fullmatch(r"([A-Za-z_]\w*)((?:\[[^\]]*\])*)", label).groups()
    indexes = tuple(int(i) for group in re.findall(r"\[([^\]]*)\]", rest) for i in group.split(","))
    return name, indexes


@pytest.mark.parametrize("seed", range(150))
def test_random_programs_trace_labels_map_back_to_the_cells_written(seed):
    """Property test (lead, 2026-11-27): replaying every trace row's cell and value rebuilds the
    final arrays and variables exactly, for random nested-array writes and byRef calls."""
    rng = random.Random(seed)
    lines = ["procedure setTo(t:byRef, v)", "    t=v", "endprocedure",
             "procedure passOn(t:byRef, v)", "    setTo(t, v)", "endprocedure",
             "array a[3,3]", "array b[3]", "x=0"]
    for _ in range(rng.randint(5, 25)):
        i, j, v = rng.randrange(3), rng.randrange(3), rng.randint(-50, 50)
        target = rng.choice([f"a[{i},{j}]", f"a[{i}][{j}]", f"b[{i}]", "x"])
        how = rng.choice(["assign", "setTo", "passOn"])
        lines.append(f"{target}={v}" if how == "assign" else f"{how}({target}, {v})")
    result = run("\n".join(lines))
    model = {"a": [[None] * 3 for _ in range(3)], "b": [None] * 3, "x": 0}
    for r in result.trace:
        if "cell" not in r or r["cell"] in ("t", "v"):
            continue
        name, indexes = _canonical(r["cell"])
        if not indexes:
            model[name] = r["value"]
            continue
        place = model[name]
        for k in indexes[:-1]:
            place = place[k]
        place[indexes[-1]] = r["value"]
    assert model == {k: result.variables[k] for k in model}
