# AGENTS.md - Project Context for AI Assistants

## Project Overview

**media-list** - A fullstack web application to manage a personal media library (Games, Movies, Series).
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

### Backend
- **Runtime:** Node.js with Express.js
- **Database:** SQLite via `better-sqlite3`
- **API Base:** `import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'`
- **Port:** Default 8787 (configurable via `PORT` env variable)
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
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ components/
â”‚   â”‚   â”œâ”€â”€ GamesList.vue             # Games: platforms, HLTB, drag sort, tags
â”‚   â”‚   â”œâ”€â”€ MoviesList.vue            # Movies: streaming providers, status
â”‚   â”‚   â”œâ”€â”€ SeriesList.vue            # Series: episode tracking, season toggle
â”‚   â”‚   â””â”€â”€ shared/
â”‚   â”‚       â””â”€â”€ MediaCard.vue         # Unified card component (poster, title, meta)
â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”œâ”€â”€ gameStorage.js            # Games API calls + HLTB + Next/Sort
â”‚   â”‚   â””â”€â”€ mediaStorage.js           # Movies + Series + Episode API calls
â”‚   â””â”€â”€ App.vue                       # Main tab navigation (Games / Movies / Series)
â”œâ”€â”€ tests/
â”‚   â”œâ”€â”€ helpers.ts                    # mountApp(), shared fixtures (ZELDA, MARIO, METROID)
â”‚   â”œâ”€â”€ GameList.render.test.ts       # Tab rendering, card counts
â”‚   â”œâ”€â”€ Filters.test.ts               # Platform/Storefront filter, fuzzy search, sort
â”‚   â”œâ”€â”€ GameBadges.test.ts            # PlayNext badge, statusCounts, cover fallback
â”‚   â”œâ”€â”€ GameList.drag.test.ts         # Drag & Drop, startedOrder, saveSortOrder
â”‚   â”œâ”€â”€ Overlay.test.ts               # Overlay functionality tests
â”‚   â”œâ”€â”€ backend.mock.test.ts          # API call mocks: addGame, deleteGame, updateGame
â”‚   â””â”€â”€ setup.ts                      # Global test setup (afterEach cleanup)
â”œâ”€â”€ backend/
â”‚   â”œâ”€â”€ src/
â”‚   â”‚   â”œâ”€â”€ index.js                  # Express server entry point
â”‚   â”‚   â”œâ”€â”€ db/
â”‚   â”‚   â”‚   â””â”€â”€ library.js            # Full SQLite schema + migrations
â”‚   â”‚   â”œâ”€â”€ services/
â”‚   â”‚   â”‚   â”œâ”€â”€ tmdbService.js        # TMDB API (DE/EN, providers, episodes)
â”‚   â”‚   â”‚   â””â”€â”€ tmdbCache.js          # 7d/30d cache read/write helpers
â”‚   â”‚   â””â”€â”€ routes/
â”‚   â”‚       â”œâ”€â”€ games.js              # PC/Xbox/Switch/3DS + storefronts
â”‚   â”‚       â”œâ”€â”€ movies.js             # Watchlist/Watching/Finished
â”‚   â”‚       â”œâ”€â”€ series.js             # Series + Episode progress endpoints
â”‚   â”‚       â”œâ”€â”€ hltb.js               # HLTB search + cache
â”‚   â”‚       â”œâ”€â”€ tmdb.js               # TMDB search proxy
â”‚   â”‚       â”œâ”€â”€ next.js               # Cross-media Next Queue
â”‚   â”‚       â”œâ”€â”€ sortOrder.js          # Game custom sort order
â”‚   â”‚       â””â”€â”€ admin.js              # Cache purge
â”‚   â””â”€â”€ package.json
â”œâ”€â”€ vitest.config.ts
â”œâ”€â”€ vite.config.ts
â”œâ”€â”€ CLAUDE.md                         # This file
â””â”€â”€ README.md
```

---

## Database Schema (`backend/src/db/library.js`)

```sql
-- GAMES
games(id, externalId, status, userRating)
  status: 'backlog' | 'wishlist' | 'started' | 'completed' | 'retired' | 'shelved'
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
GET    /api/games                    -> load all games (w/ platforms, tags, HLTB data)
GET    /api/games/:id                -> single game
POST   /api/games                    -> { externalId, status, platforms[], tags[] }
PUT    /api/games/:id                -> { status, userRating }
PUT    /api/games/:id/platforms      -> update platforms array
DELETE /api/games/:id
GET    /api/hltb/search?q=...        -> HowLongToBeat search + cache
DELETE /api/hltb/cache/:extId        -> clear HLTB cache for one game
GET    /api/sort-order               -> load drag order
PUT    /api/sort-order               -> save drag order
```

### Movies (`/api/movies`)
```
GET    /api/movies
GET    /api/movies/:id
POST   /api/movies                   -> { externalId, status, providers[] }
PUT    /api/movies/:id               -> { status, userRating }
PUT    /api/movies/:id/providers     -> update providers array
DELETE /api/movies/:id
```

### Series (`/api/series`) + Episode Tracking (Phase 5)
```
GET    /api/series
GET    /api/series/:id
POST   /api/series                          -> { externalId, status, providers[] }
PUT    /api/series/:id                      -> { status, userRating }
PUT    /api/series/:id/providers            -> update providers array
DELETE /api/series/:id

-- Episode Tracking (NEW)
GET    /api/series/:id/episodes             -> all episodes (cached from TMDB, EN titles)
GET    /api/series/:id/progress             -> [{ season, episode, watchedAt }]
POST   /api/series/:id/progress/toggle      -> { season, episode } -> toggle watched
PUT    /api/series/:id/progress/season/:s   -> { episodes[], watched } -> bulk season toggle
DELETE /api/series/:id/cache                -> purge episode cache for this series
```

### Shared
```
GET    /api/tmdb/search?q=...&type=movie|series
GET    /api/next                     -> cross-media next queue
POST   /api/next                     -> { mediaIds[], mediaType }
DELETE /api/next/:mediaId            -> remove from queue
POST   /api/admin/cache-clear        -> purge ALL caches
```

---

## Key Data Structures

### Game Object
```js
{
  id: string,
  externalId: string,          // HLTB ID
  status: 'backlog' | 'wishlist' | 'started' | 'completed' | 'retired' | 'shelved',
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

### Frontend (.env in root)
```
VITE_API_URL=http://localhost:8787/api
```

### Backend (backend/.env)
```
PORT=8787
TMDB_API_KEY=your_tmdb_key_here
FRONTEND_URL=http://localhost:5173
```

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