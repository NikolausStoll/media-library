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
port: 8787
```

### Option: `port`

The port on which the Media Library web interface will be available.

**Default**: `8787`

## Usage

After starting the add-on, click on "Open Web UI" to access the Media Library interface.

### Getting Started

1. **Add Media**: Click the "+" button to add games, movies, or series
2. **Track Progress**: Update status, playtime, or episode progress
3. **Organize**: Use the Play Next queue to plan what to play/watch next
4. **Search & Filter**: Use the search bar and filters to find your media

### API Keys (Optional)

For enhanced features, you may want to add API keys:

- **TMDB API**: For movie and series metadata (required for movies/series)
- Place your API keys in the add-on configuration or environment

## Database

The database is stored in `/config/media-library/backend.db` and will persist across add-on restarts.

## Support

For issues or feature requests, please visit:
https://github.com/NikolausStoll/media-library/issues
