from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_equivalent_endpoint():
    res = client.post("/equivalent", json={"a": "2*(x+3)", "b": "2*x+6"})
    assert res.status_code == 200
    assert res.json() == {"equivalent": True}


def test_bad_input_is_400():
    res = client.post("/equivalent", json={"a": "__import__('os')", "b": "1"})
    assert res.status_code == 400
