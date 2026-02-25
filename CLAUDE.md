# CLAUDE.md - Project Context for AI Assistants

## Project Overview
**media-list** - A fullstack web application to manage a personal game backlog.
Built with Vue 3 (Composition API) + Vite on the frontend,
and an Express.js backend on Node.js.

---

## Tech Stack

### Frontend
- **Framework:** Vue 3 with `<script setup>` (Composition API)
- **Build Tool:** Vite
- **Language:** TypeScript + JavaScript (.vue, .ts, .js)
- **Drag & Drop:** `vue-draggable` (vuedraggable)
- **Styling:** Plain CSS (dark mode default, `light-mode` class on `<body>` toggles)
- **State:** Local `ref()` / `computed()` - no Pinia/Vuex

### Backend
- **Runtime:** Node.js with Express.js
- **API Base:** `import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'`
- **Port:** Default 8787 (configurable via `PORT` env variable)
- **Key Endpoints:**
  - `GET    /api/games`                 -> load all games
  - `POST   /api/games`                 -> add game
  - `PUT    /api/games/:id`             -> update game
  - `PUT    /api/games/:id/platforms`   -> update game platforms
  - `PUT    /api/games/:id/tags`        -> update game tags
  - `DELETE /api/games/:id`             -> delete game
  - `GET    /api/hltb/search?q=...`     -> HowLongToBeat search
  - `DELETE /api/hltb/cache/:extId`     -> clear HLTB cache for a game
  - `GET    /api/sort-order`            -> load drag order (started tab)
  - `PUT    /api/sort-order`            -> save drag order
  - `GET    /api/play-next`             -> load play-next list
  - `PUT    /api/play-next`             -> save play-next list
  - `DELETE /api/play-next/:gameId`     -> remove game from play-next list

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
│   ├── components/
│   │   └── GameList.vue          # Main component (all logic lives here)
│   ├── data/
│   │   ├── games.js              # storefronts[], availablePlatforms[]
│   │   └── platformLogos.js      # getPlatformLogo(platform, storefront)
│   ├── services/
│   │   └── gameStorage.js        # All API calls (loadGames, addGame, etc.)
│   └── main.js
├── tests/
│   ├── helpers.ts                # mountApp(), shared fixtures (ZELDA, MARIO, METROID)
│   ├── GameList.render.test.ts   # Tab rendering, card counts
│   ├── Filters.test.ts           # Platform/Storefront filter, fuzzy search, sort
│   ├── GameBadges.test.ts        # PlayNext badge, statusCounts, cover fallback
│   ├── GameList.drag.test.ts     # Drag & Drop, startedOrder, saveSortOrder
│   ├── Overlay.test.ts           # Overlay functionality tests
│   ├── backend.mock.test.ts      # API call mocks: addGame, deleteGame, updateGame
│   └── setup.ts                  # Global test setup (afterEach cleanup)
├── backend/
│   ├── src/
│   │   ├── index.js              # Express server entry point
│   │   ├── routes/               # API route handlers
│   │   ├── services/             # Business logic (HLTB, database)
│   │   └── db/                   # Database setup and seeds
│   └── package.json
├── vitest.config.ts
├── vite.config.ts
├── CLAUDE.md                     # This file
└── README.md
```

---

## Key Data Structures

### Game Object
```typescript
interface Game {
  id: string
  externalId: string        // HowLongToBeat ID
  name: string
  status: 'backlog' | 'wishlist' | 'started' | 'shelved' | 'completed' | 'retired'
  coverUrl: string | null
  rating: number | null     // 1-10
  gameplayAll: number | null // HLTB hours
  platforms: Platform[]
}

interface Platform {
  platform: string   // e.g. 'switch', 'pc', 'ps5'
  storefront: string // e.g. 'nintendo', 'steam', 'psn'
}
```

---

## GameList.vue - Key Reactive State

| Ref | Type | Default | Description |
|-----|------|---------|-------------|
| `gameList` | `Game[]` | `[]` | All games |
| `startedOrder` | `string[]` | `[]` | Manual drag order for started tab |
| `playNextList` | `string[]` | `[]` | Array of game IDs in "Play Next" |
| `drag` | `boolean` | `false` | Drag operation in progress |
| `activeTab` | `string` | `'started'` | Current tab |
| `loading` | `boolean` | `true` | Initial data loading state |
| `newExternalId` | `string` | `''` | Input for adding new game |
| `addLoading` | `boolean` | `false` | Adding game in progress |
| `addError` | `string` | `''` | Error message when adding fails |
| `addSuccess` | `boolean` | `false` | Success state after adding |
| `sidebarOpen` | `boolean` | `true` | Sidebar visibility |
| `darkMode` | `boolean` | `localStorage value or true` | Dark mode toggle |
| `filterSectionsOpen` | `object` | `{ platformStorefront: true, sort: true }` | Filter section collapse state |
| `overlayGame` | `Game\|null` | `null` | Game shown in overlay |
| `showOverlay` | `boolean` | `false` | Game detail overlay |
| `deleteConfirm` | `boolean` | `false` | Delete confirmation state |
| `platformEditor` | `Game\|null` | `null` | Game being edited in platform editor |
| `showPlatformEditor` | `boolean` | `false` | Platform editor overlay |
| `showSearchOverlay` | `boolean` | `false` | HLTB search overlay |
| `overlaySearchQuery` | `string` | `''` | Query in HLTB search |
| `hltbResults` | `any[]` | `[]` | HLTB API results |
| `searchQuery` | `string` | `''` | Fuzzy search in game list |
| `platformFilter` | `string[]` | `[]` | Active platform filters |
| `storefrontFilter` | `string[]` | `[]` | Active storefront filters |
| `sortBy` | `string` | `'name'` | Sort key: name/rating/playtime/custom |
| `sortDirection` | `'asc' or 'desc'` | `'asc'` | Sort direction |
| `tags` | `string[]` | `[]` | Tag management state |
| `tagInput` | `string` | `''` | Input for new tag |
| `tagError` | `string` | `''` | Tag input error message |

---

## Important Business Logic

### Tabs
- Tabs: `backlog`, `wishlist`, `started`, `completed`, `retired`
- Switching to `started` tab automatically sets `sortBy = 'custom'`
- Switching away from `started` resets `sortBy = 'name'`, `sortDirection = 'asc'`

### statusCounts (Tab Badges)
- `started` tab count includes **both** `status: 'started'` and `status: 'shelved'` games
- All other tabs count their exact status match

### Backlog Structure
- **Play Next section** (top): games with `status === 'backlog'` AND `id` in `playNextList`
- **Normal Backlog section** (below): games with `status === 'backlog'` NOT in `playNextList`

### Drag & Drop (Started Tab)
- Only available in `started` tab
- Uses `startedOrder: string[]` to maintain manual sort order
- Games NOT in `startedOrder` are appended to the end
- `saveSortOrder()` is called after every `dragend` event

### Fuzzy Search (fuzzyMatch)
- Searches within the current tab's filtered game list
- Case-insensitive substring / fuzzy match on `game.name`

### ESC Key Handling (global keydown on document)
1. If `showSearchOverlay` -> `closeSearchOverlay()`
2. Else if `showOverlay` -> `showOverlay = false`
3. Else if `showPlatformEditor` -> `showPlatformEditor = false`

### Play Next - Auto-Remove
- When a game's status changes away from `backlog`, it is automatically removed from `playNextList`

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

# Run tests with UI
npm run test:ui

# Build frontend
npm run build
```

---

## Testing Conventions

- All tests use `vi.mock()` at the top of each file for `gameStorage.js`, `games.js`, `platformLogos.js`
- `global.fetch` is always mocked: `vi.fn().mockResolvedValue({ ok: true, json: async () => [] })`
- Shared fixtures and `mountApp()` helper live in `tests/helpers.ts`
- Always call `await flushPromises()` + `await nextTick()` after mount and after interactions
- `document.body.innerHTML = ''` + `vi.clearAllMocks()` in every `afterEach`
- ESC-Key events must be dispatched on `document` directly:
  `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`

### Important Test-Specific Selectors
- `.search-input` - Search/filter input field
- `.add-game-input` - Input for adding games (external ID)
- `.add-game-btn` - Button to add a game
- `.play-next-section` - Play Next area in Backlog tab
- `.status-btn` - Status change buttons in overlay (e.g., "Completed")
- `.delete-trigger-btn` - Initial delete button in overlay
- `.delete-confirm-btn` - Confirmation button for delete action

### Test Patterns
- **Default Tab**: Tests must account for `activeTab = 'started'` as the default
- Most tests need to explicitly switch to `'backlog'` tab to test ZELDA (status: backlog)
- Always check if elements exist before interacting: `expect(element.exists()).toBe(true)`
- Use specific CSS class selectors instead of searching by text for better reliability

---

## Environment Variables

### Frontend (.env in root)
```
VITE_API_URL=http://localhost:3000/api   # Dev (default if not set)
```

### Backend (backend/.env)
```
PORT=3000                                 # API server port (default: 3000)
FRONTEND_URL=http://localhost:5173       # CORS origin (default: http://localhost:5173)
```

**Note:** There is currently an inconsistency in the code:
- `gameStorage.js` defaults to port `8787`
- `GameList.vue` defaults to port `3000`
- Backend actually runs on port `3000`
- Recommendation: Set `VITE_API_URL=http://localhost:3000/api` explicitly to ensure consistency

---

## Known Patterns & Gotchas

- `vue-draggable` is mocked implicitly via JSDOM - emit `'end'` directly on the component to test drag callbacks
- `getPlatformLogo` always returns `null` in tests (mocked)
- The `filterSectionsOpen` ref uses an object: `{ platformStorefront: true, sort: true }`
- `addGame(externalId, status, platforms)` - **3 parameters**: externalId, initial status, platforms array
- After `deleteGame`, the item must be removed from `gameList` locally (no full reload)
- After `updateGame` (status change), `showOverlay` is set to `false` and `overlayGame` to `null`
- Status buttons in overlay use labels from `statusOptions`: "Wishlist", "Backlog", "Started", "Shelved", "Completed", "Retired"
- Add-game button (`.add-game-btn`) is disabled when input is empty via `:disabled` attribute
