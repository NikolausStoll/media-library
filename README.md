# media-library

A personal game backlog manager - track what you're playing, what's next, and what you've completed.

Built with **Vue 3** + **Express.js** on Node.js.

---

## Features

- 6 tabs: Wishlist / Backlog / Started / Completed / Dropped / All
- HLTB Integration: Search HowLongToBeat to add games with cover art & playtime data
- Platform & Storefront tags: Tag games with platform (Switch, PC, Xbox, 3DS) and storefront (Steam, Epic, GOG, Battle.net, Ubisoft, EA, Xbox App)
- Game tags: Mark games as "physical" or "100%"
- Play Next list: Pin up to 6 games to the top of your backlog
- Drag & Drop ordering in the Started tab
- Fuzzy search + multi-filter (platform, storefront, tags)
- Sort by: Name, Rating, Playtime or custom drag order
- Grid/List view modes
- Dark mode by default (toggleable)
- Keyboard shortcut: ESC closes any open overlay
- HLTB cache with 7-day TTL
- Export/Import backup functionality via admin panel

---

## Tech Stack

| Layer      | Technology                              |
|------------|-----------------------------------------|
| Frontend   | Vue 3 (Composition API, script setup)   |
| Build      | Vite                                    |
| Backend    | Node.js + Express.js                    |
| Database   | SQLite (better-sqlite3)                 |
| Drag&Drop  | vue-draggable                           |
| Testing    | Vitest + @vue/test-utils                |

---

## Getting Started

### Prerequisites
- Node.js >= 18

### Installation

```bash
git clone https://github.com/your-username/media-library.git
cd media-library
npm install
cd backend
npm install
cd ..
```

### Development

```bash
# Start backend (Terminal 1)
cd backend
npm run dev

# Start frontend (Terminal 2)
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8787
- Admin Panel: http://localhost:8787/api/admin

### Environment Variables

Frontend (`.env.local` in root):
```
VITE_API_URL=http://localhost:8787/api
```

Backend (`backend/.env`):
```
PORT=8787
FRONTEND_URL=http://localhost:5173
```

---

## Running Tests

```bash
npm test           # Watch mode
npm test -- --run  # Run once (CI)
npm run test:ui    # Vitest UI
```

### Test Structure

```
tests/
├── helpers.ts                # Shared mountApp() + fixtures (ZELDA, MARIO, METROID)
├── GameList.render.test.ts   # Tab rendering & card counts
├── Filters.test.ts           # Platform/Storefront filter, fuzzy search, sort logic
├── GameBadges.test.ts        # PlayNext badges, statusCounts, cover fallback
├── GameList.drag.test.ts     # Drag & Drop, startedOrder, saveSortOrder
├── backend.mock.test.ts      # API call mocking (addGame, updateGame, deleteGame)
├── Overlay.test.ts           # Game detail overlay, status change, delete confirm
└── setup.ts                  # Global test setup
```

All 42 tests passing ✅

---

## Project Structure

```
/
├── src/
│   ├── components/
│   │   └── GameList.vue       # Main component (all logic)
│   ├── data/
│   │   ├── games.js           # Platform & storefront definitions
│   │   └── platformLogos.js   # Logo path resolver
│   ├── services/
│   │   └── gameStorage.js     # All API calls to backend
│   ├── App.vue
│   └── main.js
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── games.js       # CRUD operations for games
│   │   │   ├── hltb.js        # HowLongToBeat API proxy
│   │   │   ├── sortOrder.js   # Drag order persistence
│   │   │   ├── playNext.js    # Play-Next list management
│   │   │   └── admin.js       # Export/Import backup
│   │   ├── services/
│   │   │   ├── hltbService.js # HLTB scraper
│   │   │   └── db.js          # HLTB cache (SQLite)
│   │   ├── db/
│   │   │   ├── library.js     # Main database schema
│   │   │   └── seed.js        # (optional) seed data
│   │   └── index.js           # Express app setup
│   ├── backend.db             # SQLite database file
│   └── package.json
├── tests/                      # Vitest test suite
├── vitest.config.ts
├── CLAUDE.md                   # Full project documentation for AI
└── README.md                   # This file
```

---

## API Endpoints

### Games
- `GET /api/games` - List all games with HLTB data
- `GET /api/games/:id` - Get single game
- `POST /api/games` - Add new game
- `PUT /api/games/:id` - Update game status
- `PUT /api/games/:id/platforms` - Update game platforms
- `PUT /api/games/:id/tags` - Update game tags
- `DELETE /api/games/:id` - Delete game
- `DELETE /api/games/:id/cache` - Invalidate HLTB cache for game

### HLTB
- `GET /api/hltb/search?q=query` - Search HowLongToBeat
- `GET /api/hltb/:id` - Get game details from HLTB
- `DELETE /api/hltb/cache/:id` - Clear HLTB cache entry

### Sort Order & Play Next
- `GET /api/sort-order` - Load drag order (Started tab)
- `PUT /api/sort-order` - Save drag order
- `GET /api/play-next` - Load Play-Next list
- `PUT /api/play-next` - Save Play-Next list (max 6 games)
- `DELETE /api/play-next/:gameId` - Remove from Play-Next

### Admin
- `GET /api/admin` - Admin panel UI
- `GET /api/admin/export` - Export full database backup (JSON)
- `POST /api/admin/import` - Import backup (replaces all data)

---

## Database Schema

### Tables
- **games**: `id`, `externalId` (HLTB ID), `status`
- **gameplatforms**: `gameId`, `platform`, `storefront`
- **gametags**: `gameId`, `tag` (`physical`, `100%`)
- **sortorder**: `gameId`, `position` (for Started tab drag order)
- **playnext**: `gameId` (max 6 entries)
- **hltbcache**: HLTB data cache with 7-day TTL

All tables use foreign keys with `ON DELETE CASCADE`.

---

## Game Status Flow

```
wishlist -> backlog -> started -> completed
                   -> shelved -> started
                   -> dropped
```

**Special behavior:**
- Started tab includes both `started` and `shelved` games
- Removing a game from `backlog` status auto-removes it from Play-Next list

---

## Key Features Implementation

### Play Next List
- Max 6 games pinned to top of Backlog
- Auto-removes when game status changes away from `backlog`
- Drag to reorder

### HLTB Integration
- Automatic caching (7-day TTL) to reduce API calls
- Fetches: name, cover image, playtime data (main/extra/100%/all), rating, DLC list
- Manual cache invalidation per game available

### Drag & Drop (Started Tab)
- Custom sort order persisted in `sortorder` table
- Automatically switches to `custom` sort when entering Started tab
- Games not in sort order append to end

### Fuzzy Search
- Real-time search across game names
- Case-insensitive
- Works within current tab + active filters

---

## Development Notes

- **Port Configuration**: Backend runs on 8787, Frontend on 5173
- **No Semicolons**: Code style uses ASI (Automatic Semicolon Insertion)
- **Testing**: All API calls are mocked in tests, full coverage of UI interactions
- **State Management**: No Pinia/Vuex - all state in Vue `ref()` and `computed()`

See [CLAUDE.md](./CLAUDE.md) for detailed technical documentation.

---

## License

MIT
