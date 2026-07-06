import os
import tempfile
import threading
from pathlib import Path
from typing import Annotated

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile, status


MODEL_SIZE = os.environ.get("WHISPER_MODEL_SIZE", "small")
DEVICE = os.environ.get("WHISPER_DEVICE", "cpu")
COMPUTE_TYPE = os.environ.get("WHISPER_COMPUTE_TYPE", "int8")
LANGUAGE = os.environ.get("WHISPER_LANGUAGE", "ru")
API_TOKEN = os.environ.get("TRANSCRIPTION_API_TOKEN", "")
UPLOAD_SIZE_LIMIT = int(os.environ.get("TRANSCRIPTION_UPLOAD_SIZE_LIMIT", str(25 * 1024 * 1024)))
ALLOWED_AUDIO_TYPES = {
    "audio/webm",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "video/webm",
}

app = FastAPI(title="Plane transcription", version="0.1.0")
_model = None
_model_lock = threading.Lock()


def require_token(authorization: Annotated[str | None, Header()] = None) -> None:
    if not API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="TRANSCRIPTION_API_TOKEN is not configured",
        )

    expected = f"Bearer {API_TOKEN}"
    if authorization != expected:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid transcription token")


def load_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from faster_whisper import WhisperModel

                _model = WhisperModel(MODEL_SIZE, device=DEVICE, compute_type=COMPUTE_TYPE)
    return _model


async def persist_upload(audio: UploadFile) -> Path:
    if audio.content_type not in ALLOWED_AUDIO_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported audio type")

    suffix = Path(audio.filename or "audio.webm").suffix or ".webm"
    size = 0
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as output:
        while chunk := await audio.read(1024 * 1024):
            size += len(chunk)
            if size > UPLOAD_SIZE_LIMIT:
                Path(output.name).unlink(missing_ok=True)
                raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Audio is too large")
            output.write(chunk)
        if size == 0:
            Path(output.name).unlink(missing_ok=True)
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Audio is empty")
        return Path(output.name)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/v1/transcribe", dependencies=[Depends(require_token)])
async def transcribe(audio: Annotated[UploadFile, File()]) -> dict:
    path = await persist_upload(audio)
    try:
        model = load_model()
        segments, info = model.transcribe(
            str(path),
            language=LANGUAGE or None,
            vad_filter=True,
        )
        segment_payload = [
            {"start": segment.start, "end": segment.end, "text": segment.text.strip()} for segment in segments
        ]
        text = " ".join(segment["text"] for segment in segment_payload).strip()
        return {
            "text": text,
            "language": getattr(info, "language", LANGUAGE),
            "duration": getattr(info, "duration", None),
            "segments": segment_payload,
        }
    finally:
        path.unlink(missing_ok=True)
