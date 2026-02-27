import { db } from '../db/library.js'

const SEVEN_DAYS_MS  = 7  * 24 * 60 * 60 * 1000
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
const MIN_TTL_DAYS  = 5
const MAX_TTL_DAYS  = 10
const DAY_MS = 24 * 60 * 60 * 1000

function randomTtlMs() {
  const days = Math.floor(Math.random() * (MAX_TTL_DAYS - MIN_TTL_DAYS + 1)) + MIN_TTL_DAYS
  return days * DAY_MS
}

// ─── TMDB Basis-Cache ────────────────────────────────────────────────────────

export function getFromCache(id, mediaType) {
  const row = db.prepare('SELECT * FROM tmdbcache WHERE id = ? AND mediaType = ?').get(id, mediaType)
  if (!row) return null
  const ttlMs = row.ttlMs ?? SEVEN_DAYS_MS
  if (Date.now() - row.updatedAt > ttlMs) return null
  return {
    id:                 row.id,
    mediaType:          row.mediaType,
    titleEn:            row.titleEn,
    titleDe:            row.titleDe,
    imageUrl:           row.imageUrl,
    year:               row.year,
    certification:      row.certification,
    rating:             row.rating,
    runtime:            row.runtime,
    seasons:            row.seasons,
    episodes:           row.episodes,
    genres:             row.genres,
    streamingProviders: row.streamingProviders,
    linkUrl:            row.linkUrl,
    originalLang:       row.originalLang,
    ttlMs:              row.ttlMs ?? SEVEN_DAYS_MS,
  }
}

export function saveToCache(item) {
  const ttlMs = randomTtlMs()
  db.prepare(`
    INSERT INTO tmdbcache
      (id, mediaType, titleEn, titleDe, imageUrl, year, certification, rating,
       runtime, seasons, episodes, genres, streamingProviders, linkUrl, originalLang, updatedAt, ttlMs)
    VALUES
      (@id, @mediaType, @titleEn, @titleDe, @imageUrl, @year, @certification, @rating,
       @runtime, @seasons, @episodes, @genres, @streamingProviders, @linkUrl, @originalLang, @updatedAt, @ttlMs)
    ON CONFLICT(id, mediaType) DO UPDATE SET
      titleEn=excluded.titleEn, titleDe=excluded.titleDe,
      imageUrl=excluded.imageUrl, year=excluded.year,
      certification=excluded.certification, rating=excluded.rating,
      runtime=excluded.runtime, seasons=excluded.seasons,
      episodes=excluded.episodes, genres=excluded.genres,
      streamingProviders=excluded.streamingProviders,
      linkUrl=excluded.linkUrl, originalLang=excluded.originalLang,
      updatedAt=excluded.updatedAt,
      ttlMs=excluded.ttlMs
  `).run({ ...item, updatedAt: Date.now(), ttlMs })
}

export function deleteFromCache(id, mediaType) {
  db.prepare('DELETE FROM tmdbcache WHERE id = ? AND mediaType = ?').run(id, mediaType)
}

// ─── Episode Cache ────────────────────────────────────────────────────────────

export function getEpisodesFromCache(externalId) {
  const rows = db.prepare(
    'SELECT * FROM tmdbcacheepisodes WHERE seriesId = ? ORDER BY season, episode'
  ).all(externalId)
  if (!rows.length) return null
  // Prüfe ob Cache noch frisch (anhand erster Zeile)
  if (Date.now() - rows[0].updatedAt > THIRTY_DAYS_MS) return null
  return rows.map(r => ({
    season:  r.season,
    episode: r.episode,
    titleEn: r.titleEn,
    airDate: r.airDate,
    runtime: r.runtime,
  }))
}

export function saveEpisodesToCache(externalId, episodes) {
  const now = Date.now()
  const insert = db.prepare(`
    INSERT INTO tmdbcacheepisodes (seriesId, season, episode, titleEn, airDate, runtime, updatedAt)
    VALUES (@seriesId, @season, @episode, @titleEn, @airDate, @runtime, @updatedAt)
    ON CONFLICT(seriesId, season, episode) DO UPDATE SET
      titleEn=excluded.titleEn, airDate=excluded.airDate,
      runtime=excluded.runtime, updatedAt=excluded.updatedAt
  `)
  const insertMany = db.transaction(eps => {
    for (const ep of eps) insert.run({ ...ep, seriesId: String(externalId), updatedAt: now })
  })
  insertMany(episodes)
}

export function deleteEpisodesFromCache(externalId) {
  db.prepare('DELETE FROM tmdbcacheepisodes WHERE seriesId = ?').run(String(externalId))
}

/** Setzt die Runtime einer Serie im Basis-Cache (z. B. aus Episoden-Runtimes berechnet). */
export function updateSeriesRuntimeInCache(externalId, runtime) {
  if (runtime == null) return
  const ttlMs = randomTtlMs()
  db.prepare(
    'UPDATE tmdbcache SET runtime = ?, updatedAt = ?, ttlMs = ? WHERE id = ? AND mediaType = ?'
  ).run(runtime, Date.now(), ttlMs, String(externalId), 'series')
}
