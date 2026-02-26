import { db } from '../db/library.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function getFromCache(id, mediaType) {
  const row = db.prepare('SELECT * FROM tmdbcache WHERE id = ? AND mediaType = ?').get(id, mediaType)
  if (!row) return null
  if (Date.now() - row.updatedAt > SEVEN_DAYS_MS) return null
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
  }
}

export function saveToCache(item) {
  db.prepare(`
    INSERT INTO tmdbcache
      (id, mediaType, titleEn, titleDe, imageUrl, year, certification, rating,
       runtime, seasons, episodes, genres, streamingProviders, linkUrl, originalLang, updatedAt)
    VALUES
      (@id, @mediaType, @titleEn, @titleDe, @imageUrl, @year, @certification, @rating,
       @runtime, @seasons, @episodes, @genres, @streamingProviders, @linkUrl, @originalLang, @updatedAt)
    ON CONFLICT(id, mediaType) DO UPDATE SET
      titleEn=excluded.titleEn, titleDe=excluded.titleDe, imageUrl=excluded.imageUrl,
      year=excluded.year, certification=excluded.certification, rating=excluded.rating,
      runtime=excluded.runtime, seasons=excluded.seasons, episodes=excluded.episodes,
      genres=excluded.genres, streamingProviders=excluded.streamingProviders,
      linkUrl=excluded.linkUrl, originalLang=excluded.originalLang,
      updatedAt=excluded.updatedAt
  `).run({ ...item, updatedAt: Date.now() })
}

export function deleteFromCache(id, mediaType) {
  db.prepare('DELETE FROM tmdbcache WHERE id = ? AND mediaType = ?').run(id, mediaType)
}
