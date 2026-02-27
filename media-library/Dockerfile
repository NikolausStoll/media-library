ARG BUILD_FROM=ghcr.io/homeassistant/amd64-base:12.0
FROM $BUILD_FROM

# Install Node.js and build dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    python3 \
    make \
    g++ \
    sqlite

WORKDIR /app

# Copy package files from project root (frontend)
COPY ../../package*.json ./

# Install frontend dependencies
RUN npm ci --production

# Copy backend package files
# Copy backend package files
COPY ../../backend/package*.json ./backend/

# Install backend dependencies
WORKDIR /app/backend
RUN npm ci --production

# Back to root
WORKDIR /app

# Copy all application files from parent
# Copy all application files from project root
COPY ../../ .

# Build frontend
RUN npm run build

# Set environment
ENV NODE_ENV=production

# Copy and prepare run script
COPY run.sh /
RUN chmod a+x /run.sh

CMD ["/run.sh"]
