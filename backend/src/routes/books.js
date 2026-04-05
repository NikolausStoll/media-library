import { Router } from 'express'
import { db, getBookWithFormats } from '../db/library.js'
import { getFromCache, saveToCache, deleteFromCache } from '../services/googleBooksCache.js'
import { getBook as fetchFromGoogle } from '../services/googleBooksService.js'

const router = Router()
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BOOK_COMPLETION_STATUSES = new Set(['completed'])

function normalizeDateInput(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (!DATE_REGEX.test(value))
    throw new Error('completedAt muss im Format YYYY-MM-DD vorliegen')
  return value
}

function resolveCompletedAt(existing, requested, status, today) {
  if (requested !== undefined) return requested
  if (existing) return existing
  if (BOOK_COMPLETION_STATUSES.has(status)) return today
  return existing
}

async function aggregateBook(book) {
  let gbooks = getFromCache(book.externalId)

  if (!gbooks) {
    try {
      gbooks = await fetchFromGoogle(book.externalId)
      saveToCache(gbooks)
    } catch (err) {
      console.error(`Google Books fetch fehlgeschlagen für ${book.externalId}:`, err.message)
      gbooks = null
    }
  }

  return {
    id: String(book.id),
    externalId: book.externalId,
    title: gbooks?.title ?? book.externalId,
    authors: gbooks?.authors ?? [],
    description: gbooks?.description ?? null,
    imageUrl: gbooks?.imageUrl ?? null,
    pageCount: gbooks?.pageCount ?? null,
    publishedDate: gbooks?.publishedDate ?? null,
    categories: gbooks?.categories ?? [],
    rating: gbooks?.olRating ?? gbooks?.rating ?? null,
    ratingsCount: gbooks?.olRatingsCount ?? gbooks?.ratingsCount ?? null,
    seriesName: gbooks?.seriesName ?? null,
    seriesPosition: gbooks?.seriesPosition ?? null,
    publisher: gbooks?.publisher ?? null,
    isbn: gbooks?.isbn ?? null,
    language: gbooks?.language ?? null,
    linkUrl: gbooks?.linkUrl ?? null,
    status: book.status,
    formats: book.formats ?? [],
    userRating: book.userRating != null ? book.userRating : null,
    completedAt: book.completedAt ?? null,
    lastTouched: book.lastTouched ?? null,
  }
}

router.get('/', async (req, res) => {
  try {
    const rawBooks = db.prepare('SELECT * FROM books').all().map((b) => ({
      ...b,
      formats: db
        .prepare('SELECT id, format FROM bookformats WHERE bookId = ?')
        .all(b.id),
    }))

    const aggregated = await Promise.all(rawBooks.map(aggregateBook))
    aggregated.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    res.json(aggregated)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id/cache', (req, res) => {
  const id = Number(req.params.id)
  const book = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!book) return res.status(404).json({ error: 'Buch nicht gefunden' })

  try {
    deleteFromCache(book.externalId)
    res.json({ success: true, message: `Cache für ${book.externalId} invalidiert` })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const book = getBookWithFormats(Number(req.params.id))
    if (!book) return res.status(404).json({ error: 'Buch nicht gefunden' })
    res.json(await aggregateBook(book))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { externalId, status, formats = [] } = req.body

  if (!externalId || !status)
    return res.status(400).json({ error: 'externalId und status sind Pflichtfelder' })

  const VALID = ['wishlist', 'backlog', 'started', 'completed', 'shelved']
  if (!VALID.includes(status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID.join(', ')}` })

  const existing = db.prepare('SELECT id FROM books WHERE externalId = ?').get(externalId)
  if (existing)
    return res.status(409).json({ error: `Buch mit externalId ${externalId} existiert bereits` })

  try {
    const today = new Date().toISOString().slice(0, 10)
    const completedAt = BOOK_COMPLETION_STATUSES.has(status) ? today : null
    const bookId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          'INSERT INTO books (externalId, status, completedAt, lastTouched) VALUES (?, ?, ?, ?)',
        )
        .run(externalId, status, completedAt, today)

      for (const f of formats) {
        db.prepare('INSERT INTO bookformats (bookId, format) VALUES (?, ?)')
          .run(lastInsertRowid, f.format ?? f)
      }
      return lastInsertRowid
    })()

    res.status(201).json(await aggregateBook(getBookWithFormats(bookId)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Buch nicht gefunden' })

  const VALID = ['wishlist', 'backlog', 'started', 'completed', 'shelved']
  if (req.body.status && !VALID.includes(req.body.status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID.join(', ')}` })

  if (req.body.userRating !== undefined && req.body.userRating != null && (req.body.userRating < 1 || req.body.userRating > 10))
    return res.status(400).json({ error: 'userRating muss zwischen 1 und 10 liegen' })

  const merged = {
    externalId: req.body.externalId ?? existing.externalId,
    status: req.body.status ?? existing.status,
    userRating: req.body.userRating !== undefined ? req.body.userRating : existing.userRating,
  }

  let requestedCompletedAt
  try {
    requestedCompletedAt = normalizeDateInput(req.body.completedAt)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  const today = new Date().toISOString().slice(0, 10)
  const completedAt = resolveCompletedAt(
    existing.completedAt,
    requestedCompletedAt,
    merged.status,
    today,
  )

  try {
    db.prepare('UPDATE books SET externalId=?, status=?, userRating=?, completedAt=?, lastTouched=? WHERE id=?')
      .run(merged.externalId, merged.status, merged.userRating, completedAt, today, id)
    res.json(await aggregateBook(getBookWithFormats(id)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id/formats', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Buch nicht gefunden' })

  const { formats } = req.body
  if (!Array.isArray(formats))
    return res.status(400).json({ error: 'formats muss ein Array sein' })

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM bookformats WHERE bookId = ?').run(id)
      for (const f of formats) {
        db.prepare('INSERT INTO bookformats (bookId, format) VALUES (?, ?)')
          .run(id, f.format ?? f)
      }
    })()
    const today = new Date().toISOString().slice(0, 10)
    db.prepare('UPDATE books SET lastTouched = ? WHERE id = ?').run(today, id)
    res.json(await aggregateBook(getBookWithFormats(id)))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Buch nicht gefunden' })

  try {
    db.prepare('DELETE FROM books WHERE id = ?').run(id)
    res.status(204).send()
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
