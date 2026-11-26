"""HTTP API for the maths engine (runs on Google Cloud Run)."""

from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, model_validator

from app.equivalence import are_equivalent, solutions_match
from app.working import MAX_LINES, check_working

app = FastAPI(title="RevisionDen maths engine")


class EquivalenceRequest(BaseModel):
    a: str
    b: str


class SolutionsRequest(BaseModel):
    expression: str
    answers: list[str]
    variable: str = "x"


class ExpectedAnswer(BaseModel):
    solutions: list[str] | None = None
    expression: str | None = None
    form: (
        Literal["factorised", "expanded", "fraction", "simplest_fraction", "standard_form",
                "index_form"]
        | None
    ) = None
    subject: str | None = Field(default=None, min_length=1, max_length=20)

    @model_validator(mode="after")
    def exactly_one_kind(self):
        if (self.solutions is None) == (self.expression is None):
            raise ValueError("Give either solutions or expression")
        return self


class WorkingRequest(BaseModel):
    lines: list[str] = Field(min_length=1, max_length=MAX_LINES)
    expected: ExpectedAnswer | None = None


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/equivalent")
def equivalent(req: EquivalenceRequest):
    try:
        return {"equivalent": are_equivalent(req.a, req.b)}
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.post("/solutions")
def solutions(req: SolutionsRequest):
    try:
        return {"correct": solutions_match(req.expression, req.answers, req.variable)}
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err


@app.post("/check-working")
def working(req: WorkingRequest):
    """Index (0-based) of the first line not equivalent to the one before, and final answer."""
    expected = req.expected.model_dump(exclude_none=True) if req.expected else None
    try:
        result = check_working(req.lines, expected)
    except ValueError as err:
        raise HTTPException(status_code=400, detail=str(err)) from err
    return {
        "first_wrong_line": result.first_wrong_line,
        "final_answer_correct": result.final_answer_correct,
    }
