# AGENTS.md - Media Library Working Notes

This is the source of truth for AI assistants working in this repository. Keep it technical, current, and specific to implementation work. `CLAUDE.md` intentionally only points here.

## Project Snapshot

`media-library` is a fullstack personal media library for games, books, movies, and TV series.

- Frontend: Vue 3, Composition API, Vite, plain CSS, no Pinia/Vuex.
- Backend: Node.js, Express, SQLite via `better-sqlite3`.
- API base: relative `/api` paths only.
- Local dev frontend: Vite on `localhost:5173`.
- Local dev backend: `npm run dev:backend`, should use `PORT=8098` because `vite.config.js` proxies `/api` to `http://localhost:8098`.
- Container/Home Assistant backend: defaults to `PORT=8099`, `DB_PATH=/data/backend.db`, `STATIC_DIR=/app/public`.
- Current package/add-on version: `1.11.0`.

## High-Level Features

- Games: HowLongToBeat metadata, platforms, storefronts, tags, playtime buckets, ratings, DLC/game type, EU release date, manual Started ordering.
- Books: Google Books metadata, Open Library rating fields, formats, covers, authors, page counts, series info, barcode scanner.
- Movies: TMDB metadata, DE/EN data handling, German release/certification/provider data, videos/trailers, watchlist queue.
- Series: TMDB metadata plus episode list cache, per-episode watched progress, progress summary, season bulk toggles.
- Shared: separate Next queues per media type, user ratings, completion dates, `lastTouched`, search/filter/sort, grid/list/density settings, dark mode.
- AI assistant: available for games, movies, and series; supports `whats-next` and `new-recommendation`; falls back locally when `AI_API_KEY` is missing.
- Admin page: JSON export/import of user-owned library state, HLTB/TMDB cache clearing, bulk game import.

## Important Commands

```bash
npm install
npm run dev              # frontend + backend via concurrently
npm run dev:frontend     # Vite only, port 5173
npm run dev:backend      # Express only, use PORT=8098 in .env for Vite proxy
npm run build            # Vite production build to dist/
npm start                # Express backend, serves STATIC_DIR when present
npm test                 # Vitest watch mode
npm test -- --run        # Vitest single run
npm run test:ui          # Vitest UI
```

Backend-only script:

```bash
cd backend
npm start
npm run dev
npm test                 # node ./tests/ai.test.js, not Vitest
```

Docker:

```bash
docker build -t media-library .
docker run -p 8099:8099 --env-file .env -v "$(pwd)/data:/data" media-library
./run-local.sh
```

## Environment

Frontend has no build-time API URL configuration. It calls `/api`.

Root `.env.example` currently shows:

```env
PORT=3000
FRONTEND_URL=http://localhost:5173
TMDB_API_KEY=MY_TMDB_API_KEY
AI_API_KEY=MY_OPEN_AI_API_KEY
AI_MODEL=gpt-4o-mini
DB_PATH=backend.db
STATIC_DIR=/app/public
```

For local Vite development, set:

```env
PORT=8098
STATIC_DIR=dist
```

because `vite.config.js` proxies `/api` to `localhost:8098`.

Container defaults are set in `Dockerfile`:

```env
PORT=8099
DB_PATH=/data/backend.db
STATIC_DIR=/app/public
NODE_ENV=production
```

Home Assistant options are read from `/data/options.json` by `docker/entrypoint.js`, not by a `run.sh` script. `config.yaml` exposes `AI_MODEL`, and the backend honors `process.env.AI_MODEL`, but the current entrypoint does not read/export the `AI_MODEL` option from `/data/options.json`.

## Repository Structure

```text
/
├── src/
│   ├── App.vue
│   ├── components/
│   │   ├── GameList.vue
│   │   ├── BookList.vue
│   │   ├── MovieList.vue
│   │   ├── SeriesList.vue
│   │   ├── books/
│   │   ├── games/
│   │   └── shared/
│   ├── services/
│   │   ├── gameStorage.js
│   │   ├── bookStorage.js
│   │   └── mediaStorage.js
│   └── utils/
├── backend/src/
│   ├── db/library.js
│   ├── routes/
│   │   ├── games.js
│   │   ├── books.js
│   │   ├── movies.js
│   │   ├── series.js
│   │   ├── hltb.js
│   │   ├── googlebooks.js
│   │   ├── tmdb.js
│   │   ├── next.js
│   │   ├── sortOrder.js
│   │   ├── ai.js
│   │   └── admin.js
│   └── services/
├── public/
├── tests/
├── docker/entrypoint.js
├── media-library/
│   ├── config.yaml
│   ├── README.md
│   ├── DOCS.md
│   └── icon.png
├── Dockerfile
├── repository.yaml
└── run-local.sh
```

## Database Schema Notes

Defined in `backend/src/db/library.js`. SQLite creates/migrates tables at startup.

### Games

```sql
games(id, externalId, status, userRating, completedAt, lastTouched)
  status CHECK: backlog, wishlist, started, completed, retired, shelved

gameplatforms(id, gameId, platform, storefront)
  platform CHECK: pc, xbox, switch, 3ds
  storefront CHECK: steam, epic, gog, battlenet, uplay, ea, xbox

gametags(id, gameId, tag)
sortorder(id, gameId, position)
hltbcache(id, name, imageUrl, gameplayMain, gameplayExtra, gameplayComplete,
          gameplayAll, rating, dlcs, gameType, releaseDateEu, updatedAt)
```

Game API status `dropped` maps to DB status `retired`.

### Books

```sql
books(id, externalId, status, userRating, completedAt, lastTouched)
  status CHECK: wishlist, backlog, started, completed, shelved

bookformats(id, bookId, format)
  format CHECK: hardcover, kindle

googlebookscache(id, title, authors, description, imageUrl, pageCount,
                 publishedDate, categories, rating, ratingsCount,
                 olRating, olRatingsCount, seriesName, seriesPosition,
                 publisher, isbn, language, linkUrl, updatedAt)
```

### Movies And Series

```sql
movies(id, externalId, status, userRating, completedAt, lastTouched)
  status CHECK: watchlist, watching, finished

series(id, externalId, status, userRating, completedAt, lastTouched)
  status CHECK: watchlist, watching, finished, dropped, paused

mediaproviders(id, mediaId, mediaType, provider)
  mediaType CHECK: movie, series

tmdbcache(id, mediaType, titleEn, titleDe, imageUrl, year, certification,
          rating, runtime, seasons, episodes, genres, streamingProviders,
          linkUrl, releaseDateDe, originalLang, updatedAt, videos, ttlMs)

tmdbcacheepisodes(seriesId, season, episode, titleEn, airDate, runtime, updatedAt)
episodeprogress(id, seriesId, season, episode, watchedAt, lastTouched)
```

### Shared

```sql
next(id, mediaId, mediaType)
  mediaType CHECK: game, movie, series, book
  UNIQUE(mediaId, mediaType)
```

## API Endpoints

### Games: `/api/games`

```text
GET    /api/games
GET    /api/games/:id
POST   /api/games                    { externalId, status, platforms[] }
PUT    /api/games/:id                { status?, userRating?, completedAt? }
PUT    /api/games/:id/platforms      { platforms[] }
PUT    /api/games/:id/tags           { tags[] }
DELETE /api/games/:id/cache
DELETE /api/games/:id
```

- Valid API statuses: `backlog`, `wishlist`, `started`, `completed`, `dropped`, `shelved`.
- Valid tags: `physical`, `100%`.
- `completedAt` must be `YYYY-MM-DD`, `null`, `""`, or omitted.

### Books: `/api/books`

```text
GET    /api/books
GET    /api/books/:id
POST   /api/books                    { externalId, status, formats[] }
PUT    /api/books/:id                { externalId?, status?, userRating?, completedAt? }
PUT    /api/books/:id/formats        { formats[] }
DELETE /api/books/:id/cache
DELETE /api/books/:id
```

- Valid statuses: `wishlist`, `backlog`, `started`, `completed`, `shelved`.
- Valid formats: `hardcover`, `kindle`.

### Movies: `/api/movies`

```text
GET    /api/movies
POST   /api/movies                   { externalId, status, providers[] }
PUT    /api/movies/:id               { status?, userRating?, completedAt? }
PUT    /api/movies/:id/providers     body is providers array
DELETE /api/movies/:id/cache
DELETE /api/movies/:id
```

- Valid statuses: `watchlist`, `watching`, `finished`.

### Series: `/api/series`

```text
GET    /api/series
GET    /api/series/progress-summary
POST   /api/series                   { externalId, status, providers[] }
PUT    /api/series/:id               { status?, userRating?, completedAt? }
PUT    /api/series/:id/providers     body is providers array
DELETE /api/series/:id/cache
DELETE /api/series/:id

GET    /api/series/:id/episodes
GET    /api/series/:id/progress
POST   /api/series/:id/progress/toggle       { season, episode }
PUT    /api/series/:id/progress/season/:s    { episodes[], watched }
```

- Valid statuses: `watchlist`, `watching`, `paused`, `finished`, `dropped`.
- Route order matters in `series.js`: `/progress-summary` must stay before generic `/:id` style routes, and episode/progress routes must not be shadowed.

### Metadata

```text
GET    /api/hltb/search?q=...
GET    /api/hltb/:id
DELETE /api/hltb/cache/:id

GET    /api/googlebooks/search?q=...
GET    /api/googlebooks/:id
DELETE /api/googlebooks/cache/:id

GET    /api/tmdb/search?q=...&type=movie|series
GET    /api/tmdb/:id?type=movie|series
DELETE /api/tmdb/cache/:id?type=movie|series
```

### Next Queue: `/api/next`

```text
GET    /api/next?type=game|movie|series|book
PUT    /api/next                    [{ mediaId, mediaType }]
DELETE /api/next/:mediaId?type=...
```

- Valid media types: `game`, `movie`, `series`, `book`.
- Max 6 entries per media type.
- PUT replaces only the media types present in the submitted array.

### Sort Order: `/api/sort-order`

```text
GET    /api/sort-order
PUT    /api/sort-order
```

Used for manual game ordering on the Started tab.

### AI: `/api/ai`

```text
POST /api/ai/suggest
```

Request:

```js
{
  mediaType: 'game' | 'movie' | 'series',
  mode: 'whats-next' | 'new-recommendation',
  platformFilter?: ['pc' | 'xbox' | 'switch' | '3ds'],
  sessionHint?: 'short' | 'long' | 'any',
  episodeLength?: '20-30' | '45+' | 'any',
  streamingOnly?: boolean
}
```

AI currently does not support books.

### Admin: `/api/admin`

```text
GET  /api/admin
GET  /api/admin/export
POST /api/admin/import
POST /api/admin/import-games
POST /api/admin/clear-hltb-cache
POST /api/admin/clear-tmdb-cache
```

Admin export/import covers user-owned library state: games, books, movies, series, Next, providers, formats, platforms, tags, sort order, completion dates, and `episodeprogress`. It intentionally excludes rebuildable caches: `hltbcache`, `tmdbcache`, `tmdbcacheepisodes`, and `googlebookscache`.

## Frontend State And Business Rules

### App Navigation

`src/App.vue` persists the selected media type in `localStorage` under `mediaType`.

Valid UI media values:

- `game`
- `book`
- `movie`
- `series`

### Games

Main file: `src/components/GameList.vue`.

- Default tab: `started`.
- Tabs: `wishlist`, `backlog`, `started`, `completed`, `all`; dropped/shelved are status options but not primary tabs.
- Started count includes `started` plus `shelved`.
- Backlog tab has Play Next section above normal backlog items.
- Started tab supports drag-and-drop custom sort through `vuedraggable` and `/api/sort-order`.
- Switching to Started with custom order uses `sortBy = 'custom'`.
- Moving a Play Next game out of `backlog` removes it from `/api/next?type=game`.
- Platform editor replaces the whole platform list.
- Tag editor uses only `physical` and `100%`.

### Books

Main file: `src/components/BookList.vue`.

- Default tab: `backlog`.
- Tabs: `wishlist`, `backlog`, `started`, `completed`, `all`.
- Started count includes `started` plus `shelved`.
- Backlog tab has Read Next section above normal backlog items.
- Formats are currently `hardcover` and `kindle`.
- Search overlay uses Google Books. Barcode scanner is in `src/components/books/BarcodeScanner.vue`.
- Moving a Read Next book out of `backlog` removes it from `/api/next?type=book`.

### Movies

Main file: `src/components/MovieList.vue`.

- Default tab: `watchlist`.
- Tabs: `watchlist`, `watching`, `finished`, `all`.
- Watchlist tab has Watch Next section above normal watchlist items.
- Future releases are split into a separate not-yet-released section on watchlist.
- Provider filter uses TMDB provider IDs and local provider logos.
- Moving a Watch Next movie out of `watchlist` removes it from `/api/next?type=movie`.
- AI assistant is available from the sidebar.

### Series

Main file: `src/components/SeriesList.vue`.

- Default tab: `watching`.
- Tabs: `watchlist`, `watching`, `finished`, `dropped`, `all`.
- Watching count includes `watching` plus `paused`.
- Paused series are shown separately when on Watching.
- Watchlist tab has Watch Next section above normal watchlist items.
- Provider filter uses the same TMDB provider definitions as movies.
- Episode overlay loads episodes and progress, then stores watched state as a `Set` of keys like `season-episode`.
- Always replace `episodeProgress.value` with a new `Set`; do not mutate and leave it in place.
- Season bulk toggle watches all episodes when any are unwatched, otherwise unwatches the season.
- AI assistant is available from the sidebar.

### Completion Dates

Shared component: `src/components/shared/CompletionDateEditor.vue`.

- Display format is DD.MM.YYYY.
- API format is ISO `YYYY-MM-DD`.
- Finished/completed items get `completedAt` automatically if missing.
- User edits may set a date or clear it.

## Provider Definitions

Movies and series currently define these provider filter buttons:

| ID | Provider | Logo |
| --- | --- | --- |
| 8 | Netflix | `/streamingProviders/netflix.webp` |
| 337 | Disney | `/streamingProviders/disney.webp` |
| 9 | Prime | `/streamingProviders/prime.webp` |
| 30 | Wow | `/streamingProviders/wow.webp` |
| 2 | Apple | `/streamingProviders/apple.webp` |
| 531 | Paramount | `/streamingProviders/paramount.webp` |
| 1899 | HBO Max | `/streamingProviders/hbomax.webp` |

Add a provider by placing the logo in `public/streamingProviders/` and updating both `MovieList.vue` and `SeriesList.vue` if it should appear in both filters.

## Testing Conventions

- Test runner: Vitest with JSDOM.
- Setup file: `tests/setup.ts`.
- Shared helpers/fixtures: `tests/helpers.ts`.
- Use `await flushPromises()` and `await nextTick()` after mounts and interactions.
- Tests usually mock `global.fetch`.
- Clean up with `document.body.innerHTML = ''` and `vi.clearAllMocks()` in `afterEach`.
- Prefer CSS selectors over text queries for app-specific controls.
- ESC behavior in older game tests dispatches on `document`; check component-specific handlers before adding new tests.
- `vuedraggable` is tested by emitting `end` directly in JSDOM.
- `backend/tests/ai.test.js` is Node `node:test`, not a Vitest suite.

Useful selectors that already exist in tests:

- `.search-input`
- `.add-game-input`
- `.add-game-btn`
- `.play-next-section`
- `.status-btn`
- `.delete-trigger-btn`
- `.delete-confirm-btn`

## Implementation Gotchas

- Do not introduce a client-side API base environment variable unless the app architecture changes; services use relative `/api`.
- Keep Vite dev proxy target and local backend port in sync. The current target is `localhost:8098`.
- `media-library/run.sh` no longer exists. Home Assistant/runtime option wiring is in `docker/entrypoint.js`.
- Admin backup is not a byte-for-byte database dump. It preserves user-owned state and intentionally omits rebuildable metadata caches.
- `POST /api/admin/import` wipes and rebuilds the imported tables. Back up before using it.
- SQLite CHECK constraints enforce status/platform/storefront/format values.
- `mediaproviders.streamingProviders`, `tmdbcache.genres`, `tmdbcache.videos`, and Google Books arrays are stored as JSON strings and parsed before returning API objects.
- TMDB metadata service uses German and English data together; avoid simplifying it to one locale.
- Series runtime may be computed from episode runtimes when TMDB series runtime is missing.
- `AI_MODEL` defaults to `gpt-4o-mini`; `AI_API_KEY` is optional and missing keys should not break app startup.
- The HA `AI_MODEL` option is currently not wired through `docker/entrypoint.js`; do not document it as effective in stock add-on runtime unless the entrypoint is updated.
- `TMDB_API_KEY` is optional for startup but required for useful movie/series metadata.
- Watch/Read/Play Next auto-removal should happen when leaving backlog/watchlist states.
- For Vue reactivity, replace Sets/arrays when needed rather than mutating silently.
- Preserve unrelated dirty worktree changes. At the time these docs were updated, `.github/workflows/docker-release.yml` and `.github/workflows/tag-on-config.yml` were already deleted in the worktree.

## Documentation Boundaries

- Root `README.md`: user-facing features, business logic, local repo usage, Docker, tests, API overview.
- `media-library/README.md`: Home Assistant add-on page, feature-focused only.
- `media-library/DOCS.md`: Home Assistant technical configuration/runtime details only; no local deployment instructions.
- `CLAUDE.md`: pointer to this file only.
- `AGENTS.md`: detailed assistant operating context, schemas, endpoints, gotchas, and test notes.
