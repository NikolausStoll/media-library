# Media Library Add-on Documentation

This page documents the Home Assistant add-on runtime configuration. The add-on runs the prebuilt `ghcr.io/nikolausstoll/media-library` image and serves the app through Home Assistant Ingress.

## Configuration

```yaml
port: 8099
db_path: /data/backend.db
static_dir: /app/public
TMDB_API_KEY: ""
AI_API_KEY: ""
AI_MODEL: "gpt-4o-mini"
BOOK_PREP_WEB_SEARCH_MODEL: "gpt-4o-mini"
IMAGE_QUALITY: 80
IMAGE_MAX_DIMENSION: 1200
IMAGE_QUALITY_THUMB: 80
IMAGE_MAX_DIMENSION_THUMB: 600
```

### `port`

Internal HTTP port used by the Node/Express backend.

Default: `8099`

Home Assistant Ingress is configured for port `8099`. Keep the default unless you also know how your direct port mapping should behave.

### `db_path`

SQLite database path inside the add-on container.

Default: `/data/backend.db`

The `/data` location is the persistent add-on data area. Keeping the default preserves the library across add-on restarts and upgrades.

### `static_dir`

Directory containing the built frontend served by Express.

Default: `/app/public`

The prebuilt image places the Vite build here. Change this only for a custom image/layout.

### `TMDB_API_KEY`

Optional password field for TMDB metadata.

When configured, movies and series can fetch covers, DE/EN titles, German certifications, German streaming providers, genres, runtimes, videos, release dates, and episode lists. Without it, the add-on still starts, but movie/series metadata lookups can fail or remain incomplete.

### `AI_API_KEY`

Optional password field for AI recommendations and book metadata draft preparation.

When empty, the app remains fully usable. The recommendation endpoint returns a deterministic fallback from the local library context, and book preparation falls back to Open Library data without LLM normalization.

### `AI_MODEL`

Model name passed to the OpenAI SDK for recommendation and book-preparation requests.

Default: `gpt-4o-mini`

### `BOOK_PREP_WEB_SEARCH_MODEL`

Model used only for the book ISBN web-search fallback when Open Library does not return enough usable metadata.

Default: `gpt-4o-mini`

### Book cover image options

Book covers imported from a URL or local file upload are stored locally as WebP files without changing the aspect ratio. The app stores an original image and, for images larger than the thumbnail maximum dimension, a separate thumbnail. Smaller images reuse the same WebP file for both paths.

- `IMAGE_QUALITY`: WebP quality for the original image. Default: `80`
- `IMAGE_MAX_DIMENSION`: maximum width or height for the original image. Default: `1200`
- `IMAGE_QUALITY_THUMB`: WebP quality for thumbnails. Default: `80`
- `IMAGE_MAX_DIMENSION_THUMB`: maximum width or height for thumbnails. Default: `600`

## Runtime Behavior

- The add-on reads Home Assistant options from `/data/options.json` in `docker/entrypoint.js`.
- The entrypoint exports `PORT`, `DB_PATH`, `STATIC_DIR`, `TMDB_API_KEY`, `AI_API_KEY`, `AI_MODEL`, `BOOK_PREP_WEB_SEARCH_MODEL`, and book-cover image settings before starting `node backend/src/index.js`.
- The backend serves all API routes under `/api`.
- The frontend uses relative `/api` calls, so no browser-side API URL needs to be configured.
- Static assets are served from `static_dir` when `index.html` exists there.
- The SQLite database is created automatically if it does not exist.
- `TMDB_API_KEY` is optional at startup; the backend logs a warning when it is missing.

## Persistent Data

The important persistent file is:

```text
/data/backend.db
```

This database stores library items, statuses, ratings, completion dates, providers, platforms, formats, Next queues, episode progress, and metadata caches.

## Metadata Caches

- HowLongToBeat game data is cached in SQLite.
- TMDB movie/series metadata uses a 7 day default TTL.
- TMDB episode details are cached separately for 30 days.
- Item overlays and the admin page can clear relevant caches.

## Admin Page

The backend exposes the admin dashboard at:

```text
/api/admin
```

Available admin functions include JSON export/import of user-owned library data, bulk game import by external IDs, and cache clearing.

Import replaces existing user-owned library rows and clears rebuildable metadata caches. Create a backup before importing.

## Direct Port

The add-on exposes:

```yaml
8099/tcp: 8099
```

Ingress is the normal access path. Direct port access is available when Home Assistant exposes the mapped port.

## Image And Repository

- Add-on slug: `media-library`
- Add-on image: `ghcr.io/nikolausstoll/media-library`
- Repository manifest: root `repository.yaml`
- Add-on metadata: `media-library/config.yaml`

If the image is private, Home Assistant needs GitHub Container Registry credentials with permission to pull it.
