# Media Library

A fullstack media library for tracking games, movies, and TV series across backlog, playing/watch lists, and completion states. The Vue 3 frontend and Express/SQLite backend share the same repo but can be run independently in development, built for production, or bundled via Docker/Home Assistant.

---

## Highlights

- Tracks Games (with HLTB data), Movies, and Series (per-episode progress + season bulk toggles).
- Status tabs (wishlist, backlog, started/watchlist, watching, paused, finished, dropped) with contextual sorting.
- Play Next queue (up to 6 entries) plus started-tab drag-and-drop order.
- Fuzzy search, platform/storefront/genre filtering, and responsive grid/list layouts.
- TMDB-powered metadata (DE+EN) with streaming provider info and caches (7d metadata / 30d episodes).
- Admin panel for importing/exporting the SQLite database and clearing caches.
- Keyboard shortcuts (ESC to close overlays) and a dark theme by default.

---

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Vue 3 (Composition API, `<script setup>`), Vite |
| Backend    | Node.js + Express.js                 |
| Database   | SQLite (`better-sqlite3`)            |
| APIs       | TMDB (DE/EN + providers), HowLongToBeat |
| Testing    | Vitest + @vue/test-utils             |

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- Optional: Docker (see below)

### Clone & Install

```bash
git clone https://github.com/your-username/media-library.git
cd media-library
npm install
```

### Development

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:3000`

### Environment Variables

- Frontend (`.env`):
  ```
  VITE_API_URL=http://localhost:3000/api
  ```
- Backend (`backend/.env`):
  ```
  PORT=3000
  FRONTEND_URL=http://localhost:5173
  TMDB_API_KEY=your_tmdb_key_here
  DB_PATH=../backend.db
  STATIC_DIR=../dist
  ```

---

## Production & Containers

### Local Production Build

```bash
npm run build
npm run start
```

- `npm run build` emits a `dist/` folder that the backend now exposes via `STATIC_DIR`.

### Docker

```bash
docker build -t media-library .
docker run -p 8099:8099 -v "$(pwd)/data:/data" media-library
```

- If you need to supply credentials locally (TMDB key, port overrides, etc.), create a `.env` file in the repo root and pass it with `--env-file`:
  ```bash
  docker build -t media-library .
  docker run -p 8099:8099 --env-file .env -v "$(pwd)/data:/data" media-library
  ```
- Alternatively, run `./run-local.sh` (make it executable) which wraps the build/run steps using `--env-file .env`.
- When building for another environment (e.g. HA ingress), pass a `VITE_API_URL` build argument so the SPA points at the correct API:
  ```bash
  docker build --build-arg VITE_API_URL=https://your-ha-host:8099/api -t media-library .
  ```

- The container exposes `${PORT:-8099}` and persists SQLite at `/data/backend.db`.
- `STATIC_DIR` defaults to `/app/public`, so the built SPA is served by Express.

---

## Home Assistant Add-on

Supervisor discovers the Media Library add-on through the `repository.yaml` manifest at the repo root, which points at `media-library/config.yaml`. The configuration relies on the prebuilt image `ghcr.io/nikolausstoll/media-library:latest`, enforces ingress on port 8099, and exposes options for `port`, `db_path`, `static_dir`, plus a password-protected `TMDB_API_KEY`.

- In Supervisor, go to **Add-on Store › Repositories** and add `https://github.com/NikolausStoll/media-library`. The manifest will surface **Media Library** (slug: `media-library`).
- Configure Supervisor with GitHub Container Registry credentials (your GitHub username and a PAT with `read:packages`) so it can pull the private `ghcr.io/nikolausstoll/media-library:latest` image.
- The `media-library/` folder now lives at the repo root and contains `config.yaml`, `run.sh`, `README.md`, and supplemental docs. `run.sh` reads the configured options via `bashio::config`, exports `PORT`, `DB_PATH`, `STATIC_DIR`, and `TMDB_API_KEY`, and starts `node backend/src/index.js`.
- Data persists inside the container at `/data/backend.db`, static assets live at `/app/public`, and the UI surface is forwarded through Ingress on port 8099. Override `port`, `db_path`, or `static_dir` in the add-on options if your setup requires different values.

---

## Testing

```bash
npm test           # Watch mode
npm test -- --run  # Single run (CI)
npm run test:ui    # Vitest GUI
```

- Tests mock `gameStorage`, Express routes, TMDB/HLTB calls with `vi.mock`.
- Shared helper `tests/helpers.ts` handles mounting and fixtures (ZELDA, MARIO, METROID).
- Each test resets `document.body.innerHTML` and `vi.clearAllMocks()` in `tests/setup.ts`.

---

## Project Structure (excerpt)

```
/
├── backend/                 # Express API + SQLite schema
├── media-library/           # HA add-on metadata + run script
│   ├── config.yaml
│   ├── run.sh
│   └── README.md
├── repository.yaml          # Home Assistant add-on manifest
├── Dockerfile               # Production image build
├── .github/workflows/       # CI for multi-arch Docker releases
└── README.md
```

---

## Further Reading

- `AGENTS.md` covers cache policies, data models, episode tracking, drag sorting, and key behaviors in detail.

---

## License

MIT
