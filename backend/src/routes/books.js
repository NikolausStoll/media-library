import { Router } from 'express'
import { randomUUID } from 'crypto'
import { mkdirSync } from 'fs'
import { dirname, join } from 'path'
import fetch from 'node-fetch'
import sharp from 'sharp'
import { db, getBookWithFormats } from '../db/library.js'
import { prepareBookDraft } from '../services/bookPreparationService.js'
import { getEditionCandidatesForWork, searchBookDraftCandidates } from '../services/openLibraryService.js'
import { normalizeBookPublishedDate } from '../utils/bookDate.js'

const router = Router()
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const BOOK_COMPLETION_STATUSES = new Set(['completed'])
const VALID_STATUS = ['wishlist', 'backlog', 'started', 'completed', 'shelved']
const VALID_FORMATS = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other']
const dbPath = process.env.DB_PATH ?? join(process.cwd(), 'backend.db')
const uploadsRoot = process.env.UPLOAD_DIR ?? join(dirname(dbPath), 'uploads')
const bookUploadsDir = join(uploadsRoot, 'books')
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY ?? '80', 10)
const IMAGE_MAX_DIMENSION = parseInt(process.env.IMAGE_MAX_DIMENSION ?? '1200', 10)
const IMAGE_QUALITY_THUMB = parseInt(process.env.IMAGE_QUALITY_THUMB ?? '80', 10)
const IMAGE_MAX_DIMENSION_THUMB = parseInt(process.env.IMAGE_MAX_DIMENSION_THUMB ?? '600', 10)

function parseJsonArray(value) {
  if (Array.isArray(value)) return value
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeAuthors(value) {
  if (Array.isArray(value)) return value.map(v => String(v).trim()).filter(Boolean)
  if (typeof value === 'string')
    return value.split(/[,;\n]+/).map(v => v.trim()).filter(Boolean)
  return []
}

function normalizeOptionalString(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  const str = String(value).trim()
  return str ? str : null
}

function normalizeOptionalNumber(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeFormat(format) {
  const normalized = String(format ?? '').trim().toLowerCase()
  return normalized === 'kindle' ? 'ebook' : normalized
}

function normalizeFormats(formats) {
  return Array.from(
    new Set(
      formats
        .map(f => normalizeFormat(f.format ?? f))
        .filter(Boolean),
    ),
  )
}

function assertValidFormats(formats) {
  const invalidFormats = formats.filter(f => !VALID_FORMATS.includes(f))
  if (invalidFormats.length)
    throw new Error(`Ungültige Formate: ${invalidFormats.join(', ')}`)
}

async function saveCoverFromBuffer(bytes, contentType = '') {
  if (!bytes.length) throw new Error('Cover-Bild ist leer')
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Cover-Bild ist zu groß')
  if (contentType && !contentType.startsWith('image/'))
    throw new Error('Cover-Datei ist kein Bild')

  mkdirSync(bookUploadsDir, { recursive: true })
  const id = randomUUID()
  const originalFilename = `${id}.webp`
  const thumbFilename = `${id}-thumb.webp`
  const metadata = await sharp(bytes).metadata()
  const maxSourceDimension = Math.max(metadata.width ?? 0, metadata.height ?? 0)

  await sharp(bytes)
    .rotate()
    .resize({
      width: IMAGE_MAX_DIMENSION,
      height: IMAGE_MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_QUALITY })
    .toFile(join(bookUploadsDir, originalFilename))

  if (maxSourceDimension > 0 && maxSourceDimension <= IMAGE_MAX_DIMENSION_THUMB) {
    return {
      coverPath: `/uploads/books/${originalFilename}`,
      coverThumbPath: `/uploads/books/${originalFilename}`,
    }
  }

  await sharp(bytes)
    .rotate()
    .resize({
      width: IMAGE_MAX_DIMENSION_THUMB,
      height: IMAGE_MAX_DIMENSION_THUMB,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: IMAGE_QUALITY_THUMB })
    .toFile(join(bookUploadsDir, thumbFilename))

  return {
    coverPath: `/uploads/books/${originalFilename}`,
    coverThumbPath: `/uploads/books/${thumbFilename}`,
  }
}

async function saveCoverFromDataUrl(value) {
  const dataUrl = typeof value === 'string' ? value : value?.dataUrl
  const normalized = normalizeOptionalString(dataUrl)
  if (!normalized) return null

  const match = normalized.match(/^data:([^;,]+)?(;base64)?,(.*)$/s)
  if (!match) throw new Error('Cover-Datei muss als Data-URL übertragen werden')
  if (!match[2]) throw new Error('Cover-Datei muss Base64-kodiert sein')

  const contentType = match[1] ?? ''
  const bytes = Buffer.from(match[3], 'base64')
  return saveCoverFromBuffer(bytes, contentType)
}

async function saveCoverFromUrl(url) {
  const normalized = normalizeOptionalString(url)
  if (!normalized) return null
  const parsed = new URL(normalized)
  if (!['http:', 'https:'].includes(parsed.protocol))
    throw new Error('coverUrl muss eine HTTP(S)-URL sein')

  const res = await fetch(normalized)
  if (!res.ok) throw new Error(`Cover konnte nicht geladen werden: HTTP ${res.status}`)

  const contentType = res.headers.get('content-type') ?? ''
  if (contentType && !contentType.startsWith('image/'))
    throw new Error('coverUrl verweist nicht auf ein Bild')

  const bytes = Buffer.from(await res.arrayBuffer())
  return saveCoverFromBuffer(bytes, contentType)
}

async function resolveSavedCover(body, existing = {}) {
  if (body.coverFile || body.coverFileData) {
    return saveCoverFromDataUrl(body.coverFile ?? body.coverFileData)
  }

  if (body.coverUrl) {
    return saveCoverFromUrl(body.coverUrl)
  }

  return {
    coverPath: body.coverPath !== undefined ? normalizeOptionalString(body.coverPath) : existing.coverPath ?? null,
    coverThumbPath: body.coverThumbPath !== undefined ? normalizeOptionalString(body.coverThumbPath) : existing.coverThumbPath ?? null,
  }
}

function normalizeDateInput(value) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (!DATE_REGEX.test(value))
    throw new Error('completedAt muss im Format YYYY-MM-DD vorliegen')
  return value
}

function errorStatus(err) {
  return err.message?.includes('publishedDate') ? 400 : 500
}

function resolveCompletedAt(existing, requested, status, today) {
  if (requested !== undefined) return requested
  if (existing) return existing
  if (BOOK_COMPLETION_STATUSES.has(status)) return today
  return existing
}

async function aggregateBook(book) {
  return {
    id: String(book.id),
    title: book.title ?? '',
    authors: parseJsonArray(book.authors),
    description: book.description ?? null,
    imageUrl: book.coverThumbPath ?? book.coverPath ?? book.imageUrl ?? null,
    coverPath: book.coverPath ?? null,
    coverThumbPath: book.coverThumbPath ?? null,
    pageCount: book.pageCount ?? null,
    publishedDate: normalizeBookPublishedDate(book.publishedDate) ?? book.publishedDate ?? null,
    categories: [],
    rating: null,
    ratingsCount: null,
    seriesName: book.seriesName ?? null,
    seriesPosition: book.seriesPosition ?? null,
    publisher: book.publisher ?? null,
    isbn: book.isbn ?? null,
    language: book.language ?? null,
    linkUrl: book.sourceUrl ?? null,
    sourceName: book.sourceName ?? null,
    sourceUrl: book.sourceUrl ?? null,
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
    res.status(errorStatus(err)).json({ error: err.message })
  }
})

router.post('/prepare', async (req, res) => {
  const isbn = normalizeOptionalString(req.body?.isbn)
  if (!isbn) return res.status(400).json({ error: 'isbn ist ein Pflichtfeld' })

  try {
    const result = await prepareBookDraft({
      isbn,
      languageHint: normalizeOptionalString(req.body?.languageHint),
    })
    res.json(result)
  } catch (err) {
    const status = err.message?.includes('ISBN') || err.message?.includes('isbn') ? 400 : 500
    res.status(status).json({ error: err.message })
  }
})

router.get('/search', async (req, res) => {
  const query = normalizeOptionalString(req.query?.q)
  if (!query) return res.status(400).json({ error: 'q ist ein Pflichtfeld' })

  try {
    const results = await searchBookDraftCandidates(query, {
      language: normalizeOptionalString(req.query?.language),
      sort: normalizeOptionalString(req.query?.sort),
    })
    res.json(results)
  } catch (err) {
    const status = err.message?.includes('query') ? 400 : 500
    res.status(status).json({ error: err.message })
  }
})

router.get('/editions', async (req, res) => {
  const workKey = normalizeOptionalString(req.query?.workKey)
  if (!workKey) return res.status(400).json({ error: 'workKey ist ein Pflichtfeld' })

  try {
    const results = await getEditionCandidatesForWork(workKey, {
      language: normalizeOptionalString(req.query?.language),
      format: normalizeOptionalString(req.query?.format),
      sort: normalizeOptionalString(req.query?.sort),
    })
    res.json(results)
  } catch (err) {
    const status = err.message?.includes('workKey') ? 400 : 500
    res.status(status).json({ error: err.message })
  }
})

router.get('/:id', async (req, res) => {
  try {
    const book = getBookWithFormats(Number(req.params.id))
    if (!book) return res.status(404).json({ error: 'Buch nicht gefunden' })
    res.json(await aggregateBook(book))
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { status, formats = [] } = req.body
  const normalizedFormats = normalizeFormats(formats)

  if (!status)
    return res.status(400).json({ error: 'status ist ein Pflichtfeld' })

  if (!VALID_STATUS.includes(status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })

  const title = normalizeOptionalString(req.body.title)
  if (!title)
    return res.status(400).json({ error: 'title ist ein Pflichtfeld' })

  try {
    assertValidFormats(normalizedFormats)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const completedAt = BOOK_COMPLETION_STATUSES.has(status) ? today : null
    const publishedDate = normalizeBookPublishedDate(req.body.publishedDate, { strict: true })
    const savedCover = await resolveSavedCover(req.body)
    const bookId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO books (
            title, authors, description, imageUrl, coverPath, coverThumbPath, pageCount,
            publishedDate, seriesName, seriesPosition, publisher, isbn, language,
            sourceName, sourceUrl, status, completedAt, lastTouched
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          title,
          JSON.stringify(normalizeAuthors(req.body.authors)),
          normalizeOptionalString(req.body.description),
          normalizeOptionalString(req.body.imageUrl),
          savedCover.coverPath,
          savedCover.coverThumbPath,
          normalizeOptionalNumber(req.body.pageCount),
          publishedDate,
          normalizeOptionalString(req.body.seriesName),
          normalizeOptionalString(req.body.seriesPosition),
          normalizeOptionalString(req.body.publisher),
          normalizeOptionalString(req.body.isbn),
          normalizeOptionalString(req.body.language),
          normalizeOptionalString(req.body.sourceName),
          normalizeOptionalString(req.body.sourceUrl),
          status,
          completedAt,
          today,
        )

      for (const f of normalizedFormats) {
        db.prepare('INSERT INTO bookformats (bookId, format) VALUES (?, ?)')
          .run(lastInsertRowid, f)
      }
      return lastInsertRowid
    })()

    res.status(201).json(await aggregateBook(getBookWithFormats(bookId)))
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Buch nicht gefunden' })

  if (req.body.status && !VALID_STATUS.includes(req.body.status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID_STATUS.join(', ')}` })

  if (req.body.userRating !== undefined && req.body.userRating != null && (req.body.userRating < 1 || req.body.userRating > 10))
    return res.status(400).json({ error: 'userRating muss zwischen 1 und 10 liegen' })

  const merged = {
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
    const publishedDate = req.body.publishedDate !== undefined
      ? normalizeBookPublishedDate(req.body.publishedDate, { strict: true })
      : existing.publishedDate
    const savedCover = await resolveSavedCover(req.body, existing)

    db.prepare(`
      UPDATE books SET
        title = ?,
        authors = ?,
        description = ?,
        imageUrl = ?,
        coverPath = ?,
        coverThumbPath = ?,
        pageCount = ?,
        publishedDate = ?,
        seriesName = ?,
        seriesPosition = ?,
        publisher = ?,
        isbn = ?,
        language = ?,
        sourceName = ?,
        sourceUrl = ?,
        status = ?,
        userRating = ?,
        completedAt = ?,
        lastTouched = ?
      WHERE id = ?
    `).run(
      req.body.title !== undefined ? normalizeOptionalString(req.body.title) : existing.title,
      req.body.authors !== undefined ? JSON.stringify(normalizeAuthors(req.body.authors)) : existing.authors,
      req.body.description !== undefined ? normalizeOptionalString(req.body.description) : existing.description,
      req.body.imageUrl !== undefined ? normalizeOptionalString(req.body.imageUrl) : existing.imageUrl,
      savedCover.coverPath,
      savedCover.coverThumbPath,
      req.body.pageCount !== undefined ? normalizeOptionalNumber(req.body.pageCount) : existing.pageCount,
      publishedDate,
      req.body.seriesName !== undefined ? normalizeOptionalString(req.body.seriesName) : existing.seriesName,
      req.body.seriesPosition !== undefined ? normalizeOptionalString(req.body.seriesPosition) : existing.seriesPosition,
      req.body.publisher !== undefined ? normalizeOptionalString(req.body.publisher) : existing.publisher,
      req.body.isbn !== undefined ? normalizeOptionalString(req.body.isbn) : existing.isbn,
      req.body.language !== undefined ? normalizeOptionalString(req.body.language) : existing.language,
      req.body.sourceName !== undefined ? normalizeOptionalString(req.body.sourceName) : existing.sourceName,
      req.body.sourceUrl !== undefined ? normalizeOptionalString(req.body.sourceUrl) : existing.sourceUrl,
      merged.status,
      merged.userRating,
      completedAt,
      today,
      id,
    )
    res.json(await aggregateBook(getBookWithFormats(id)))
  } catch (err) {
    res.status(errorStatus(err)).json({ error: err.message })
  }
})

router.put('/:id/formats', async (req, res) => {
  const id = Number(req.params.id)
  const existing = db.prepare('SELECT * FROM books WHERE id = ?').get(id)
  if (!existing) return res.status(404).json({ error: 'Buch nicht gefunden' })

  const { formats } = req.body
  if (!Array.isArray(formats))
    return res.status(400).json({ error: 'formats muss ein Array sein' })
  const normalizedFormats = normalizeFormats(formats)
  try {
    assertValidFormats(normalizedFormats)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM bookformats WHERE bookId = ?').run(id)
      for (const f of normalizedFormats) {
        db.prepare('INSERT INTO bookformats (bookId, format) VALUES (?, ?)')
          .run(id, f)
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
