FROM node:20-bullseye AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bullseye AS runtime

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ sqlite3 && rm -rf /var/lib/apt/lists/*

ENV PORT=8099
ENV DB_PATH=/data/backend.db
ENV STATIC_DIR=/app/public
ENV NODE_ENV=production

COPY package*.json ./
COPY backend/package*.json backend/
WORKDIR /app/backend
RUN npm ci --omit=dev
WORKDIR /app

COPY --from=builder /app/dist ./public
COPY backend ./backend
COPY docker/entrypoint.js /app/entrypoint.js

EXPOSE 8099
CMD ["node", "/app/entrypoint.js"]
