import { db } from '../db/library.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function mapRow(row) {
  if (!row) return null
  return {
    id:              row.id,
    name:            row.name,
    gameplayMain:    row.gameplayMain,
    gameplayExtra:   row.gameplayExtra,
    gameplayComplete: row.gameplayComplete,
    gameplayAll:     row.gameplayAll,
    rating:          row.rating,
    dlcs:            JSON.parse(row.dlcs ?? '[]'),
    gameType:        row.gameType ?? 'game',
    releaseDateEu:   row.releaseDateEu ?? null,
    summary:         row.summary ?? null,
    platform:        row.platform ?? null,
    genre:           row.genre ?? null,
    developer:       row.developer ?? null,
    publisher:       row.publisher ?? null,
    updatedAt:       row.updatedAt ?? null,
    imagePath:       row.imagePath ?? null,
    imageThumbPath:  row.imageThumbPath ?? null,
    sourceImageUrl:  row.sourceImageUrl ?? null,
    imageHash:       row.imageHash ?? null,
    imageETag:       row.imageETag ?? null,
    imageLastModified: row.imageLastModified ?? null,
    imageCheckedAt:  row.imageCheckedAt ?? null,
    imageCheckIntervalMs: row.imageCheckIntervalMs ?? null,
    imageUnchangedChecks: row.imageUnchangedChecks ?? 0,
  }
}

export function getStaleFromCache(id) {
  return mapRow(db.prepare('SELECT * FROM hltbcache WHERE id = ?').get(id))
}

export function getFromCache(id) {
  const row = db.prepare('SELECT * FROM hltbcache WHERE id = ?').get(id)
  if (!row) return null
  if (Date.now() - row.updatedAt > SEVEN_DAYS_MS) return null
  return mapRow(row)
}

export function saveToCache(game) {
  db.prepare(`
    INSERT INTO hltbcache
      (id, name, gameplayMain, gameplayExtra, gameplayComplete, gameplayAll, rating, dlcs, gameType, releaseDateEu, summary, platform, genre, developer, publisher, updatedAt,
       imagePath, imageThumbPath, sourceImageUrl, imageHash, imageETag, imageLastModified, imageCheckedAt, imageCheckIntervalMs, imageUnchangedChecks)
    VALUES
      (@id, @name, @gameplayMain, @gameplayExtra, @gameplayComplete, @gameplayAll, @rating, @dlcs, @gameType, @releaseDateEu, @summary, @platform, @genre, @developer, @publisher, @updatedAt,
       @imagePath, @imageThumbPath, @sourceImageUrl, @imageHash, @imageETag, @imageLastModified, @imageCheckedAt, @imageCheckIntervalMs, @imageUnchangedChecks)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name,
      gameplayMain=excluded.gameplayMain, gameplayExtra=excluded.gameplayExtra,
      gameplayComplete=excluded.gameplayComplete, gameplayAll=excluded.gameplayAll,
      rating=excluded.rating, dlcs=excluded.dlcs, gameType=excluded.gameType, releaseDateEu=excluded.releaseDateEu,
      developer=excluded.developer,
      summary=excluded.summary, platform=excluded.platform, genre=excluded.genre,
      publisher=excluded.publisher, updatedAt=excluded.updatedAt,
      imagePath=COALESCE(excluded.imagePath, hltbcache.imagePath),
      imageThumbPath=COALESCE(excluded.imageThumbPath, hltbcache.imageThumbPath),
      sourceImageUrl=COALESCE(excluded.sourceImageUrl, hltbcache.sourceImageUrl),
      imageHash=COALESCE(excluded.imageHash, hltbcache.imageHash),
      imageETag=COALESCE(excluded.imageETag, hltbcache.imageETag),
      imageLastModified=COALESCE(excluded.imageLastModified, hltbcache.imageLastModified),
      imageCheckedAt=COALESCE(excluded.imageCheckedAt, hltbcache.imageCheckedAt),
      imageCheckIntervalMs=COALESCE(excluded.imageCheckIntervalMs, hltbcache.imageCheckIntervalMs),
      imageUnchangedChecks=COALESCE(excluded.imageUnchangedChecks, hltbcache.imageUnchangedChecks)
  `).run({
    ...game,
    dlcs: JSON.stringify(game.dlcs ?? []),
    gameType: game.gameType ?? 'game',
    releaseDateEu: game.releaseDateEu ?? null,
    summary: game.summary ?? null,
    platform: game.platform ?? null,
    genre: game.genre ?? null,
    developer: game.developer ?? null,
    publisher: game.publisher ?? null,
    imagePath: game.imagePath ?? null,
    imageThumbPath: game.imageThumbPath ?? null,
    sourceImageUrl: game.sourceImageUrl ?? game.imageUrl ?? null,
    imageHash: game.imageHash ?? null,
    imageETag: game.imageETag ?? null,
    imageLastModified: game.imageLastModified ?? null,
    imageCheckedAt: game.imageCheckedAt ?? null,
    imageCheckIntervalMs: game.imageCheckIntervalMs ?? null,
    imageUnchangedChecks: game.imageUnchangedChecks ?? 0,
    updatedAt: Date.now(),
  })
}

export function deleteFromCache(id) {
  db.prepare('DELETE FROM hltbcache WHERE id = ?').run(id)
}

export function updateImageMetadata(id, metadata) {
  db.prepare(`
    UPDATE hltbcache SET
      imagePath = @imagePath,
      imageThumbPath = @imageThumbPath,
      sourceImageUrl = @sourceImageUrl,
      imageHash = @imageHash,
      imageETag = @imageETag,
      imageLastModified = @imageLastModified,
      imageCheckedAt = @imageCheckedAt,
      imageCheckIntervalMs = @imageCheckIntervalMs,
      imageUnchangedChecks = @imageUnchangedChecks
    WHERE id = @id
  `).run({ id, ...metadata })
}
