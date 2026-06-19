# Lead-Up Plane Deployment

This folder contains the company deployment layer for Plane on `todo-dev`.

## Target

- Domain: `todo.lead-up.ru`
- Server: `88.218.70.102`
- Server path: `/opt/leadup_plane`
- Plane release: `v1.3.1`
- Runtime path: `/opt/leadup_plane/deploy/leadup/runtime`

DNS must contain:

```text
todo.lead-up.ru.  A  88.218.70.102
```

## Layout

- `bin/bootstrap-runtime.sh` downloads the pinned Plane release compose assets and renders `variables.env`.
- `nginx/todo.lead-up.ru.conf` proxies public HTTPS traffic to the local Plane proxy port.
- `runtime/` is generated on the server and intentionally ignored by Git.
- `docker-compose.source.yml` overrides the release app images with images built from this fork while keeping the generated runtime services, ports, and volumes intact.

## Deploy Custom Source

From `/opt/leadup_plane/deploy/leadup/runtime`:

```bash
docker compose --env-file variables.env -p leadup-plane \
  -f docker-compose.yml \
  -f ../docker-compose.source.yml \
  build web space api worker beat-worker migrator

docker compose --env-file variables.env -p leadup-plane \
  -f docker-compose.yml \
  -f ../docker-compose.source.yml \
  up -d migrator api worker beat-worker web space
```

## Notes

Do not commit `runtime/variables.env`; it contains production secrets.
