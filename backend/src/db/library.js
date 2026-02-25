import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const db = new Database(join(__dirname, '../../backend.db'))

db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL CHECK(status IN ('backlog','wishlist','started','completed','retired','shelved'))
  );

  CREATE TABLE IF NOT EXISTS game_platforms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId     INTEGER NOT NULL,
    platform   TEXT NOT NULL CHECK(platform IN ('pc','xbox','switch','3ds')),
    storefront TEXT CHECK(storefront IN ('steam','epic','gog','battlenet','uplay','ea','xbox')),
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_tags (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    tag    TEXT NOT NULL,
    UNIQUE(gameId, tag),
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sort_order (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId   INTEGER NOT NULL UNIQUE,
    position INTEGER NOT NULL,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS play_next (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL UNIQUE,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );
`)

export function getGameWithPlatforms(id) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id)
  if (!game) return null
  const platforms = db
    .prepare('SELECT id, platform, storefront FROM game_platforms WHERE gameId = ?')
    .all(id)
  const tags = db
    .prepare('SELECT tag FROM game_tags WHERE gameId = ?')
    .all(id)
    .map(r => r.tag)
  return { ...game, platforms, tags }
}
