from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import main


class FakeSegment:
    def __init__(self, text, start=0.0, end=1.0):
        self.text = text
        self.start = start
        self.end = end


class FakeModel:
    def transcribe(self, path, language=None, vad_filter=False):
        assert language == "ru"
        assert vad_filter is True
        return [FakeSegment("Привет"), FakeSegment("мир", 1.0, 2.0)], SimpleNamespace(language="ru", duration=2.0)


def test_health_does_not_load_model(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "token")
    monkeypatch.setattr(main, "load_model", lambda: (_ for _ in ()).throw(AssertionError("model loaded")))

    client = TestClient(main.app)

    assert client.get("/health").json() == {"status": "ok"}


def test_transcribe_requires_token(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "token")
    client = TestClient(main.app)

    response = client.post(
        "/v1/transcribe",
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
    )

    assert response.status_code == 401


def test_transcribe_returns_text_without_real_model(monkeypatch):
    monkeypatch.setattr(main, "API_TOKEN", "token")
    monkeypatch.setattr(main, "load_model", lambda: FakeModel())
    client = TestClient(main.app)

    response = client.post(
        "/v1/transcribe",
        headers={"Authorization": "Bearer token"},
        files={"audio": ("voice.webm", b"audio", "audio/webm")},
    )

    assert response.status_code == 200
    assert response.json()["text"] == "Привет мир"
