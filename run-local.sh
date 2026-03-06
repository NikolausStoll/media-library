#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo ".env file not found; please create one with TMDB_API_KEY, AI_API_KEY (optional), PORT, DB_PATH, STATIC_DIR, etc."
  exit 1
fi

source_env=.env

if [[ -f $source_env ]]; then
  export $(grep -v '^#' "$source_env" | cut -d= -f1)
else
  echo "$source_env file not found; continuing with defaults"
fi

readonly CONTAINER_NAME=media-library-local

cleanup() {
  if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}\$"; then
    docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT

docker build -t media-library .

cleanup

docker run --name "${CONTAINER_NAME}" -p 8099:8099 \
  --env-file .env \
  --env PORT=8099 \
  -v "$(pwd)/data:/data" \
  media-library
