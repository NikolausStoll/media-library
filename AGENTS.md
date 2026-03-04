# AGENTS.md - Project Context for AI Assistants

## Project Overview

**media-library** - A fullstack web application to manage a personal media library (Games, Movies, Series).
Built with Vue 3 (Composition API) + Vite on the frontend, and an Express.js backend on Node.js with SQLite.
Phase 5 adds full Episode Tracking for Series (per-episode + season bulk toggle).

---

## Tech Stack

### Frontend
- **Framework:** Vue 3 with `<script setup>` (Composition API)
- **Build Tool:** Vite + PWA Plugin
- **Language:** JavaScript (.vue, .js)
- **Drag & Drop:** `vue-draggable` (vuedraggable) - Games only
- **Styling:** Plain CSS (dark mode default)
- **State:** Local `ref()` / `computed()` - no Pinia/Vuex

- **Runtime:** Node.js with Express.js
- **Database:** SQLite via `better-sqlite3`
- **API Base:** Relative `/api` paths (no client-side URL overrides)
- **Port:** Frontend `npm run dev` (Vite) opens on `localhost:5173`; backend Express listens on `PORT` (default `3000`). Production/dev containers (HA/add-on or `run-local.sh`) forward `8099` via the same `PORT` + `STATIC_DIR` wiring.
- **External APIs:** TMDB (movies/series metadata, DE/EN, providers), HLTB (game playtimes)
- **Cache TTL:** TMDB metadata: 7 days | Episode details: 30 days | HLTB: 7 days

### Testing
- **Test Runner:** Vitest
- **Component Testing:** `@vue/test-utils` + JSDOM
- **Setup File:** `tests/setup.ts`
- **Config:** `vitest.config.ts`

---

## Project Structure

```
/
├── src/
│   ├── App.vue                         # Main tab navigation (Games / Movies / Series)
│   ├── main.js
│   ├── style.css
│   ├── components/
│   │   ├── GameList.vue
│   │   ├── MovieList.vue
│   │   ├── SeriesList.vue
│   │   ├── games/
│   │   │   ├── GameCard.vue
│   │   │   ├── GameFilters.vue
│   │   │   ├── GameSearchOverlay.vue
│   │   │   └── StatusOverlay.vue
│   │   └── shared/
│   │       └── MediaCard.vue
│   ├── services/
│   │   ├── gameStorage.js              # Game API + HLTB helpers
│   │   └── mediaStorage.js             # Movies + Series + Episodes
│   ├── assets/
│   │   └── global.css
│   └── data/
│       └── platformLogos.js
├── public/
│   ├── streamingProviders/
│   ├── platforms/
│   └── storefronts/
├── tests/
│   ├── helpers.ts
│   ├── GameList.render.test.ts
│   ├── Filters.test.ts
│   ├── GameBadges.test.ts
│   ├── GameList.drag.test.ts
│   ├── Overlay.test.ts
│   ├── backend.mock.test.ts
│   └── setup.ts
├── backend/
│   ├── package.json
│   └── src/
│       ├── index.js
│       ├── config/
│       │   └── providers.js
│       ├── db/
│       │   └── library.js
│       ├── services/
│       │   ├── tmdbService.js
│       │   ├── tmdbCache.js
│       │   ├── hltbService.js
│       │   └── hltbCache.js
│       └── routes/
│           ├── games.js
│           ├── movies.js
│           ├── series.js
│           ├── hltb.js
│           ├── tmdb.js
│           ├── next.js
│           ├── sortOrder.js
│           └── admin.js
├── docker/
│   └── entrypoint.js
├── media-library/                      # Everything needed for HA add-on
│   ├── config.yaml
│   ├── run.sh
│   └── README.md                       # HA add-on docs
├── data/
├── dist/                               # Built SPA
├── README.md
├── AGENTS.md
├── CLAUDE.md
├── package.json
├── package-lock.json
├── Dockerfile
├── repository.yaml
└── run-local.sh
```

---

## Database Schema (`backend/src/db/library.js`)

```sql
-- GAMES
games(id, externalId, status, userRating)
  status: 'backlog' | 'wishlist' | 'started' | 'completed' | 'dropped' | 'shelved'
  -- dropped is stored as 'retired' inside the database, but the API surfaces 'dropped'
gameplatforms(id, gameId, platform, storefront)
  platform: 'pc' | 'xbox' | 'switch' | '3ds'
  storefront: 'steam' | 'epic' | 'gog' | 'battlenet' | 'uplay' | 'ea' | 'xbox'
gametags(id, gameId, tag)  -- UNIQUE(gameId, tag)
sortorder(id, gameId, position)  -- for drag & drop

-- MOVIES
movies(id, externalId, status, userRating)
  status: 'watchlist' | 'watching' | 'finished'

-- SERIES
series(id, externalId, status, userRating)
  status: 'watchlist' | 'watching' | 'finished' | 'dropped' | 'paused'

-- SHARED
mediaproviders(id, mediaId, mediaType, provider)  -- UNIQUE(mediaId, mediaType, provider)
  mediaType: 'movie' | 'series'

-- NEXT QUEUE
next(id, mediaId, mediaType)  -- UNIQUE(mediaId, mediaType)
  mediaType: 'game' | 'movie' | 'series'

-- EPISODE TRACKING (Phase 5)
episodeprogress(id, seriesId, season, episode, watchedAt)
  -- UNIQUE(seriesId, season, episode), CASCADE delete on series

-- CACHE TABLES
hltbcache(id, name, imageUrl, gameplayMain, gameplayExtra, gameplayComplete, gameplayAll,
          rating, dlcs, updatedAt)

tmdbcache(id, mediaType, titleEn, titleDe, imageUrl, year, certification, rating,
          runtime, seasons, episodes, genres, streamingProviders, linkUrl, originalLang, updatedAt)

tmdbcacheepisodes(seriesId, season, episode, titleEn, airDate, runtime, updatedAt)
  -- PRIMARY KEY(seriesId, season, episode) | TTL: 30 days
```

---

## API Endpoints

### Games (`/api/games`)
```
GET    /api/games                     -> load all games (w/ platforms, tags, HLTB data)
GET    /api/games/:id                 -> single game
POST   /api/games                     -> { externalId, status, platforms[] }
PUT    /api/games/:id                 -> { status?, userRating? }
PUT    /api/games/:id/platforms       -> replace platform list
PUT    /api/games/:id/tags            -> replace tags (`['physical','100%']`)
DELETE /api/games/:id
DELETE /api/games/:id/cache           -> drop cached HLTB entry
```
- `status` must be one of `backlog`, `wishlist`, `started`, `completed`, `dropped`, `shelved`.
- Tags are limited to the curated set `['physical','100%']`.

### Sort Order (`/api/sort-order`)
```
GET    /api/sort-order               -> load drag order
PUT    /api/sort-order               -> persist ordered list
```

### HLTB (`/api/hltb`)
```
GET    /api/hltb/search?q=...         -> HowLongToBeat search + cache
GET    /api/hltb/:id                   -> cached/detail data for a specific HLTB entry
DELETE /api/hltb/cache/:id            -> clear HLTB cache for this ID
```

### Movies (`/api/movies`)
```
GET    /api/movies
GET    /api/movies/:id
POST   /api/movies                    -> { externalId, status, providers[] }
PUT    /api/movies/:id                -> { status?, userRating? }
PUT    /api/movies/:id/providers      -> replace providers
DELETE /api/movies/:id/cache          -> purge cached TMDB data
DELETE /api/movies/:id
```
- Valid statuses: `watchlist`, `watching`, `finished`.

### Series (`/api/series`) + Episode Tracking (Phase 5)
```
GET    /api/series
GET    /api/series/:id
POST   /api/series                          -> { externalId, status, providers[] }
PUT    /api/series/:id                      -> { status?, userRating? }
PUT    /api/series/:id/providers            -> replace providers
DELETE /api/series/:id/cache                -> drop cached TMDB data
DELETE /api/series/:id
GET    /api/series/progress-summary         -> watched counts used for cards

-- Episode Tracking (NEW)
GET    /api/series/:id/episodes             -> all episodes (cached from TMDB, EN titles)
GET    /api/series/:id/progress             -> [{ season, episode, watchedAt }]
POST   /api/series/:id/progress/toggle      -> { season, episode } -> toggle watched
PUT    /api/series/:id/progress/season/:s   -> { episodes[], watched } -> bulk season toggle
DELETE /api/series/:id/cache                -> purge episode cache for this series
```
- Valid statuses: `watchlist`, `watching`, `paused`, `finished`, `dropped`.

### Shared
#### TMDB (`/api/tmdb`)
```
GET    /api/tmdb/search?q=...&type=movie|series
GET    /api/tmdb/:id?type=movie|series     -> cached metadata
DELETE /api/tmdb/cache/:id?type=movie|series -> invalidate cache
```

#### Next Queue (`/api/next`)
```
GET    /api/next?type=game|movie|series    -> queue entries (omit `type` for all)
PUT    /api/next                            -> { mediaId, mediaType }[] (max 6 per type)
DELETE /api/next/:mediaId?type=...         -> remove one entry
```

#### Admin (`/api/admin`)
```
GET    /api/admin                         -> HTML admin dashboard
GET    /api/admin/export                  -> download JSON backup
POST   /api/admin/import                  -> replace DB from JSON backup
POST   /api/admin/import-games            -> bulk import HLTB IDs (platform/storefront/status)
```

---

## Key Data Structures

### Game Object
```js
{
  id: string,
  externalId: string,          // HLTB ID
  status: 'backlog' | 'wishlist' | 'started' | 'completed' | 'dropped' | 'shelved',
  // 'dropped' rows are persisted as 'retired' in SQLite (the mapper handles conversion)
  userRating: number | null,   // 1-10
  platforms: [{ platform: 'pc', storefront: 'steam' }],
  tags: ['rpg', 'metroidvania'],
  // HLTB enriched:
  name: string,
  imageUrl: string | null,
  gameplayMain/Extra/Complete/All: number | null
}
```

### Movie / Series Object
```js
{
  id: string,
  externalId: string,          // TMDB ID
  status: string,
  userRating: number | null,   // 1-10
  providers: ['netflix'],
  // TMDB enriched:
  titleEn: string, titleDe: string,
  imageUrl: string | null,
  year: string, certification: string,
  rating: number,              // TMDB community score
  runtime: number,             // minutes (per episode for series)
  genres: string[],
  streamingProviders: [{ id, name, logo }],  // DE flatrate from TMDB
  linkUrl: string,             // TMDB page link
  // Series only:
  seasonCount: number, episodeCount: number
}
```

### Episode Object (from TMDB cache)
```js
{ season: 1, episode: 3, titleEn: 'The Title', airDate: '2024-01-15', runtime: 22 }
```

---

## SeriesList.vue - Key Reactive State (Phase 5)

| Ref | Type | Default | Description |
|-----|------|---------|-------------|
| `seriesList` | `Series[]` | `[]` | All series |
| `nextList` | `string[]` | `[]` | IDs in Watch Next queue |
| `overlayItem` | `Series\|null` | `null` | Currently open detail overlay |
| `overlayTab` | `string` | `'details'` | Active overlay tab: 'details' or 'episodes' |
| `episodeList` | `Episode[]` | `[]` | All episodes for current series |
| `episodeProgress` | `Set<string>` | `new Set()` | Set of 'season-episode' keys e.g. '1-3' |
| `episodesLoading` | `boolean` | `false` | Loading state for episode fetch |
| `episodesGrouped` | `computed` | - | Episodes grouped by season |
| `activeTab` | `string` | `'watchlist'` | Active status tab |
| `genreFilter` | `string[]` | `[]` | Active genre chips |
| `sortBy` | `string` | `'title'` | Sort key: title/year/rating |

---

## GamesList.vue - Key Reactive State

| Ref | Type | Default | Description |
|-----|------|---------|-------------|
| `gameList` | `Game[]` | `[]` | All games |
| `startedOrder` | `string[]` | `[]` | Manual drag order for started tab |
| `playNextList` | `string[]` | `[]` | Array of game IDs in "Play Next" |
| `activeTab` | `string` | `'started'` | Current tab |
| `overlayGame` | `Game\|null` | `null` | Game shown in overlay |
| `showOverlay` | `boolean` | `false` | Detail overlay visibility |
| `deleteConfirm` | `boolean` | `false` | Delete confirmation state |
| `showSearchOverlay` | `boolean` | `false` | HLTB search overlay |
| `searchQuery` | `string` | `''` | Fuzzy search |
| `platformFilter` | `string[]` | `[]` | Active platform filters |
| `storefrontFilter` | `string[]` | `[]` | Active storefront filters |
| `sortBy` | `string` | `'name'` | Sort: name/rating/playtime/custom |
| `sortDirection` | `string` | `'asc'` | Sort direction |

---

## Important Business Logic

### Episode Tracking (Phase 5)
- Episodes and progress are loaded in parallel when an overlay is opened (`Promise.all`)
- Progress is stored as a `Set<string>` with keys `'season-episode'` (e.g. `'2-5'`)
- Season bulk toggle: if all episodes watched -> unwatch all; otherwise -> watch all
- `episodeProgress` is always replaced with a new `Set` (not mutated) to trigger reactivity
- Season headers are `position: sticky` to stay visible while scrolling the episode list
- Episode cache TTL is 30 days (longer than metadata, episodes rarely change)

### Tabs & Status
- Games tabs: `backlog`, `wishlist`, `started`, `completed`, `dropped`
  - `started` tab count includes both `status: 'started'` AND `status: 'shelved'` games
  - Switching to `started` tab auto-sets `sortBy = 'custom'`
- Series tabs: `watchlist`, `watching`, `paused`, `finished`, `dropped`
- Movies tabs: `watchlist`, `watching`, `finished`

### Next Queue
- Max 6 slots per media type
- Cross-media: Games (`/api/next?type=game`), Movies, Series tracked separately
- Auto-remove: when status changes away from `backlog` (games) or `watchlist` (movies/series)

### TMDB Data Strategy
- All metadata fetched in DE + EN in parallel
- `titleEn`: original title if not German-language content, otherwise EN translation
- `titleDe`: always the German localized title
- `certification` and `streamingProviders`: always from DE region
- `genres`: always from EN response (consistent naming)

### Drag & Drop (Games - Started Tab)
- Only available on `started` tab
- Uses `startedOrder: string[]` for manual sort order
- Games not in `startedOrder` are appended at end
- `saveSortOrder()` called after every `dragend` event

### ESC Key Handling
- SeriesList.vue: `@keydown` on root div (tabindex="-1")
  1. If `showSearchOverlay` -> `closeSearchOverlay()`
  2. Else if `showOverlay` -> `closeOverlay()`
- GamesList.vue: global `keydown` on `document`
  1. If `showSearchOverlay` -> `closeSearchOverlay()`
  2. Else if `showOverlay` -> `showOverlay = false`
  3. Else if `showPlatformEditor` -> `showPlatformEditor = false`

---

## Development Commands

```bash
# Frontend dev server (from root)
npm run dev

# Backend (from backend/ folder)
cd backend
npm run dev        # nodemon with hot reload
npm start          # production mode

# Run tests (from root)
npm run test
npm run test:ui    # visual UI

# Build frontend
npm run build
```

---

## Testing Conventions

- All tests use `vi.mock()` at the top of each file for `gameStorage.js`, `games.js`, `platformLogos.js`
- `global.fetch` is always mocked: `vi.fn().mockResolvedValue({ ok: true, json: async () => [] })`
- Shared fixtures and `mountApp()` helper live in `tests/helpers.ts`
- Always call `await flushPromises()` + `await nextTick()` after mount and interactions
- `document.body.innerHTML = ''` + `vi.clearAllMocks()` in every `afterEach`
- ESC-Key events must be dispatched on `document` directly:
  `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`

### Important Test-Specific Selectors
- `.search-input` - Search/filter input field
- `.add-game-input` - Input for adding games (external ID)
- `.add-game-btn` - Button to add a game
- `.play-next-section` - Play Next area in Backlog tab
- `.status-btn` - Status change buttons in overlay
- `.delete-trigger-btn` - Initial delete button in overlay
- `.delete-confirm-btn` - Confirmation button for delete

### Test Patterns
- **Default Tab**: `activeTab = 'started'` (GamesList) / `activeTab = 'watchlist'` (SeriesList)
- Most game tests need to explicitly switch to `'backlog'` tab to see ZELDA (status: backlog)
- Always check `expect(element.exists()).toBe(true)` before interacting
- Use CSS class selectors over text-based queries

---

## Environment Variables
### Frontend
- The SPA assumes `/api` as the base path; no extra env entries are required.

### Backend (backend/.env)
```
PORT=3000
TMDB_API_KEY=your_tmdb_key_here
FRONTEND_URL=http://localhost:5173
DB_PATH=../backend.db
STATIC_DIR=../dist
```
- `DB_PATH` points to the SQLite file (default `../backend.db`, containerized installs persist at `/data/backend.db`).
- `STATIC_DIR` is where the built SPA lives (`dist/` by default, the add-on/container serves it from `/app/public` via this path).

---

## Deployment Notes
- `run-local.sh` builds `media-library` via Docker, then runs it on `:8099` with volumes `./data:/data` and environment from `.env` (`PORT`, `TMDB_API_KEY`, `DB_PATH`, `STATIC_DIR`, ...). The script enforces `--env-file .env` for consistency with HA add-on values.
- The Home Assistant add-on (`media-library/`) exports `/app/public` as `STATIC_DIR`, `/data/backend.db` as persistent storage and requires `INGRESS=8099` plus credentials (GitHub PAT for `ghcr.io` and `TMDB_API_KEY` secret); `media-library/run.sh` simply exports the option values and execs `node backend/src/index.js`.

---

## Service Responsibilities
- `src/services/gameStorage.js`: central hub for game CRUD, sort-order, Next queue, HLTB cache invalidation, and platform/tag updates.
- `src/services/mediaStorage.js`: orchestrates movies/series CRUD, provider updates, episode/season progress endpoints, and TMDB search helper calls.
- `backend/src/services/hltbService.js` + `hltbCache.js`: fetch/form a cache of HowLongToBeat metadata (name, runtimes, dlc) used to enrich `games`.
- `backend/src/services/tmdbService.js`, `tmdbCache.js`: fetches TMDB metadata (DE/EN) plus episode lists, caching both TMDB responses and per-season episode data (30d TTL).

---
## Known Patterns & Gotchas

- `vue-draggable` is mocked implicitly via JSDOM - emit `'end'` directly to test drag callbacks
- `getPlatformLogo` always returns `null` in tests (mocked)
- `addGame(externalId, status, platforms)` - 3 parameters
- After `deleteGame`, remove from `gameList` locally (no full reload)
- After `updateGame` (status change), `showOverlay = false` and `overlayGame = null`
- Episode progress `Set` must be replaced (not mutated) to trigger Vue reactivity:
  `episodeProgress.value = new Set(episodeProgress.value)`
- Route order in `series.js` matters: specific routes (`/progress/toggle`, `/progress/season/:s`)
  must come BEFORE generic `/:id/progress` to avoid Express mismatching `:id = 'progress'`
- TMDB `streamingProviders` and `genres` are stored as JSON strings in SQLite,
  parsed to arrays in the aggregation function before sending to frontend
- `POST /api/admin/import` wipes and rebuilds every table, so back up before hitting the endpoint.
- `POST /api/admin/import-games` validates `status`, `platform`, and PC `storefront` values (`VALID_GAME_STATUSES`, `VALID_GAME_PLATFORMS`, `VALID_PC_STOREFRONTS`) and reports inserted/skipped IDs.

---

## Provider Definitions
- `src/components/SeriesList.vue` maps TMDB provider IDs to logos in `public/streamingProviders/*.webp`.
  - `8` – Netflix (`netflix.webp`)
  - `337` – Disney (`disney.webp`)
  - `9` – Prime (`prime.webp`)
  - `30` – Wow (`wow.webp`)
  - `2` – Apple (`apple.webp`)
  - `531` – Paramount (`paramount.webp`)
- Add new providers by dropping a `.webp` into `public/streamingProviders/` and referencing the same numeric ID in `SeriesList.vue` for filtering.