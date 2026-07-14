import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import { createTestApp, withServer, requestJson } from './helpers/http.js'

const testDir = mkdtempSync(join(tmpdir(), 'media-library-test-'))
process.env.DB_PATH = join(testDir, 'test.db')
process.env.UPLOAD_DIR = join(testDir, 'uploads')

const { default: gamesRouter } = await import('../src/routes/games.js')
const { default: nextRouter } = await import('../src/routes/next.js')
const { default: seriesRouter } = await import('../src/routes/series.js')
const { default: moviesRouter } = await import('../src/routes/movies.js')
const { default: booksRouter } = await import('../src/routes/books.js')
const { default: sortRouter } = await import('../src/routes/sortOrder.js')
const { db, mapGameStatusFromDb } = await import('../src/db/library.js')

const app = createTestApp([
  ['/api/games', gamesRouter],
  ['/api/next', nextRouter],
  ['/api/series', seriesRouter],
  ['/api/movies', moviesRouter],
  ['/api/books', booksRouter],
  ['/api/sort-order', sortRouter],
])

test.after(() => {
  db.close()
  rmSync(testDir, { recursive: true, force: true })
})

test('POST /api/games creates backlog game', async () => {
  await withServer(app, async (baseUrl) => {
    const { status, body } = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({
        externalId: 'game-100',
        status: 'backlog',
        platforms: [{ platform: 'switch', storefront: null }],
      }),
    })

    assert.equal(status, 201)
    assert.equal(body.status, 'backlog')
    assert.equal(body.externalId, 'game-100')
    assert.equal(body.platforms.length, 1)
    assert.equal(body.platforms[0].platform, 'switch')
  })
})

test('POST /api/games maps dropped to retired in DB', async () => {
  await withServer(app, async (baseUrl) => {
    const { status, body } = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({ externalId: 'game-drop', status: 'dropped' }),
    })

    assert.equal(status, 201)
    assert.equal(body.status, 'dropped')

    const row = db.prepare('SELECT status FROM games WHERE externalId = ?').get('game-drop')
    assert.equal(row.status, 'retired')
    assert.equal(mapGameStatusFromDb(row.status), 'dropped')
  })
})

test('PUT /api/games/:id/tags validates curated tag set', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({ externalId: 'game-tags', status: 'backlog' }),
    })
    const id = created.body.id

    const invalid = await requestJson(baseUrl, `/api/games/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags: ['rpg'] }),
    })
    assert.equal(invalid.status, 400)

    const valid = await requestJson(baseUrl, `/api/games/${id}/tags`, {
      method: 'PUT',
      body: JSON.stringify({ tags: ['physical', '100%'] }),
    })
    assert.equal(valid.status, 200)
    assert.equal(valid.body.tags.length, 2)
    assert.ok(valid.body.tags.includes('physical'))
    assert.ok(valid.body.tags.includes('100%'))
  })
})

test('PUT /api/next rejects more than 6 items per media type', async () => {
  await withServer(app, async (baseUrl) => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      mediaId: i + 1,
      mediaType: 'game',
    }))

    const { status, body } = await requestJson(baseUrl, '/api/next', {
      method: 'PUT',
      body: JSON.stringify(items),
    })

    assert.equal(status, 400)
    assert.match(body.error, /Maximal 6/)
  })
})

test('PUT /api/next stores and GET returns queue entries', async () => {
  await withServer(app, async (baseUrl) => {
    const put = await requestJson(baseUrl, '/api/next', {
      method: 'PUT',
      body: JSON.stringify([
        { mediaId: 10, mediaType: 'movie' },
        { mediaId: 11, mediaType: 'movie' },
      ]),
    })
    assert.equal(put.status, 200)

    const get = await requestJson(baseUrl, '/api/next?type=movie')
    assert.equal(get.status, 200)
    assert.deepEqual(get.body, [
      { mediaId: 10, mediaType: 'movie' },
      { mediaId: 11, mediaType: 'movie' },
    ])
  })
})

test('series episode progress toggle and season bulk update', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/series', {
      method: 'POST',
      body: JSON.stringify({ externalId: '999', status: 'watching', providers: [] }),
    })
    assert.equal(created.status, 201)
    const seriesId = created.body.id

    const watched = await requestJson(baseUrl, `/api/series/${seriesId}/progress/toggle`, {
      method: 'POST',
      body: JSON.stringify({ season: 1, episode: 1 }),
    })
    assert.equal(watched.status, 200)
    assert.equal(watched.body.watched, true)

    const progress = await requestJson(baseUrl, `/api/series/${seriesId}/progress`)
    assert.equal(progress.status, 200)
    assert.equal(progress.body.length, 1)

    const season = await requestJson(baseUrl, `/api/series/${seriesId}/progress/season/1`, {
      method: 'PUT',
      body: JSON.stringify({ episodes: [1, 2], watched: true }),
    })
    assert.equal(season.status, 200)
    assert.equal(season.body.length, 2)

    const cleared = await requestJson(baseUrl, `/api/series/${seriesId}/progress/season/1`, {
      method: 'PUT',
      body: JSON.stringify({ episodes: [1, 2], watched: false }),
    })
    assert.equal(cleared.status, 200)
    assert.equal(cleared.body.length, 0)
  })
})

test('POST /api/movies creates watchlist movie and rejects invalid status', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/movies', {
      method: 'POST',
      body: JSON.stringify({ externalId: '550', status: 'watchlist', providers: [] }),
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.status, 'watchlist')
    assert.equal(created.body.externalId, '550')

    const invalid = await requestJson(baseUrl, '/api/movies', {
      method: 'POST',
      body: JSON.stringify({ externalId: '551', status: 'paused', providers: [] }),
    })
    assert.equal(invalid.status, 400)
  })
})

test('PUT /api/movies/:id updates status to finished', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/movies', {
      method: 'POST',
      body: JSON.stringify({ externalId: '552', status: 'watchlist', providers: [] }),
    })
    const id = created.body.id

    const updated = await requestJson(baseUrl, `/api/movies/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'finished' }),
    })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.status, 'finished')
    assert.ok(updated.body.completedAt)
  })
})

test('POST /api/books creates library book and validates formats', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/books', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Test Book',
        status: 'backlog',
        formats: [{ format: 'paperback' }],
        authors: ['Author'],
      }),
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.title, 'Test Book')
    assert.equal(created.body.status, 'backlog')

    const invalid = await requestJson(baseUrl, '/api/books', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Bad Book',
        status: 'backlog',
        formats: [{ format: 'scroll' }],
      }),
    })
    assert.equal(invalid.status, 400)
  })
})

test('POST and PUT /api/books persist alternateTitle', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/books', {
      method: 'POST',
      body: JSON.stringify({
        title: 'Das Spiel des Löwen',
        alternateTitle: "The Lion's Game",
        status: 'backlog',
        formats: [{ format: 'paperback' }],
        authors: ['Nelson DeMille'],
      }),
    })
    assert.equal(created.status, 201)
    assert.equal(created.body.alternateTitle, "The Lion's Game")

    const updated = await requestJson(baseUrl, `/api/books/${created.body.id}`, {
      method: 'PUT',
      body: JSON.stringify({ alternateTitle: 'Lions Game' }),
    })
    assert.equal(updated.status, 200)
    assert.equal(updated.body.alternateTitle, 'Lions Game')
  })
})

test('PUT /api/sort-order persists drag order for started games', async () => {
  await withServer(app, async (baseUrl) => {
    const gameA = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({ externalId: 'sort-a', status: 'started' }),
    })
    const gameB = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({ externalId: 'sort-b', status: 'started' }),
    })

    const put = await requestJson(baseUrl, '/api/sort-order', {
      method: 'PUT',
      body: JSON.stringify({ order: [Number(gameB.body.id), Number(gameA.body.id)] }),
    })
    assert.equal(put.status, 200)

    const get = await requestJson(baseUrl, '/api/sort-order')
    assert.equal(get.status, 200)
    assert.deepEqual(get.body, [
      { gameId: Number(gameB.body.id), position: 0 },
      { gameId: Number(gameA.body.id), position: 1 },
    ])
  })
})

test('PUT /api/games/:id rejects invalid userRating', async () => {
  await withServer(app, async (baseUrl) => {
    const created = await requestJson(baseUrl, '/api/games', {
      method: 'POST',
      body: JSON.stringify({ externalId: 'rating-game', status: 'backlog' }),
    })

    const invalid = await requestJson(baseUrl, `/api/games/${created.body.id}`, {
      method: 'PUT',
      body: JSON.stringify({ userRating: 11 }),
    })
    assert.equal(invalid.status, 400)
  })
})
