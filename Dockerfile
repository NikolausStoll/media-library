FROM node:20-bullseye AS builder

ARG VITE_API_URL=http://localhost:8099/api
ENV VITE_API_URL=${VITE_API_URL}

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

EXPOSE 8099
CMD ["node", "backend/src/index.js"]
