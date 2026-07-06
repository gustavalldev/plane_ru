# Plane RU Deployment

This folder contains the company deployment layer for Plane on `disp-prod`.

## Target

- Domain: `disp.plane.ordbox.ru`
- Server: `45.87.246.135`
- Server path: `/opt/disp/deploy/plane_ru`
- Plane release: `v1.3.1`
- Runtime path: `/opt/disp/deploy/plane_ru/deploy/plane_ru/runtime`

DNS must contain:

```text
disp.plane.ordbox.ru.  A  45.87.246.135
```

## Layout

- `bin/bootstrap-runtime.sh` downloads the pinned Plane release compose assets and renders `variables.env`.
- `nginx/disp.plane.ordbox.ru.conf` proxies public HTTPS traffic to the local Plane proxy port.
- `transcription/` is a private FastAPI + `faster-whisper` service used by the Plane API proxy for voice comment transcription. It is not exposed by nginx or published on a host port.
- `runtime/` is generated on the server and intentionally ignored by Git.
- `docker-compose.source.yml` overrides the release app images with images built from this fork while keeping the generated runtime services, ports, and volumes intact.
- `plane-minio` is pinned to a `cpuv1` MinIO image because the `disp-prod` CPU profile does not support x86-64-v2 required by current `latest` images.

## Deploy Custom Source

From `/opt/disp/deploy/plane_ru/deploy/plane_ru/runtime`:

```bash
docker compose --env-file variables.env -p plane-ru \
  -f docker-compose.yml \
  -f ../docker-compose.source.yml \
  build transcription web space api worker beat-worker migrator

docker compose --env-file variables.env -p plane-ru \
  -f docker-compose.yml \
  -f ../docker-compose.source.yml \
  up -d plane-minio transcription migrator api worker beat-worker web space admin live proxy
```

## Notes

Do not commit `runtime/variables.env`; it contains production secrets.
The first transcription request lazily downloads/loads the Whisper model into the `transcription_cache` Docker volume. The service image installs `ffmpeg` so browser formats such as WebM/Opus and MP4/M4A can be decoded reliably.
