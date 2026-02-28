#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .env ]]; then
  echo ".env file not found; please create one with TMDB_API_KEY, PORT, DB_PATH, STATIC_DIR, etc."
  exit 1
fi

source_env=.env
build_arg="http://localhost:8099/api"

if [[ -f $source_env ]]; then
  export $(grep -v '^#' "$source_env" | cut -d= -f1)
  build_arg="${VITE_API_URL:-$build_arg}"
else
  echo "$source_env file not found; continuing with default VITE_API_URL"
fi

docker build --build-arg VITE_API_URL="$build_arg" -t media-library .
docker run -p 8099:8099 \
  --env-file .env \
  --env PORT=8099 \
  -v "$(pwd)/data:/data" \
  media-library
