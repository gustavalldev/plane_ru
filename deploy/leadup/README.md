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

## Notes

Do not commit `runtime/variables.env`; it contains production secrets.
