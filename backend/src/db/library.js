import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const db = new Database(join(__dirname, '../../../backend.db'))
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL CHECK(status IN ('backlog','wishlist','started','completed','dropped','shelved')),
    userRating INTEGER CHECK(userRating BETWEEN 1 AND 10)
  );

  CREATE TABLE IF NOT EXISTS gameplatforms (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId     INTEGER NOT NULL,
    platform   TEXT NOT NULL CHECK(platform IN ('pc','xbox','switch','3ds')),
    storefront TEXT CHECK(storefront IN ('steam','epic','gog','battlenet','uplay','ea','xbox')),
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS gametags (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId INTEGER NOT NULL,
    tag    TEXT NOT NULL,
    UNIQUE(gameId, tag),
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS sortorder (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    gameId   INTEGER NOT NULL UNIQUE,
    position INTEGER NOT NULL,
    FOREIGN KEY (gameId) REFERENCES games(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS next (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    mediaId   INTEGER NOT NULL,
    mediaType TEXT NOT NULL CHECK(mediaType IN ('game','movie','series')),
    UNIQUE(mediaId, mediaType)
  );

  CREATE TABLE IF NOT EXISTS movies (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL CHECK(status IN ('watchlist','watching','finished')),
    userRating INTEGER CHECK(userRating BETWEEN 1 AND 10)
  );

  CREATE TABLE IF NOT EXISTS series (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    externalId TEXT NOT NULL UNIQUE,
    status     TEXT NOT NULL CHECK(status IN ('watchlist','watching','finished','dropped','paused')),
    userRating INTEGER CHECK(userRating BETWEEN 1 AND 10)
  );

  CREATE TABLE IF NOT EXISTS mediaproviders (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    mediaId   INTEGER NOT NULL,
    mediaType TEXT NOT NULL CHECK(mediaType IN ('movie','series')),
    provider  TEXT NOT NULL,
    UNIQUE(mediaId, mediaType, provider)
  );

  CREATE TABLE IF NOT EXISTS hltbcache (
    id               TEXT PRIMARY KEY,
    name             TEXT,
    imageUrl         TEXT,
    gameplayMain     REAL,
    gameplayExtra    REAL,
    gameplayComplete REAL,
    gameplayAll      REAL,
    rating           REAL,
    dlcs             TEXT,
    updatedAt        INTEGER
  );

  CREATE TABLE IF NOT EXISTS tmdbcache (
    id            TEXT NOT NULL,
    mediaType     TEXT NOT NULL CHECK(mediaType IN ('movie','series')),
    titleEn       TEXT,
    titleDe       TEXT,
    imageUrl      TEXT,
    year          TEXT,
    certification TEXT,
    rating        REAL,
    runtime       INTEGER,
    seasons       INTEGER,
    episodes      INTEGER,
    genres        TEXT,
    linkUrl       TEXT,
    originalLang  TEXT,
    streamingProviders TEXT,
    updatedAt     INTEGER,
    PRIMARY KEY(id, mediaType)
  );
`)

export function getGameWithPlatforms(id) {
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id)
  if (!game) return null
  const platforms = db.prepare('SELECT id, platform, storefront FROM gameplatforms WHERE gameId = ?').all(id)
  const tags = db.prepare('SELECT tag FROM gametags WHERE gameId = ?').all(id).map(r => r.tag)
  return { ...game, platforms, tags }
}

export function getMediaWithProviders(id, mediaType) {
  const table = mediaType === 'movie' ? 'movies' : 'series'
  const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id)
  if (!item) return null
  const providers = db
    .prepare(`SELECT id, provider FROM mediaproviders WHERE mediaId = ? AND mediaType = ?`)
    .all(id, mediaType)
  return { ...item, providers }
}
