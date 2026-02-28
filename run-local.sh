#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo ".env file not found; please create one with TMDB_API_KEY, PORT, DB_PATH, STATIC_DIR, etc."
  exit 1
fi

source_env=.env

if [[ -f $source_env ]]; then
  export $(grep -v '^#' "$source_env" | cut -d= -f1)
else
  echo "$source_env file not found; continuing with defaults"
fi

docker build -t media-library .
docker run -p 8099:8099 \
  --env-file .env \
  --env PORT=8099 \
  -v "$(pwd)/data:/data" \
  media-library
