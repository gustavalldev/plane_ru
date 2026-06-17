#!/usr/bin/env bash
set -Eeuo pipefail

RELEASE="${PLANE_RELEASE:-v1.3.1}"
DOMAIN="${PLANE_DOMAIN:-todo.lead-up.ru}"
HTTP_PORT="${PLANE_HTTP_PORT:-18080}"
HTTPS_PORT="${PLANE_HTTPS_PORT:-18443}"
BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME_DIR="${BASE_DIR}/runtime"

mkdir -p "${RUNTIME_DIR}"
cd "${RUNTIME_DIR}"

download() {
  local name="$1"
  curl -fsSL -o "${name}" "https://github.com/makeplane/plane/releases/download/${RELEASE}/${name}"
}

if [[ ! -f docker-compose.yml ]]; then
  download docker-compose.yml
fi

if [[ ! -f variables.env ]]; then
  download variables.env
fi

random_urlsafe() {
  openssl rand -base64 "${1:-48}" | tr -d '\n' | tr '+/' '-_' | tr -d '='
}

random_hex() {
  openssl rand -hex "${1:-24}"
}

set_env() {
  local key="$1"
  local value="$2"
  python3 - "${key}" "${value}" variables.env <<'PY'
import pathlib
import sys

key, value, path = sys.argv[1], sys.argv[2], pathlib.Path(sys.argv[3])
lines = path.read_text().splitlines()
prefix = f"{key}="

for index, line in enumerate(lines):
    if line.startswith(prefix):
        lines[index] = f"{key}={value}"
        break
else:
    lines.append(f"{key}={value}")

path.write_text("\n".join(lines) + "\n")
PY
}

restrict_proxy_ports_to_loopback() {
  python3 - docker-compose.yml <<'PY'
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
text = path.read_text()
replacements = (
    (
        """      - target: 80
        published: ${LISTEN_HTTP_PORT:-80}
        protocol: tcp
        mode: host""",
        """      - target: 80
        published: ${LISTEN_HTTP_PORT:-80}
        protocol: tcp
        mode: host
        host_ip: 127.0.0.1""",
    ),
    (
        """      - target: 443
        published: ${LISTEN_HTTPS_PORT:-443}
        protocol: tcp
        mode: host""",
        """      - target: 443
        published: ${LISTEN_HTTPS_PORT:-443}
        protocol: tcp
        mode: host
        host_ip: 127.0.0.1""",
    ),
)

for old, new in replacements:
    if new in text:
        continue
    if old not in text:
        raise SystemExit("Could not patch Plane proxy ports to localhost-only")
    text = text.replace(old, new, 1)

path.write_text(text)
PY
}

POSTGRES_PASSWORD_VALUE="$(grep -E '^POSTGRES_PASSWORD=' variables.env | cut -d= -f2-)"
RABBITMQ_PASSWORD_VALUE="$(grep -E '^RABBITMQ_PASSWORD=' variables.env | cut -d= -f2-)"
SECRET_KEY_VALUE="$(grep -E '^SECRET_KEY=' variables.env | cut -d= -f2-)"
AWS_ACCESS_KEY_ID_VALUE="$(grep -E '^AWS_ACCESS_KEY_ID=' variables.env | cut -d= -f2-)"
AWS_SECRET_ACCESS_KEY_VALUE="$(grep -E '^AWS_SECRET_ACCESS_KEY=' variables.env | cut -d= -f2-)"
LIVE_SERVER_SECRET_KEY_VALUE="$(grep -E '^LIVE_SERVER_SECRET_KEY=' variables.env | cut -d= -f2-)"

if [[ "${POSTGRES_PASSWORD_VALUE}" == "plane" || -z "${POSTGRES_PASSWORD_VALUE}" ]]; then
  POSTGRES_PASSWORD_VALUE="$(random_hex 24)"
fi

if [[ "${RABBITMQ_PASSWORD_VALUE}" == "plane" || -z "${RABBITMQ_PASSWORD_VALUE}" ]]; then
  RABBITMQ_PASSWORD_VALUE="$(random_hex 24)"
fi

if [[ "${SECRET_KEY_VALUE}" == "60gp0byfz2dvffa45cxl20p1scy9xbpf6d8c5y0geejgkyp1b5" || -z "${SECRET_KEY_VALUE}" ]]; then
  SECRET_KEY_VALUE="$(random_urlsafe 64)"
fi

if [[ "${AWS_ACCESS_KEY_ID_VALUE}" == "access-key" || -z "${AWS_ACCESS_KEY_ID_VALUE}" ]]; then
  AWS_ACCESS_KEY_ID_VALUE="$(random_hex 16)"
fi

if [[ "${AWS_SECRET_ACCESS_KEY_VALUE}" == "secret-key" || -z "${AWS_SECRET_ACCESS_KEY_VALUE}" ]]; then
  AWS_SECRET_ACCESS_KEY_VALUE="$(random_urlsafe 48)"
fi

if [[ "${LIVE_SERVER_SECRET_KEY_VALUE}" == "2FiJk1U2aiVPEQtzLehYGlTSnTnrs7LW" || -z "${LIVE_SERVER_SECRET_KEY_VALUE}" ]]; then
  LIVE_SERVER_SECRET_KEY_VALUE="$(random_urlsafe 48)"
fi

set_env APP_DOMAIN "${DOMAIN}"
set_env APP_RELEASE "${RELEASE}"
set_env LISTEN_HTTP_PORT "${HTTP_PORT}"
set_env LISTEN_HTTPS_PORT "${HTTPS_PORT}"
set_env WEB_URL "https://${DOMAIN}"
set_env CORS_ALLOWED_ORIGINS "https://${DOMAIN}"
set_env SITE_ADDRESS ":80"
set_env POSTGRES_USER "plane"
set_env POSTGRES_PASSWORD "${POSTGRES_PASSWORD_VALUE}"
set_env POSTGRES_DB "plane"
set_env POSTGRES_PORT "5432"
set_env DATABASE_URL "postgresql://plane:${POSTGRES_PASSWORD_VALUE}@plane-db/plane"
set_env RABBITMQ_USER "plane"
set_env RABBITMQ_PASSWORD "${RABBITMQ_PASSWORD_VALUE}"
set_env RABBITMQ_VHOST "plane"
set_env AMQP_URL "amqp://plane:${RABBITMQ_PASSWORD_VALUE}@plane-mq:5672/plane"
set_env SECRET_KEY "${SECRET_KEY_VALUE}"
set_env AWS_ACCESS_KEY_ID "${AWS_ACCESS_KEY_ID_VALUE}"
set_env AWS_SECRET_ACCESS_KEY "${AWS_SECRET_ACCESS_KEY_VALUE}"
set_env AWS_S3_ENDPOINT_URL "http://plane-minio:9000"
set_env AWS_S3_BUCKET_NAME "uploads"
set_env USE_MINIO "1"
set_env MINIO_ENDPOINT_SSL "0"
set_env FILE_SIZE_LIMIT "52428800"
set_env API_KEY_RATE_LIMIT "60/minute"
set_env LIVE_SERVER_SECRET_KEY "${LIVE_SERVER_SECRET_KEY_VALUE}"
set_env TRUSTED_PROXIES "127.0.0.1"
set_env CERT_EMAIL ""
set_env CERT_ACME_CA "https://acme-v02.api.letsencrypt.org/directory"
set_env CERT_ACME_DNS ""

restrict_proxy_ports_to_loopback

chmod 600 variables.env

echo "Plane runtime prepared in ${RUNTIME_DIR}"
echo "Release: ${RELEASE}"
echo "Domain: ${DOMAIN}"
echo "HTTP port: ${HTTP_PORT}"
