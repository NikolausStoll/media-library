/**
 * AI context data for suggestion prompts. Reads from DB and cache tables only (no external API calls).
 */
import { db } from '../db/library.js'
import { mapGameStatusFromDb } from '../db/library.js'

const TODAY_ISO = new Date().toISOString().slice(0, 10)

// ─── Movies: finished + watchlist for exclusion; recent with ratings for taste ─

function parseJsonArray(str, fallback = []) {
  if (!str) return fallback
  try {
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : fallback
  } catch {
    return fallback
  }
}

export function getMovieContext() {
  const finishedRows = db.prepare(`
    SELECT m.userRating, m.completedAt, t.titleEn, t.titleDe, t.genres
    FROM movies m
    LEFT JOIN tmdbcache t ON t.id = m.externalId AND t.mediaType = 'movie'
    WHERE m.status = 'finished'
    ORDER BY m.completedAt DESC
  `).all()

  const finishedTitles = finishedRows.map((r) => r.titleEn || r.titleDe || r.externalId || '').filter(Boolean)
  const recentlyCompleted = finishedRows.slice(0, 25).map((r) => {
    const title = r.titleEn || r.titleDe || r.externalId
    const rating = r.userRating != null ? `★${r.userRating}` : ''
    return `${title}${rating ? ` ${rating}` : ''}`
  })

  const genreCount = new Map()
  for (const r of finishedRows) {
    for (const g of parseJsonArray(r.genres)) {
      const name = typeof g === 'string' ? g : (g?.name || g)
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1)
    }
  }
  const topGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name)

  const watchlistRows = db.prepare(`
    SELECT t.titleEn, t.titleDe, m.externalId
    FROM movies m
    LEFT JOIN tmdbcache t ON t.id = m.externalId AND t.mediaType = 'movie'
    WHERE m.status = 'watchlist'
  `).all()
  const watchlistTitles = watchlistRows.map((r) => r.titleEn || r.titleDe || r.externalId || '').filter(Boolean)

  return {
    recentlyCompleted,
    topGenres,
    finishedTitles,
    watchlistTitles,
    filteredItems: [],
  }
}

// ─── Series: watching + paused, last_interaction from series + episodes ─────

export function getSeriesContext() {
  const withProgress = db.prepare(`
    SELECT s.id, s.externalId, s.status, s.lastTouched,
           (SELECT MAX(ep.watchedAt) FROM episodeprogress ep WHERE ep.seriesId = s.id) AS maxEpisodeWatched
    FROM series s
    WHERE s.status IN ('watching', 'paused')
  `).all()

  const lastInteraction = (row) => {
    const a = row.lastTouched ? new Date(row.lastTouched).getTime() : 0
    const b = row.maxEpisodeWatched ?? 0
    return Math.max(a, b)
  }

  const statusOrder = { watching: 0, paused: 1 }
  const sorted = [...withProgress].sort((a, b) => {
    if (statusOrder[a.status] !== statusOrder[b.status])
      return statusOrder[a.status] - statusOrder[b.status]
    return lastInteraction(b) - lastInteraction(a) // DESC: most recent first
  })

  const filteredItems = []
  for (const row of sorted) {
    const progressRows = db.prepare(
      'SELECT season, episode FROM episodeprogress WHERE seriesId = ? ORDER BY season DESC, episode DESC LIMIT 1'
    ).get(row.id)
    const progressStr = progressRows
      ? `S${progressRows.season} E${progressRows.episode}`
      : '–'
    const tmdb = db.prepare('SELECT titleEn, titleDe, genres FROM tmdbcache WHERE id = ? AND mediaType = ?').get(row.externalId, 'series')
    const title = tmdb?.titleEn || tmdb?.titleDe || row.externalId
    const genres = parseJsonArray(tmdb?.genres).join(', ')
    const lastTouched = row.lastTouched || (row.maxEpisodeWatched ? new Date(row.maxEpisodeWatched).toISOString().slice(0, 10) : '–')
    filteredItems.push({
      title,
      status: row.status,
      progress: progressStr,
      genres: genres || '–',
      lastTouched,
    })
  }

  const finishedRows = db.prepare(`
    SELECT s.externalId, s.userRating, t.titleEn, t.titleDe, t.genres
    FROM series s
    LEFT JOIN tmdbcache t ON t.id = s.externalId AND t.mediaType = 'series'
    WHERE s.status = 'finished'
    ORDER BY s.id DESC
  `).all()
  const finishedTitles = finishedRows.map((r) => r.titleEn || r.titleDe || r.externalId || '').filter(Boolean)
  const recentlyCompleted = finishedRows.slice(0, 25).map((r) => {
    const title = r.titleEn || r.titleDe || r.externalId
    const rating = r.userRating != null ? `★${r.userRating}` : ''
    return `${title}${rating ? ` ${rating}` : ''}`
  })

  const genreCount = new Map()
  for (const r of finishedRows) {
    for (const g of parseJsonArray(r.genres)) {
      const name = typeof g === 'string' ? g : (g?.name || g)
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1)
    }
  }
  const topGenres = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name]) => name)

  const watchlistRows = db.prepare(`
    SELECT t.titleEn, t.titleDe, s.externalId
    FROM series s
    LEFT JOIN tmdbcache t ON t.id = s.externalId AND t.mediaType = 'series'
    WHERE s.status = 'watchlist'
  `).all()
  const watchlistTitles = watchlistRows.map((r) => r.titleEn || r.titleDe || r.externalId || '').filter(Boolean)

  return {
    filteredItems,
    recentlyCompleted,
    topGenres,
    finishedTitles,
    watchlistTitles,
  }
}

// ─── Games: continue / shelved / new ─────────────────────────────────────────

function getHltbRow(externalId) {
  return db.prepare('SELECT name, gameplayMain, gameplayAll, rating, releaseDateEu FROM hltbcache WHERE id = ?').get(externalId)
}

function getNextGameIds() {
  return db.prepare('SELECT mediaId FROM next WHERE mediaType = ?').all('game').map((r) => r.mediaId)
}

export function getGameContext(mode) {
  const nextIds = new Set(getNextGameIds().map(String))
  const today = TODAY_ISO

  if (mode === 'continue') {
    const orderRows = db.prepare('SELECT gameId, position FROM sortorder ORDER BY position').all()
    const orderByPos = new Map(orderRows.map((r) => [r.gameId, r.position]))
    const rows = db.prepare(`
      SELECT g.id, g.externalId, g.status, g.lastTouched
      FROM games g
      WHERE g.status = 'started'
    `).all()
    rows.sort((a, b) => {
      const posA = orderByPos.get(a.id) ?? 1e9
      const posB = orderByPos.get(b.id) ?? 1e9
      if (posA !== posB) return posA - posB
      const ta = a.lastTouched || ''
      const tb = b.lastTouched || ''
      return ta.localeCompare(tb)
    })

    const filteredItems = rows.map((g) => {
      const h = getHltbRow(g.externalId)
      const platforms = db.prepare('SELECT platform, storefront FROM gameplatforms WHERE gameId = ?').all(g.id)
      const platformStr = platforms.map((p) => p.platform + (p.storefront ? ` (${p.storefront})` : '')).join(', ') || '–'
      return {
        title: h?.name || g.externalId,
        status: mapGameStatusFromDb(g.status),
        lastTouched: g.lastTouched || '–',
        gameplayMain: h?.gameplayMain ?? null,
        gameplayAll: h?.gameplayAll ?? null,
        rating: h?.rating ?? null,
        platforms: platformStr,
      }
    })
    return { filteredItems, recentlyCompleted: [], topGenres: [] }
  }

  if (mode === 'shelved') {
    const rows = db.prepare(`
      SELECT g.id, g.externalId, g.status, g.lastTouched
      FROM games g
      WHERE g.status = 'shelved'
    `).all()

    const filteredItems = rows.map((g) => {
      const h = getHltbRow(g.externalId)
      const platforms = db.prepare('SELECT platform, storefront FROM gameplatforms WHERE gameId = ?').all(g.id)
      const platformStr = platforms.map((p) => p.platform).join(', ') || '–'
      return {
        title: h?.name || g.externalId,
        status: mapGameStatusFromDb(g.status),
        lastTouched: g.lastTouched || '–',
        gameplayMain: h?.gameplayMain ?? null,
        gameplayAll: h?.gameplayAll ?? null,
        rating: h?.rating ?? null,
        platforms: platformStr,
      }
    })
    return { filteredItems, recentlyCompleted: [], topGenres: [] }
  }

  // mode === 'new': wishlist (released) + playnext + backlog, with hype
  const wishlistReleased = db.prepare(`
    SELECT g.id, g.externalId, g.status
    FROM games g
    INNER JOIN hltbcache h ON h.id = g.externalId
    WHERE g.status = 'wishlist'
      AND h.releaseDateEu IS NOT NULL AND h.releaseDateEu <= ?
  `).all(today)

  const backlog = db.prepare("SELECT id, externalId, status FROM games WHERE status = 'backlog'").all()
  const playnextGames = db.prepare(`
    SELECT g.id, g.externalId, g.status
    FROM games g
    INNER JOIN next n ON n.mediaId = g.id AND n.mediaType = 'game'
  `).all()

  const seen = new Set()
  const withHype = []
  for (const g of wishlistReleased) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    withHype.push({ ...g, hype: 4 })
  }
  for (const g of playnextGames) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    withHype.push({ ...g, hype: 2 })
  }
  for (const g of backlog) {
    if (seen.has(g.id)) continue
    seen.add(g.id)
    withHype.push({ ...g, hype: 0 })
  }

  const filteredItems = withHype.map((g) => {
    const h = getHltbRow(g.externalId)
    const platforms = db.prepare('SELECT platform, storefront FROM gameplatforms WHERE gameId = ?').all(g.id)
    const platformStr = platforms.map((p) => p.platform).join(', ') || '–'
    return {
      title: h?.name || g.externalId,
      status: mapGameStatusFromDb(g.status),
      hype: g.hype,
      gameplayMain: h?.gameplayMain ?? null,
      gameplayAll: h?.gameplayAll ?? null,
      rating: h?.rating ?? null,
      platforms: platformStr,
    }
  })

  return { filteredItems, recentlyCompleted: [], topGenres: [] }
}
