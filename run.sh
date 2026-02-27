#!/usr/bin/with-contenv bashio

# Get configuration from Home Assistant
PORT=$(bashio::config 'port')

# Export environment variables
export PORT="$PORT"
export VITE_API_URL="http://localhost:${PORT}/api"
export NODE_ENV=production

# Change to backend directory
cd /app/backend

# Start the backend server
bashio::log.info "Starting Media Library on port ${PORT}..."
exec node src/index.js
