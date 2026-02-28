#!/usr/bin/with-contenv bashio

PORT=$(bashio::config 'port')
DB_PATH=$(bashio::config 'db_path')
STATIC_DIR=$(bashio::config 'static_dir')
TMDB_API_KEY=$(bashio::config 'TMDB_API_KEY')

export PORT="${PORT:-8099}"
export DB_PATH="${DB_PATH:-/data/backend.db}"
export STATIC_DIR="${STATIC_DIR:-/app/public}"
export TMDB_API_KEY
export NODE_ENV=production

bashio::log.info "Starting Media Library on port ${PORT}"
exec node /app/backend/src/index.js
