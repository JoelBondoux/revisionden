"""HTTP API for the maths engine (runs on Google Cloud Run)."""
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.equivalence import are_equivalent, solutions_match

app = FastAPI(title="RevisionDen maths engine")


class EquivalenceRequest(BaseModel):
    a: str
    b: str


class SolutionsRequest(BaseModel):
    expression: str
    answers: list[str]
    variable: str = "x"


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
