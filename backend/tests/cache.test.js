import { mkdtempSync } from 'node:fs'
import { rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const testDir = mkdtempSync(join(tmpdir(), 'media-library-cache-test-'))
process.env.DB_PATH = join(testDir, 'test.db')

const { db } = await import('../src/db/library.js')
const { getFromCache, getStaleFromCache, saveToCache } = await import('../src/services/tmdbCache.js')

function movieCache(overrides = {}) {
  return {
    id: 'movie', mediaType: 'movie', titleEn: null, titleDe: null, imageUrl: null,
    year: null, certification: null, rating: null, runtime: null, seasons: null,
    episodes: null, genres: '[]', streamingProviders: '[]', linkUrl: null,
    releaseDateDe: null, originalLang: null, videos: [], ...overrides,
  }
}

test.after(() => {
  db.close()
  rmSync(testDir, { recursive: true, force: true })
})

test('preserves an existing TMDB cover when a refresh has no image', () => {
  saveToCache(movieCache({ id: 'cache-movie', titleEn: 'Movie', imageUrl: 'https://image.test/cover.jpg' }))
  saveToCache(movieCache({ id: 'cache-movie', titleEn: 'Movie refreshed' }))

  assert.equal(getFromCache('cache-movie', 'movie').imageUrl, 'https://image.test/cover.jpg')
})

test('exposes expired TMDB metadata as a fallback', () => {
  saveToCache(movieCache({ id: 'stale-movie', titleEn: 'Stale Movie', imageUrl: 'https://image.test/stale.jpg' }))
  db.prepare('UPDATE tmdbcache SET updatedAt = ? WHERE id = ? AND mediaType = ?')
    .run(Date.now() - 31 * 24 * 60 * 60 * 1000, 'stale-movie', 'movie')

  assert.equal(getFromCache('stale-movie', 'movie'), null)
  assert.equal(getStaleFromCache('stale-movie', 'movie').imageUrl, 'https://image.test/stale.jpg')
})