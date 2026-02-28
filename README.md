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

- The `ha-addon/media-library/` directory exposes a prebuilt add-on that points at `ghcr.io/<OWNER>/media-library:latest`.
- Add the repository via **Supervisor › Add-on Store › Repositories** pointing to `https://github.com/NikolausStoll/media-library`, then install **Media Library** (the entry using the `media-library` slug).
- Open the add-on via Ingress (Ingress port 8099) and configure `port`, `db_path`, or `static_dir` if the defaults do not match your setup.

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
├── ha-addon/
│   └── media-library/          # HA add-on wrapper (config + run.sh)
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
