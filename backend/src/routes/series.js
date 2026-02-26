import { Router } from 'express'
import { db, getMediaWithProviders } from '../db/library.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/tmdbCache.js'
import { getSeries } from '../services/tmdbService.js'

const router = Router()
const VALID_STATUS = ['watchlist', 'watching', 'finished', 'dropped', 'paused']

async function aggregateSeries(series) {
  let tmdb = getFromCache(series.externalId, 'series')
  if (!tmdb) {
    try {
      tmdb = await getSeries(series.externalId)
      saveToCache(tmdb)
    } catch (err) {
      console.error(`TMDB fetch fehlgeschlagen für ${series.externalId}:`, err.message)
      tmdb = null
    }
  }
  return {
    id:                 String(series.id),
    externalId:         series.externalId,
    status:             series.status,
    userRating:         series.userRating ?? null,
    providers:          series.providers ?? [],
    title:              tmdb?.titleEn ?? tmdb?.titleDe ?? series.externalId,
    titleDe:            tmdb?.titleDe ?? null,
    imageUrl:           tmdb?.imageUrl ?? null,
    year:               tmdb?.year ?? null,
    certification:      tmdb?.certification ?? null,
    rating:             tmdb?.rating ?? null,
    runtime:            tmdb?.runtime ?? null,
    seasons:            tmdb?.seasons ?? null,
    episodes:           tmdb?.episodes ?? null,
    genres:             JSON.parse(tmdb?.genres ?? '[]'),
    streamingProviders: JSON.parse(tmdb?.streamingProviders ?? '[]'),
    linkUrl:            tmdb?.linkUrl ?? null,
  }
}

// GET /api/series
router.get('/', async (req, res) => {
  try {
    const raw = db.prepare('SELECT * FROM series').all().map(s => ({
      ...s,
      providers: db.prepare(`SELECT id, provider FROM mediaproviders WHERE mediaId = ? AND mediaType = 'series'`).all(s.id)
    }))
    const result = await Promise.all(raw.map(aggregateSeries))
    result.sort((a, b) => a.title.localeCompare(b.title))
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/series
router.post('/', async (req, res) => {
  const { externalId, status, providers = [] } = req.body
  if (!externalId || !status) return res.status(400).json({ error: 'externalId und status sind Pflichtfelder' })
  if (!VALID_STATUS.includes(status)) return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })
  if (db.prepare('SELECT id FROM series WHERE externalId = ?').get(externalId))
    return res.status(409).json({ error: `Serie mit externalId ${externalId} existiert bereits` })
  try {
    const seriesId = db.transaction(() => {
      const { lastInsertRowid } = db.prepare('INSERT INTO series (externalId, status) VALUES (?, ?)').run(externalId, status)
      for (const p of providers)
        db.prepare(`INSERT INTO mediaproviders (mediaId, mediaType, provider) VALUES (?, 'series', ?)`).run(lastInsertRowid, p)
      return lastInsertRowid
    })()
    res.status(201).json(await aggregateSeries(getMediaWithProviders(seriesId, 'series')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/series/:id  (status und/oder userRating)
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM series WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Serie nicht gefunden' })
  if (req.body.status && !VALID_STATUS.includes(req.body.status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })
  if (req.body.userRating !== undefined && (req.body.userRating < 1 || req.body.userRating > 10))
    return res.status(400).json({ error: 'userRating muss zwischen 1 und 10 liegen' })
  try {
    const status     = req.body.status ?? existing.status
    const userRating = req.body.userRating ?? existing.userRating
    db.prepare('UPDATE series SET status = ?, userRating = ? WHERE id = ?').run(status, userRating, id)
    res.json(await aggregateSeries(getMediaWithProviders(id, 'series')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/series/:id/providers
router.put('/:id/providers', async (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM series WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Serie nicht gefunden' })
  if (!Array.isArray(req.body)) return res.status(400).json({ error: 'providers muss ein Array sein' })
  try {
    db.transaction(() => {
      db.prepare(`DELETE FROM mediaproviders WHERE mediaId = ? AND mediaType = 'series'`).run(id)
      for (const p of req.body)
        db.prepare(`INSERT INTO mediaproviders (mediaId, mediaType, provider) VALUES (?, 'series', ?)`).run(id, p)
    })()
    res.json(await aggregateSeries(getMediaWithProviders(id, 'series')))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/series/:id/cache
router.delete('/:id/cache', (req, res) => {
  const series = db.prepare('SELECT * FROM series WHERE id = ?').get(Number(req.params.id))
  if (!series) return res.status(404).json({ error: 'Serie nicht gefunden' })
  try {
    deleteFromCache(series.externalId, 'series')
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/series/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM series WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Serie nicht gefunden' })
  try {
    db.prepare('DELETE FROM series WHERE id = ?').run(id)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
