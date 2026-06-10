# Media Library

Media Library is a fullstack personal library for games, books, movies, and TV series. It combines a Vue 3 frontend with an Express/SQLite backend and can run locally, in Docker, or as the bundled Home Assistant add-on.

The app is built around everyday backlog decisions: what is waiting, what is in progress, what is next, what is finished, and what deserves a rating or a pause.

## Features

- Games with HowLongToBeat metadata, platforms, storefronts, DLC/game type data, playtime estimates, ratings, release dates, and curated tags.
- Books with Google Books/Open Library metadata, covers, authors, page counts, ratings, formats, and barcode-assisted lookup.
- Movies and series with TMDB metadata, DE/EN title handling, German certifications, German flatrate streaming providers, trailers/videos, genres, runtime, release dates, and ratings.
- Series episode tracking with per-episode toggles, watched summaries, season bulk toggles, and cached episode data.
- Per-media status tabs, fuzzy search, no-rating filters, provider/genre/platform/format filters, sortable grid/list views, dark mode, and responsive mobile navigation.
- Per-media Next queues capped at 6 items: Play Next, Read Next, or Watch Next depending on media type.
- Manual drag ordering for games in the Started tab.
- Completion dates and `lastTouched` timestamps for finished/completed media and later edits.
- Optional AI recommendations for games, movies, and series using the current library context, with non-AI fallback behavior when no key is configured.
- Admin dashboard for JSON backup/import of user-owned library tables, bulk game import, and metadata cache clearing.

## Business Logic

### Media Types And Statuses

| Type | External metadata | Statuses |
| --- | --- | --- |
| Games | HowLongToBeat | `wishlist`, `backlog`, `started`, `shelved`, `completed`, `dropped` |
| Books | Google Books plus Open Library ratings | `wishlist`, `backlog`, `started`, `shelved`, `completed` |
| Movies | TMDB | `watchlist`, `watching`, `finished` |
| Series | TMDB plus episode cache | `watchlist`, `watching`, `paused`, `finished`, `dropped` |

- Game status `dropped` is stored as `retired` in SQLite and mapped back to `dropped` by the API.
- Started tabs for games and books include shelved items in their counts and show shelved items as a separate section.
- The series Watching tab includes paused series in its count and separates paused entries in the UI.
- Watch/Play/Read Next queues only keep backlog/watchlist candidates. Moving an item out of that status removes it from the queue.
- Each media type has its own Next queue; `/api/next` enforces a maximum of 6 entries per type.
- `completedAt` is set automatically when an item first enters `completed` or `finished`, and can be edited in the overlay. `lastTouched` updates on status, rating, provider, tag, format, platform, and episode-progress changes.

### Metadata And Caching

- Frontend calls are relative `/api` requests; there is no client-side API base override.
- HLTB data is cached for games. Cached fields include names, cover images, playtime buckets, ratings, DLCs, game type, and EU release date.
- TMDB metadata is fetched in German and English. German data is used for certifications, release dates, and streaming providers; English data is used for consistent genre names and display titles unless German is the original language.
- TMDB movie/series metadata defaults to a 7 day TTL. Episode data is cached separately for 30 days.
- Google Books cache stores book metadata and merged rating signals, including Open Library rating/count fields.
- Cache entries can be invalidated from item overlays or admin routes.

### AI Recommendations

The AI assistant supports games, movies, and series.

- `What's Next` suggests 1 to 2 existing items from the relevant queue/library context.
- `New Recommendation` suggests 10 new titles and can add resolved suggestions back to the wishlist/watchlist.
- Game prompts can include platform filters and session-length hints.
- Series prompts can include preferred episode length.
- Movie and series `What's Next` can restrict candidates to streaming-available items.
- Without `AI_API_KEY`, the backend returns a simple deterministic fallback from available context.

### Admin Backup Scope

The admin JSON export/import covers user-owned library state: games, books, movies, series, Next queues, formats, platforms, providers, tags, sort order, completion dates, and episode progress. Rebuildable metadata caches such as HLTB, TMDB, TMDB episodes, and Google Books are not included.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | Vue 3, Composition API, Vite |
| Styling | Plain CSS, dark mode default |
| Backend | Node.js, Express |
| Database | SQLite via `better-sqlite3` |
| External APIs | TMDB, HowLongToBeat, Google Books, Open Library, optional OpenAI |
| Tests | Vitest, JSDOM, `@vue/test-utils` |
| Container | Docker, Home Assistant add-on metadata |

## Repository Layout

```text
/
├── src/                    # Vue app, components, services, CSS
├── backend/src/            # Express routes, SQLite schema, metadata services
├── public/                 # Provider, platform, and storefront assets
├── tests/                  # Vitest frontend/component tests
├── docker/entrypoint.js    # Container and HA options entrypoint
├── media-library/          # Home Assistant add-on metadata/docs/assets
├── data/                   # Local persistent Docker data
├── dist/                   # Vite production build output
├── Dockerfile
├── repository.yaml         # HA add-on repository manifest
├── run-local.sh            # Local Docker wrapper
├── package.json
└── README.md
```

## Local Development

### Prerequisites

- Node.js 20 is recommended. Node 18+ should work for the Vite/Express stack, but the Docker image uses Node 20.
- npm
- Optional: Docker
- Optional API keys: TMDB and OpenAI

### Install

```bash
npm install
```

### Environment

Copy `.env.example` to `.env` and adjust values.

```env
PORT=8098
FRONTEND_URL=http://localhost:5173
TMDB_API_KEY=
AI_API_KEY=
AI_MODEL=gpt-4o-mini
DB_PATH=backend.db
STATIC_DIR=dist
```

For local Vite development, use `PORT=8098` because `vite.config.js` proxies `/api` to `http://localhost:8098`.

### Run The App

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8098` when `.env` uses `PORT=8098`

You can also run each side separately:

```bash
npm run dev:frontend
npm run dev:backend
```

## Build And Production

```bash
npm run build
npm start
```

`npm run build` writes the SPA to `dist/`. The backend serves `STATIC_DIR` when it contains `index.html`; otherwise API routes still run and non-API frontend routes return 404.

## Docker

```bash
docker build -t media-library .
docker run -p 8099:8099 -v "$(pwd)/data:/data" media-library
```

With local configuration:

```bash
docker run -p 8099:8099 --env-file .env -v "$(pwd)/data:/data" media-library
```

Or use the wrapper:

```bash
./run-local.sh
```

The container defaults are:

- `PORT=8099`
- `DB_PATH=/data/backend.db`
- `STATIC_DIR=/app/public`

## Home Assistant Add-on

The `media-library/` directory contains the add-on metadata used by Home Assistant. `repository.yaml` points Supervisor at this add-on, and the add-on uses the prebuilt image `ghcr.io/nikolausstoll/media-library`.

The add-on page README is intentionally feature-focused. Technical add-on configuration is documented in `media-library/DOCS.md`.

## Tests

```bash
npm test             # watch mode
npm test -- --run    # single Vitest run
npm run test:ui      # Vitest UI
```

`backend/tests/ai.test.js`, when present, is a Node `node:test` file and should be run separately from Vitest:

```bash
node --test backend/tests/ai.test.js
```

## API Overview

Main route groups:

- `/api/games`
- `/api/books`
- `/api/movies`
- `/api/series`
- `/api/hltb`
- `/api/googlebooks`
- `/api/tmdb`
- `/api/next`
- `/api/sort-order`
- `/api/ai`
- `/api/admin`
- `/api/config`

See `AGENTS.md` for detailed endpoint behavior, schema notes, and implementation gotchas.

## License

MIT
