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

function mapRow(row) {
  if (!row) return null
  return {
    id:                 row.id,
    mediaType:          row.mediaType,
    titleEn:            row.titleEn,
    titleDe:            row.titleDe,
    year:               row.year,
    certification:      row.certification,
    rating:             row.rating,
    runtime:            row.runtime,
    seasons:            row.seasons,
    episodes:           row.episodes,
    genres:             row.genres,
    streamingProviders: row.streamingProviders,
    linkUrl:            row.linkUrl,
    releaseDateDe:      row.releaseDateDe,
    originalLang:       row.originalLang,
    ttlMs:              row.ttlMs ?? SEVEN_DAYS_MS,
    videos:             JSON.parse(row.videos ?? '[]'),
    overview:           row.overview ?? null,
    directors:          JSON.parse(row.directors ?? '[]'),
    cast:               JSON.parse(row.cast ?? '[]'),
    creators:           JSON.parse(row.creators ?? '[]'),
    productionStatus:   row.productionStatus ?? null,
    imagePath:          row.imagePath ?? null,
    imageThumbPath:     row.imageThumbPath ?? null,
    sourceImageUrl:     row.sourceImageUrl ?? null,
    imageHash:          row.imageHash ?? null,
    imageETag:          row.imageETag ?? null,
    imageLastModified:  row.imageLastModified ?? null,
    imageCheckedAt:     row.imageCheckedAt ?? null,
    imageCheckIntervalMs: row.imageCheckIntervalMs ?? null,
    imageUnchangedChecks: row.imageUnchangedChecks ?? 0,
  }
}

export function getStaleFromCache(id, mediaType) {
  return mapRow(db.prepare('SELECT * FROM tmdbcache WHERE id = ? AND mediaType = ?').get(id, mediaType))
}

export function getFromCache(id, mediaType) {
  const row = db.prepare('SELECT * FROM tmdbcache WHERE id = ? AND mediaType = ?').get(id, mediaType)
  if (!row) return null
  const ttlMs = row.ttlMs ?? SEVEN_DAYS_MS
  if (Date.now() - row.updatedAt > ttlMs) return null
  return mapRow(row)
}

export function saveToCache(item) {
  const ttlMs = randomTtlMs()
  db.prepare(`
    INSERT INTO tmdbcache
      (id, mediaType, titleEn, titleDe, year, certification, rating,
       runtime, seasons, episodes, genres, streamingProviders, linkUrl, releaseDateDe, originalLang,
       videos, updatedAt, ttlMs,
       overview, directors, cast, creators, productionStatus,
       imagePath, imageThumbPath, sourceImageUrl, imageHash, imageETag, imageLastModified, imageCheckedAt, imageCheckIntervalMs, imageUnchangedChecks)
    VALUES
      (@id, @mediaType, @titleEn, @titleDe, @year, @certification, @rating,
       @runtime, @seasons, @episodes, @genres, @streamingProviders, @linkUrl, @releaseDateDe, @originalLang,
       @videos, @updatedAt, @ttlMs,
       @overview, @directors, @cast, @creators, @productionStatus,
       @imagePath, @imageThumbPath, @sourceImageUrl, @imageHash, @imageETag, @imageLastModified, @imageCheckedAt, @imageCheckIntervalMs, @imageUnchangedChecks)
    ON CONFLICT(id, mediaType) DO UPDATE SET
      titleEn=excluded.titleEn, titleDe=excluded.titleDe,
      year=excluded.year,
      certification=excluded.certification, rating=excluded.rating,
      runtime=excluded.runtime, seasons=excluded.seasons,
      episodes=excluded.episodes, genres=excluded.genres,
      streamingProviders=excluded.streamingProviders,
      linkUrl=excluded.linkUrl, releaseDateDe=excluded.releaseDateDe, originalLang=excluded.originalLang,
      videos=excluded.videos,
      updatedAt=excluded.updatedAt,
      ttlMs=excluded.ttlMs,
      overview=excluded.overview,
      directors=excluded.directors, cast=excluded.cast, creators=excluded.creators, productionStatus=excluded.productionStatus,
      imagePath=COALESCE(excluded.imagePath, tmdbcache.imagePath),
      imageThumbPath=COALESCE(excluded.imageThumbPath, tmdbcache.imageThumbPath),
      sourceImageUrl=COALESCE(excluded.sourceImageUrl, tmdbcache.sourceImageUrl),
      imageHash=COALESCE(excluded.imageHash, tmdbcache.imageHash),
      imageETag=COALESCE(excluded.imageETag, tmdbcache.imageETag),
      imageLastModified=COALESCE(excluded.imageLastModified, tmdbcache.imageLastModified),
      imageCheckedAt=COALESCE(excluded.imageCheckedAt, tmdbcache.imageCheckedAt),
      imageCheckIntervalMs=COALESCE(excluded.imageCheckIntervalMs, tmdbcache.imageCheckIntervalMs),
      imageUnchangedChecks=COALESCE(excluded.imageUnchangedChecks, tmdbcache.imageUnchangedChecks)
  `).run({
    ...item,
    releaseDateDe: item.releaseDateDe ?? null,
    videos: JSON.stringify(item.videos ?? []),
    overview: item.overview ?? null,
    directors: JSON.stringify(item.directors ?? []),
    cast: JSON.stringify(item.cast ?? []),
    creators: JSON.stringify(item.creators ?? []),
    productionStatus: item.productionStatus ?? null,
    updatedAt: Date.now(),
    ttlMs,
    imagePath: item.imagePath ?? null,
    imageThumbPath: item.imageThumbPath ?? null,
    sourceImageUrl: item.sourceImageUrl ?? item.imageUrl ?? null,
    imageHash: item.imageHash ?? null,
    imageETag: item.imageETag ?? null,
    imageLastModified: item.imageLastModified ?? null,
    imageCheckedAt: item.imageCheckedAt ?? null,
    imageCheckIntervalMs: item.imageCheckIntervalMs ?? null,
    imageUnchangedChecks: item.imageUnchangedChecks ?? 0,
  })
}

export function deleteFromCache(id, mediaType) {
  db.prepare('DELETE FROM tmdbcache WHERE id = ? AND mediaType = ?').run(id, mediaType)
}

export function updateImageMetadata(id, mediaType, metadata) {
  db.prepare(`
    UPDATE tmdbcache SET
      imagePath = @imagePath,
      imageThumbPath = @imageThumbPath,
      sourceImageUrl = @sourceImageUrl,
      imageHash = @imageHash,
      imageETag = @imageETag,
      imageLastModified = @imageLastModified,
      imageCheckedAt = @imageCheckedAt,
      imageCheckIntervalMs = @imageCheckIntervalMs,
      imageUnchangedChecks = @imageUnchangedChecks
    WHERE id = @id AND mediaType = @mediaType
  `).run({ id, mediaType, ...metadata })
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
