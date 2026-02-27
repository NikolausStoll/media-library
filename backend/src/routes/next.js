import { Router } from 'express'
import { db } from '../db/library.js'

const router = Router()
const VALID_TYPES = ['game', 'movie', 'series']

// GET /api/next?type=game|movie|series
router.get('/', (req, res) => {
  try {
    const type = req.query.type
    const query = type && VALID_TYPES.includes(type)
      ? db.prepare('SELECT mediaId, mediaType FROM next WHERE mediaType = ?').all(type)
      : db.prepare('SELECT mediaId, mediaType FROM next').all()
    res.json(query)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/next  – body: [{ mediaId, mediaType }, ...]  max 6 pro Typ
router.put('/', (req, res) => {
  const items = req.body
  if (!Array.isArray(items)) return res.status(400).json({ error: 'Body muss ein Array sein' })
  const invalid = items.filter(i => !VALID_TYPES.includes(i.mediaType))
  if (invalid.length) return res.status(400).json({ error: `Ungültiger mediaType. Erlaubt: ${VALID_TYPES.join(', ')}` })

  // Max 6 pro mediaType prüfen
  for (const type of VALID_TYPES) {
    if (items.filter(i => i.mediaType === type).length > 6)
      return res.status(400).json({ error: `Maximal 6 Einträge pro Typ (${type})` })
  }

  try {
    db.transaction(() => {
      // Nur die betroffenen Typen ersetzen
      const types = [...new Set(items.map(i => i.mediaType))]
      for (const type of types)
        db.prepare('DELETE FROM next WHERE mediaType = ?').run(type)
      const stmt = db.prepare('INSERT INTO next (mediaId, mediaType) VALUES (?, ?)')
      for (const { mediaId, mediaType } of items)
        stmt.run(mediaId, mediaType)
    })()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// DELETE /api/next/:mediaId?type=game|movie|series
router.delete('/:mediaId', (req, res) => {
  const mediaId = Number(req.params.mediaId)
  const type = req.query.type
  if (!type || !VALID_TYPES.includes(type))
    return res.status(400).json({ error: `?type fehlt oder ungültig. Erlaubt: ${VALID_TYPES.join(', ')}` })
  try {
    db.prepare('DELETE FROM next WHERE mediaId = ? AND mediaType = ?').run(mediaId, type)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
