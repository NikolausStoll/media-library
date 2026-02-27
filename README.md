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
cd backend
npm install
cd ..
```

### Development Servers

```bash
# Backend (new terminal)
cd backend
npm run dev

# Frontend
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8787`
- Admin Panel: `http://localhost:8787/api/admin`

### Environment Variables

- Frontend (`.env`):
  ```
  VITE_API_URL=http://localhost:8787/api
  ```
- Backend (`backend/.env`):
  ```
  PORT=8787
  FRONTEND_URL=http://localhost:5173
  TMDB_API_KEY=your_tmdb_key_here
  ```

---

## Production & Containers

### Local Production Build

```bash
npm run build
npm run start:backend
```

- `npm run build` produces `dist/`, which `backend/src/index.js` now serves alongside `/api` routes.
- `run.sh` wraps the build and backend start commands; it is also used by the Home Assistant add-on.

### Docker

```bash
docker build -t media-library .
docker run -p 8787:8787 media-library
```

- Container installs dependencies, builds the frontend, and serves the Express backend so both UI and API live under port 8787.

---

## Home Assistant Add-on

- The `addon/` directory defines a local HA add-on with name **Media Library**, listening on port 8787 and running `run.sh`.
- Copy the folder into HA’s add-on directory or add this repo as a custom add-on source under **Supervisor › Add-on Store › Repositories**.
- After installation, the add-on builds the frontend, starts the backend, and exposes `http://<ha-ip>:8787/` (UI + API).
- Configuration options: `PORT` and `VITE_API_URL` (defaults match `config.yaml`).

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
├── src/                    # Vue app (components, shared cards, services, styles)
├── backend/
│   ├── src/                # Express routes (games, movies, series, episodes, next, admin)
│   ├── db/                 # Schema + cache helpers
│   └── package.json
├── tests/                   # Vitest suites for UI + helpers
├── Dockerfile               # Production container image
├── run.sh                   # Build + start wrapper (used by HA add-on)
├── addon/                   # Home Assistant add-on metadata
└── README.md                # You are here
```

---

## Further Reading

- `AGENTS.md` covers cache policies, data models, episode tracking, drag sorting, and key behaviors in detail.

---

## License

MIT
