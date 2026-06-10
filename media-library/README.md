# Home Assistant Add-on: Media Library

Media Library brings a personal games, books, movies, and series backlog directly into Home Assistant.

## Features

- Track games, books, movies, and TV series from one responsive web interface.
- Organize every media type by meaningful statuses like wishlist, backlog/watchlist, started/watching, paused/shelved, finished/completed, and dropped.
- Keep separate Play Next, Read Next, and Watch Next queues with up to 6 planned items per media type.
- Enrich games with HowLongToBeat covers, ratings, playtime estimates, DLC/game type information, and release dates.
- Maintain books with editable local metadata, language filtering, series info, ISBN/publisher/page data, format tracking, and optional ISBN-based draft preparation.
- Add books manually, by title search with edition filtering, by typing or scanning an ISBN, optionally preparing fields with Open Library/LLM assistance, and with local/URL cover images stored as WebP originals and thumbnails.
- Enrich movies and series with TMDB covers, genres, runtimes, certifications, release dates, trailers, and German streaming-provider availability.
- Track TV progress episode by episode, including season-level bulk watched/unwatched controls.
- Filter and sort by title, rating, year, playtime, pages, platform, storefront, format, genre, provider, and unrated items.
- Switch between grid/list layouts, density options, mobile-friendly swipe navigation, and dark mode.
- Edit ratings, completion dates, platforms, formats, tags, and providers from item overlays.
- Use optional AI recommendations for games, movies, and series. When no AI key is configured, the app still works with local fallback suggestions.
- Use the built-in admin page to export/import user-owned library data, bulk-import games, and clear metadata caches.

## External Metadata

- Games: HowLongToBeat
- Books: local-first data with title/edition search and barcode-assisted ISBN entry
- Movies and series: TMDB, including German streaming-provider data
- Optional recommendations: OpenAI API key through the configured OpenAI SDK
