import { Router } from 'express'
import { db, getMediaWithProviders } from '../db/library.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/tmdbCache.js'
import { getMovie } from '../services/tmdbService.js'

const router = Router()
const VALID_STATUS = ['watchlist', 'watching', 'finished']

async function aggregateMovie(movie) {
  let tmdb = getFromCache(movie.externalId, 'movie')
  if (!tmdb) {
    try {
      tmdb = await getMovie(movie.externalId)
      saveToCache(tmdb)
    } catch (err) {
      console.error(`TMDB fetch fehlgeschlagen für ${movie.externalId}:`, err.message)
      tmdb = null
    }
  }
  return {
    id:           String(movie.id),
    externalId:   movie.externalId,
    status:       movie.status,
    userRating:   movie.userRating ?? null,
    providers:    movie.providers ?? [],
    title:        tmdb?.titleEn ?? tmdb?.titleDe ?? movie.externalId,
    titleDe:      tmdb?.titleDe ?? null,
    imageUrl:     tmdb?.imageUrl ?? null,
    year:         tmdb?.year ?? null,
    certification: tmdb?.certification ?? null,
    rating:       tmdb?.rating ?? null,
    runtime:      tmdb?.runtime ?? null,
    genres:       JSON.parse(tmdb?.genres ?? '[]'),
    linkUrl:      tmdb?.linkUrl ?? null,
  }
}

// GET /api/movies
router.get('/', async (req, res) => {
  try {
    const raw = db.prepare('SELECT * FROM movies').all().map(m => ({
      ...m,
      providers: db.prepare(`SELECT id, provider FROM mediaproviders WHERE mediaId = ? AND mediaType = 'movie'`).all(m.id)
    }))
    const result = await Promise.all(raw.map(aggregateMovie))
    result.sort((a, b) => a.title.localeCompare(b.title))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/movies
router.post('/', async (req, res) => {
  const { externalId, status, providers = [] } = req.body
  if (!externalId || !status) return res.status(400).json({ error: 'externalId und status sind Pflichtfelder' })
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })
  if (db.prepare('SELECT id FROM movies WHERE externalId = ?').get(externalId))
    return res.status(409).json({ error: `Film mit externalId ${externalId} existiert bereits` })
  try {
    const movieId = db.transaction(() => {
      const { lastInsertRowid } = db.prepare('INSERT INTO movies (externalId, status) VALUES (?, ?)').run(externalId, status)
      for (const p of providers)
        db.prepare(`INSERT INTO mediaproviders (mediaId, mediaType, provider) VALUES (?, 'movie', ?)`).run(lastInsertRowid, p)
      return lastInsertRowid
    })()
    res.status(201).json(await aggregateMovie(getMediaWithProviders(movieId, 'movie')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/movies/:id  (status und/oder userRating)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM movies WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Film nicht gefunden' })
  if (req.body.status && !VALID_STATUS.includes(req.body.status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })
  if (req.body.userRating !== undefined && (req.body.userRating < 1 || req.body.userRating > 10))
    return res.status(400).json({ error: 'userRating muss zwischen 1 und 10 liegen' })
  try {
    const status     = req.body.status ?? existing.status
    const userRating = req.body.userRating ?? existing.userRating
    db.prepare('UPDATE movies SET status = ?, userRating = ? WHERE id = ?').run(status, userRating, id)
    res.json(await aggregateMovie(getMediaWithProviders(id, 'movie')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/movies/:id/providers
router.put('/:id/providers', async (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM movies WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Film nicht gefunden' })
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'providers muss ein Array sein' })
  try {
    db.transaction(() => {
      db.prepare(`DELETE FROM mediaproviders WHERE mediaId = ? AND mediaType = 'movie'`).run(id)
      for (const p of req.body)
        db.prepare(`INSERT INTO mediaproviders (mediaId, mediaType, provider) VALUES (?, 'movie', ?)`).run(id, p)
    })()
    res.json(await aggregateMovie(getMediaWithProviders(id, 'movie')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/movies/:id/cache
router.delete('/:id/cache', (req, res) => {
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(Number(req.params.id))
  if (!movie) return res.status(404).json({ error: 'Film nicht gefunden' })
  try {
    deleteFromCache(movie.externalId, 'movie')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/movies/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM movies WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Film nicht gefunden' })
  try {
    db.prepare('DELETE FROM movies WHERE id = ?').run(id)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
