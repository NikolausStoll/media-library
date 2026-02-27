import { Router } from 'express'
import { db, getMediaWithProviders } from '../db/library.js'
import { getFromCache, saveToCache, getEpisodesFromCache, saveEpisodesToCache, deleteFromCache, updateSeriesRuntimeInCache } from '../services/tmdbCache.js'
import { getSeries, fetchEpisodes } from '../services/tmdbService.js'

const router = Router()
const VALID_STATUS = ['watchlist', 'watching', 'finished', 'dropped', 'paused']

function computeRuntimeFromEpisodes(episodes) {
  const runtimes = (episodes || []).map(e => e.runtime).filter(r => r != null && r > 0)
  if (runtimes.length === 0) return null
  const freq = new Map()
  for (const r of runtimes) freq.set(r, (freq.get(r) || 0) + 1)
  let maxCount = 0
  let mode = null
  for (const [r, c] of freq) {
    if (c > maxCount) { maxCount = c; mode = r }
  }
  if (mode != null) return mode
  const sorted = [...runtimes].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2)
  return median
}

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
  let runtime = tmdb?.runtime ?? null
  if (runtime == null) {
    const cachedEpisodes = getEpisodesFromCache(series.externalId)
    const computed = computeRuntimeFromEpisodes(cachedEpisodes)
    if (computed != null) {
      runtime = computed
      updateSeriesRuntimeInCache(series.externalId, runtime)
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
    runtime,
    seasons:            tmdb?.seasons ?? null,
    episodes:           tmdb?.episodes ?? null,
    seasonCount:        tmdb?.seasons ?? null,
    episodeCount:       tmdb?.episodes ?? null,
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

// GET /api/series/progress-summary  (watched count pro Serie, für Karten-Anzeige)
router.get('/progress-summary', (req, res) => {
  try {
    const rows = db.prepare(
      'SELECT seriesId, COUNT(*) AS watched FROM episodeprogress GROUP BY seriesId'
    ).all()
    const summary = {}
    for (const r of rows) summary[String(r.seriesId)] = r.watched
    res.json(summary)
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
    const row = getMediaWithProviders(seriesId, 'series')
    const result = await aggregateSeries(row)
    const seasonCount = result.seasonCount ?? result.seasons ?? 1
    let episodes = getEpisodesFromCache(externalId)
    if (!episodes?.length) {
      try {
        episodes = await fetchEpisodes(externalId, seasonCount)
        saveEpisodesToCache(externalId, episodes)
        if (result.runtime == null) {
          const computed = computeRuntimeFromEpisodes(episodes)
          if (computed != null) {
            updateSeriesRuntimeInCache(externalId, computed)
            result.runtime = computed
          }
        }
      } catch (err) {
        console.error(`Episoden-Fetch für neue Serie ${externalId}:`, err.message)
      }
    }
    res.status(201).json(result)
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

// GET /api/series/:id/episodes
router.get('/:id/episodes', async (req, res) => {
  const id = Number(req.params.id)
  const series = db.prepare('SELECT * FROM series WHERE id = ?').get(id)
  if (!series) return res.status(404).json({ error: 'Serie nicht gefunden' })
  try {
    let episodes = getEpisodesFromCache(series.externalId)
    if (!episodes) {
      const tmdb = getFromCache(series.externalId, 'series')
      const seasonCount = tmdb?.seasons ?? 1
      episodes = await fetchEpisodes(series.externalId, seasonCount)
      saveEpisodesToCache(series.externalId, episodes)
    }
    res.json(episodes)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/series/:id/progress
router.get('/:id/progress', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM series WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Serie nicht gefunden' })
  try {
    const rows = db.prepare(
      'SELECT season, episode, watchedAt FROM episodeprogress WHERE seriesId = ? ORDER BY season, episode'
    ).all(id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/series/:id/progress/toggle
router.post('/:id/progress/toggle', (req, res) => {
  const id = Number(req.params.id)
  if (!db.prepare('SELECT id FROM series WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Serie nicht gefunden' })
  const { season, episode } = req.body
  if (!season || !episode) return res.status(400).json({ error: 'season und episode sind Pflichtfelder' })
  try {
    const existing = db.prepare(
      'SELECT id FROM episodeprogress WHERE seriesId = ? AND season = ? AND episode = ?'
    ).get(id, season, episode)
    if (existing) {
      db.prepare('DELETE FROM episodeprogress WHERE id = ?').run(existing.id)
      return res.json({ watched: false, season, episode })
    } else {
      db.prepare(
        'INSERT INTO episodeprogress (seriesId, season, episode, watchedAt) VALUES (?, ?, ?, ?)'
      ).run(id, season, episode, Date.now())
      return res.json({ watched: true, season, episode })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/series/:id/progress/season/:season
router.put('/:id/progress/season/:season', (req, res) => {
  const id     = Number(req.params.id)
  const season = Number(req.params.season)
  if (!db.prepare('SELECT id FROM series WHERE id = ?').get(id))
    return res.status(404).json({ error: 'Serie nicht gefunden' })
  const { episodes, watched } = req.body
  if (!Array.isArray(episodes)) return res.status(400).json({ error: 'episodes Array nötig' })
  try {
    db.transaction(() => {
      if (watched) {
        const insert = db.prepare(
          'INSERT OR IGNORE INTO episodeprogress (seriesId, season, episode, watchedAt) VALUES (?, ?, ?, ?)'
        )
        for (const ep of episodes) insert.run(id, season, ep, Date.now())
      } else {
        db.prepare('DELETE FROM episodeprogress WHERE seriesId = ? AND season = ?').run(id, season)
      }
    })()
    const rows = db.prepare(
      'SELECT season, episode, watchedAt FROM episodeprogress WHERE seriesId = ? ORDER BY season, episode'
    ).all(id)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
