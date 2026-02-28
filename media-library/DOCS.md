# Home Assistant Add-on: Media Library

Track your games, movies, and TV series with a beautiful web interface directly in your Home Assistant!

## About

Media Library is a fullstack application for managing your media backlog across games, movies, and TV series. It features:

- **Game Tracking**: Integration with HowLongToBeat for playtime estimates
- **Movie & Series Tracking**: TMDB integration for metadata and streaming providers
- **Status Management**: Wishlist, Backlog, Started, Watching, Paused, Finished, Dropped
- **Play Next Queue**: Up to 6 entries for your next picks
- **Fuzzy Search**: Quick filtering by title, platform, genre
- **Episode Tracking**: Per-episode progress for TV series
- **Responsive Design**: Works great on desktop and mobile

## Installation

1. Add this repository to your Home Assistant Add-on Store:
   ```
   https://github.com/NikolausStoll/media-library
   ```

2. Install the "Media Library" add-on

3. Configure the add-on (see Configuration section)

4. Start the add-on

5. Access the web interface via the "Open Web UI" button

## Configuration

```yaml
port: 8099
db_path: /data/backend.db
static_dir: /app/public
TMDB_API_KEY: ""
```

### Option: `port`

The port on which the Media Library web interface will listen inside the container. Supervisor always forwards the Ingress port (8099) no matter which port you choose.

**Default**: `8099`

### Option: `db_path`

Where to store the SQLite database inside the container. This path is mounted from `/data/backend.db` on Home Assistant so your library persists across restarts.

**Default**: `/data/backend.db`

### Option: `static_dir`

Directory that the backend uses to serve the built frontend. Do not change unless you build the frontend yourself in a different location.

**Default**: `/app/public`

### Option: `TMDB_API_KEY`

Password field used to fetch metadata, including runtime, streaming providers, and episode data for movies and series. Leave it empty if you want to skip TMDB lookups; the add-on still works for games.

## Usage

After starting the add-on, click on "Open Web UI" to access the Media Library interface.

### Getting Started

1. **Add Media**: Click the "+" button to add games, movies, or series
2. **Track Progress**: Update status, playtime, or episode progress
3. **Organize**: Use the Play Next queue to plan what to play/watch next
4. **Search & Filter**: Use the search bar and filters to find your media

## Database

The database is stored in `/data/backend.db`; this folder is mounted to `/config/media-library/data` on Home Assistant to keep your library safe.

## Support

For issues or feature requests, please visit:
https://github.com/NikolausStoll/media-library/issues
