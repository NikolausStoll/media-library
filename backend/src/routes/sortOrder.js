import { Router } from 'express'
import { db } from '../db/library.js'

const router = Router()

router.get('/', (_, res) => {
  try {
    res.json(db.prepare('SELECT gameId, position FROM sort_order ORDER BY position').all())
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/', (req, res) => {
  const { order } = req.body
  if (!Array.isArray(order))
    return res.status(400).json({ error: 'order muss ein Array von gameIds sein' })

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM sort_order').run()
      const stmt = db.prepare('INSERT INTO sort_order (gameId, position) VALUES (?, ?)')
      order.forEach((gameId, position) => stmt.run(gameId, position))
    })()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
