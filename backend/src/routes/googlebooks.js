import { Router } from 'express'
import { searchBooks, getBook } from '../services/googleBooksService.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/googleBooksCache.js'

const router = Router()

router.get('/search', async (req, res) => {
  const q = req.query.q
  if (!q || q.trim().length < 2)
    return res.status(400).json({ error: 'Suchbegriff muss mind. 2 Zeichen lang sein' })

  try {
    const results = await searchBooks(q.trim())
    for (const book of results) {
      try { saveToCache(book) } catch {}
    }
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  const id = req.params.id
  try {
    let book = getFromCache(id)
    if (!book) {
      book = await getBook(id)
      saveToCache(book)
    }
    res.json(book)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/cache/:id', (req, res) => {
  try {
    deleteFromCache(req.params.id)
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
