import { Router } from 'express'
import { db } from '../db/library.js'

const router = Router()

router.get('/', (_, res) => {
  try {
    res.json(db.prepare('SELECT gameId FROM play_next').all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids) || ids.length > 6)
    return res.status(400).json({ error: 'ids muss ein Array mit max. 6 Einträgen sein' })

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM play_next').run()
      const stmt = db.prepare('INSERT INTO play_next (gameId) VALUES (?)')
      ids.forEach((gameId) => stmt.run(gameId))
    })()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:gameId', (req, res) => {
  try {
    db.prepare('DELETE FROM play_next WHERE gameId = ?').run(Number(req.params.gameId))
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
