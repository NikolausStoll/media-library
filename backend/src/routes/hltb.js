import { Router } from 'express'
import { searchGames, getGame } from '../services/hltbService.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/hltbCache.js'

const router = Router()

router.get('/search', async (req, res) => {
  const q = req.query.q?.trim()
  if (!q) return res.status(400).json({ error: 'Parameter ?q= fehlt' })

  try {
    const results = await searchGames(q)
    res.json(results)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

router.delete('/cache/:id', (req, res) => {
  try {
    deleteFromCache(req.params.id)
    res.json({ success: true, message: `Cache für ID ${req.params.id} gelöscht` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const cached = getFromCache(id)
    if (cached) {
      console.log(`Cache hit für ID ${id}`)
      return res.json({ ...cached, _source: 'cache' })
    }

    console.log(`Fetching HLTB für ID ${id}`)
    const game = await getGame(id)
    saveToCache(game)

    res.json({ ...game, _source: 'hltb' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

export default router
