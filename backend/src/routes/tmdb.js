import { Router } from 'express'
import { searchMedia, getMovie, getSeries } from '../services/tmdbService.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/tmdbCache.js'

const router = Router()

// GET /api/tmdb/search?q=...&type=movie|series
router.get('/search', async (req, res) => {
  const q = req.query.q?.trim()
  const type = req.query.type === 'series' ? 'series' : 'movie'
  if (!q) return res.status(400).json({ error: 'Parameter ?q fehlt' })
  try {
    res.json(await searchMedia(q, type))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/tmdb/cache/:id?type=movie|series
router.delete('/cache/:id', (req, res) => {
  const type = req.query.type === 'series' ? 'series' : 'movie'
  try {
    deleteFromCache(req.params.id, type)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/tmdb/:id?type=movie|series
router.get('/:id', async (req, res) => {
  const { id } = req.params
  const type = req.query.type === 'series' ? 'series' : 'movie'
  try {
    const cached = getFromCache(id, type)
    if (cached) return res.json({ ...cached, source: 'cache' })
    const item = type === 'movie' ? await getMovie(id) : await getSeries(id)
    saveToCache(item)
    res.json({ ...item, source: 'tmdb' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
