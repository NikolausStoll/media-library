import { db } from '../db/library.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function getFromCache(id) {
  const row = db.prepare('SELECT * FROM hltbcache WHERE id = ?').get(id)
  if (!row) return null
  if (Date.now() - row.updatedAt > SEVEN_DAYS_MS) return null
  return {
    id:              row.id,
    name:            row.name,
    imageUrl:        row.imageUrl,
    gameplayMain:    row.gameplayMain,
    gameplayExtra:   row.gameplayExtra,
    gameplayComplete: row.gameplayComplete,
    gameplayAll:     row.gameplayAll,
    rating:          row.rating,
    dlcs:            JSON.parse(row.dlcs ?? '[]'),
    gameType:        row.gameType ?? 'game',
  }
}

export function saveToCache(game) {
  db.prepare(`
    INSERT INTO hltbcache
      (id, name, imageUrl, gameplayMain, gameplayExtra, gameplayComplete, gameplayAll, rating, dlcs, gameType, updatedAt)
    VALUES
      (@id, @name, @imageUrl, @gameplayMain, @gameplayExtra, @gameplayComplete, @gameplayAll, @rating, @dlcs, @gameType, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, imageUrl=excluded.imageUrl,
      gameplayMain=excluded.gameplayMain, gameplayExtra=excluded.gameplayExtra,
      gameplayComplete=excluded.gameplayComplete, gameplayAll=excluded.gameplayAll,
    rating=excluded.rating, dlcs=excluded.dlcs, gameType=excluded.gameType, updatedAt=excluded.updatedAt
  `).run({
    ...game,
    dlcs: JSON.stringify(game.dlcs ?? []),
    gameType: game.gameType ?? 'game',
    updatedAt: Date.now(),
  })
}

export function deleteFromCache(id) {
  db.prepare('DELETE FROM hltbcache WHERE id = ?').run(id)
}
