/**
 * AI context for suggestions. Two modes: whats-next | new-recommendation.
 * Reads from DB and cache only (no external API).
 */
import { db } from '../db/library.js'

const TODAY_ISO = new Date().toISOString().slice(0, 10)
const CURRENT_YEAR = new Date().getFullYear()

function parseJsonArray(str, fallback = []) {
  if (!str) return fallback
  try {
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : fallback
  } catch {
    return fallback
  }
}

/** Movie/Series: released if releaseDateDe <= today or (no date and year <= current year). */
function isReleasedTmdb(row) {
  if (row.releaseDateDe) return row.releaseDateDe <= TODAY_ISO
  if (row.year) {
    const y = parseInt(row.year, 10)
    return !Number.isNaN(y) && y <= CURRENT_YEAR
  }
  return true
}

// ─── Movies ───────────────────────────────────────────────────────────────────

function hasStreamingProvider(row) {
  const providers = parseJsonArray(row.streamingProviders)
  return Array.isArray(providers) && providers.length > 0
}

export function getMovieContext(mode, options = {}) {
  const { streamingOnly = false } = options
  const finishedRows = db.prepare(`
    SELECT m.externalId, m.userRating, m.completedAt, t.titleEn, t.titleDe, t.genres
    FROM movies m
    LEFT JOIN tmdbcache t ON t.id = m.externalId AND t.mediaType = 'movie'
    WHERE m.status = 'finished'
    ORDER BY m.completedAt DESC
  `).all()

  const genreCount = new Map()
  for (const r of finishedRows) {
    for (const g of parseJsonArray(r.genres)) {
      const name = typeof g === 'string' ? g : (g?.name || g)
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1)
    }
  }
  const genrePreference = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const watchlistRows = db.prepare(`
    SELECT t.titleEn, t.titleDe, t.releaseDateDe, t.year, t.streamingProviders, m.externalId
    FROM movies m
    LEFT JOIN tmdbcache t ON t.id = m.externalId AND t.mediaType = 'movie'
    WHERE m.status = 'watchlist'
  `).all()

  let watchlistReleased = watchlistRows.filter((r) => isReleasedTmdb(r))
  if (mode === 'whats-next' && streamingOnly) {
    watchlistReleased = watchlistReleased.filter(hasStreamingProvider)
  }
  const watchlistTitles = watchlistReleased.map((r) => r.titleEn || r.titleDe || r.externalId || '').filter(Boolean)
  if (mode === 'whats-next') {
    const recentlyCompleted = finishedRows.slice(0, 5).map((r) => ({
      title: r.titleEn || r.titleDe || r.externalId || '',
      rating: r.userRating != null ? r.userRating : null,
    })).filter((r) => r.title)
    return {
      mode: 'whats-next',
      recentlyCompleted,
      genrePreference,
      poolTitles: watchlistTitles,
      excludeTmdbIds: [],
    }
  }

  // new-recommendation: no exclude list, 10 recent for taste
  const recentlyCompleted = finishedRows.slice(0, 10).map((r) => ({
    title: r.titleEn || r.titleDe || r.externalId || '',
    rating: r.userRating != null ? r.userRating : null,
  })).filter((r) => r.title)
  return {
    mode: 'new-recommendation',
    recentlyCompleted,
    genrePreference,
    poolTitles: [],
  }
}

// ─── Series ───────────────────────────────────────────────────────────────────

export function getSeriesContext(mode, episodeLength = 'any', options = {}) {
  const { streamingOnly = false } = options
  const finishedRows = db.prepare(`
    SELECT s.externalId, s.userRating, t.titleEn, t.titleDe, t.genres, t.runtime
    FROM series s
    LEFT JOIN tmdbcache t ON t.id = s.externalId AND t.mediaType = 'series'
    WHERE s.status = 'finished'
    ORDER BY s.completedAt DESC, s.id DESC
  `).all()

  const genreCount = new Map()
  for (const r of finishedRows) {
    for (const g of parseJsonArray(r.genres)) {
      const name = typeof g === 'string' ? g : (g?.name || g)
      if (name) genreCount.set(name, (genreCount.get(name) || 0) + 1)
    }
  }
  const genrePreference = [...genreCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const watchlistRows = db.prepare(`
    SELECT t.titleEn, t.titleDe, t.releaseDateDe, t.year, t.runtime, t.streamingProviders, s.externalId
    FROM series s
    LEFT JOIN tmdbcache t ON t.id = s.externalId AND t.mediaType = 'series'
    WHERE s.status = 'watchlist'
  `).all()
  const pausedRows = db.prepare(`
    SELECT t.titleEn, t.titleDe, t.releaseDateDe, t.year, t.runtime, t.streamingProviders, s.externalId
    FROM series s
    LEFT JOIN tmdbcache t ON t.id = s.externalId AND t.mediaType = 'series'
    WHERE s.status = 'paused'
  `).all()

  let watchlistReleased = watchlistRows.filter((r) => isReleasedTmdb(r))
  let pausedReleased = pausedRows.filter((r) => isReleasedTmdb(r))
  if (mode === 'whats-next' && streamingOnly) {
    watchlistReleased = watchlistReleased.filter(hasStreamingProvider)
    pausedReleased = pausedReleased.filter(hasStreamingProvider)
  }

  if (mode === 'whats-next') {
    const recentlyCompleted = finishedRows.slice(0, 5).map((r) => ({
      title: r.titleEn || r.titleDe || r.externalId || '',
      rating: r.userRating != null ? r.userRating : null,
    })).filter((r) => r.title)
    const poolWatchlist = watchlistReleased.map((r) => ({
      title: r.titleEn || r.titleDe || r.externalId,
      weight: 'high',
      runtime: r.runtime,
    })).filter((r) => r.title)
    const poolPaused = pausedReleased.map((r) => ({
      title: r.titleEn || r.titleDe || r.externalId,
      weight: 'low',
      runtime: r.runtime,
    })).filter((r) => r.title)
    return {
      mode: 'whats-next',
      recentlyCompleted,
      genrePreference,
      poolItems: [...poolWatchlist, ...poolPaused],
      excludeTmdbIds: [],
      episodeLength: 'any',
    }
  }

  // new-recommendation: last 5 finished + last 5 from paused/watching with recent episode progress
  const withProgress = db.prepare(`
    SELECT s.id, s.externalId, s.status, s.lastTouched,
           (SELECT MAX(ep.watchedAt) FROM episodeprogress ep WHERE ep.seriesId = s.id) AS maxEpisodeWatched
    FROM series s
    WHERE s.status IN ('watching', 'paused')
  `).all()
  const lastInteraction = (row) => {
    const touched = row.lastTouched ? new Date(row.lastTouched).getTime() : 0
    const ep = row.maxEpisodeWatched ?? 0
    return Math.max(touched, ep)
  }
  const sortedProgress = [...withProgress].sort((a, b) => lastInteraction(b) - lastInteraction(a))
  const recentFromProgress = sortedProgress.slice(0, 5)

  const recentlyCompleted = finishedRows.slice(0, 5).map((r) => ({
    title: r.titleEn || r.titleDe || r.externalId || '',
    rating: r.userRating != null ? r.userRating : null,
  })).filter((r) => r.title)
  const recentlyWatchingPaused = []
  for (const row of recentFromProgress) {
    const t = db.prepare('SELECT titleEn, titleDe FROM tmdbcache WHERE id = ? AND mediaType = ?').get(row.externalId, 'series')
    recentlyWatchingPaused.push({
      title: t?.titleEn || t?.titleDe || row.externalId,
      status: row.status,
    })
  }

  return {
    mode: 'new-recommendation',
    recentlyCompleted,
    recentlyWatchingPaused,
    genrePreference,
    poolItems: [],
    episodeLength,
  }
}

// ─── Games ───────────────────────────────────────────────────────────────────

function getHltbRow(externalId) {
  return db.prepare('SELECT name, gameplayMain, gameplayAll, rating, releaseDateEu FROM hltbcache WHERE id = ?').get(externalId)
}

function getNextGameIds() {
  return db.prepare('SELECT mediaId FROM next WHERE mediaType = ?').all('game').map((r) => r.mediaId)
}

function gamePlatforms(gameId) {
  return db.prepare('SELECT platform, storefront FROM gameplatforms WHERE gameId = ?').all(gameId)
}

function platformStr(platforms) {
  return platforms.map((p) => p.platform + (p.storefront ? ` (${p.storefront})` : '')).join(', ') || '–'
}

export function getGameContext(mode, options = {}) {
  const { platformFilter = [], sessionHint = 'any' } = options
  const today = TODAY_ISO

  const completedRows = db.prepare(`
    SELECT g.id, g.externalId, h.name, h.gameplayMain, h.gameplayAll, h.rating
    FROM games g
    LEFT JOIN hltbcache h ON h.id = g.externalId
    WHERE g.status IN ('completed', 'retired')
    ORDER BY g.completedAt DESC NULLS LAST, g.id DESC
  `).all()

  const completedIds = completedRows.map((r) => String(r.externalId))

  if (mode === 'whats-next') {
    const wishlistReleased = db.prepare(`
      SELECT g.id, g.externalId
      FROM games g
      INNER JOIN hltbcache h ON h.id = g.externalId
      WHERE g.status = 'wishlist'
        AND h.releaseDateEu IS NOT NULL AND h.releaseDateEu <= ?
    `).all(today)
    const playnextGames = db.prepare(`
      SELECT g.id, g.externalId
      FROM games g
      INNER JOIN next n ON n.mediaId = g.id AND n.mediaType = 'game'
    `).all()
    const seen = new Set()
    const pool = []
    for (const g of wishlistReleased) {
      if (seen.has(g.id)) continue
      seen.add(g.id)
      pool.push({ ...g, source: 'wishlist' })
    }
    for (const g of playnextGames) {
      if (seen.has(g.id)) continue
      seen.add(g.id)
      pool.push({ ...g, source: 'playnext' })
    }

    let poolGames = pool.map((g) => {
      const h = getHltbRow(g.externalId)
      const platforms = gamePlatforms(g.id)
      const platformList = platforms.map((p) => p.platform)
      const platformStrVal = platformStr(platforms)
      return {
        id: g.id,
        externalId: g.externalId,
        title: h?.name || g.externalId,
        source: g.source,
        platforms: platformStrVal,
        platformList,
        gameplayMain: h?.gameplayMain ?? null,
        gameplayAll: h?.gameplayAll ?? null,
        rating: h?.rating ?? null,
      }
    })

    if (platformFilter?.length) {
      poolGames = poolGames.filter((g) =>
        g.platformList.some((p) => platformFilter.includes(p))
      )
    }

    // Payload to AI: no platforms, platformList, rating; recentlyCompleted = names only
    const poolItemsForPayload = poolGames.map(({ id, externalId, title, source, gameplayMain, gameplayAll }) => ({
      id,
      externalId,
      title,
      source,
      gameplayMain,
      gameplayAll,
    }))
    const recentlyCompleted = completedRows.slice(0, 5).map((r) => r.name || r.externalId)

    return {
      mode: 'whats-next',
      poolItems: poolItemsForPayload,
      recentlyCompleted,
      sessionHint,
    }
  }

  // new-recommendation: no pool – AI suggests 10 games by taste; frontend will fetch HLTB and filter by backlog
  const recentlyCompleted = completedRows.slice(0, 10).map((r) => r.name || r.externalId)

  return {
    mode: 'new-recommendation',
    poolItems: [],
    recentlyCompleted,
    sessionHint,
  }
}
