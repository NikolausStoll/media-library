import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { Router } from 'express'
import { db } from '../db/library.js'
import { normalizeBookPublishedDate } from '../utils/bookDate.js'

const uploadsRoot = process.env.UPLOAD_DIR ?? join(dirname(db.name), 'uploads')

const VALID_BOOK_FORMATS = ['hardcover', 'paperback', 'ebook', 'audiobook', 'other']

const router = Router()

const withDefaults = (row, defaults) => ({ ...defaults, ...row })
const normalizeBookFormat = (format) => {
  const normalized = String(format ?? '').trim().toLowerCase()
  return normalized === 'kindle' ? 'ebook' : normalized
}

// ─── EXPORT ───────────────────────────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const data = {
      exportedAt:     new Date().toISOString(),
      // Games
      games:          db.prepare('SELECT * FROM games').all(),
      gameplatforms:  db.prepare('SELECT * FROM gameplatforms').all(),
      gametags:       db.prepare('SELECT * FROM gametags').all(),
      sortorder:      db.prepare('SELECT * FROM sortorder').all(),
      // Next (ersetzt playnext)
      next:           db.prepare('SELECT * FROM next').all(),
      // Movies & Series
      movies:         db.prepare('SELECT * FROM movies').all(),
      series:         db.prepare('SELECT * FROM series').all(),
      mediaproviders: db.prepare('SELECT * FROM mediaproviders').all(),
      episodeprogress: db.prepare('SELECT * FROM episodeprogress').all(),
      // Books
      books:          db.prepare('SELECT * FROM books').all(),
      bookformats:    db.prepare('SELECT * FROM bookformats').all(),
    }
    const bookImages = []
    for (const b of data.books) {
      if (!b.coverPath && !b.coverThumbPath) continue
      const entry = { bookId: b.id }
      if (b.coverPath) {
        const fsPath = join(uploadsRoot, b.coverPath.replace(/^\/uploads\//, ''))
        if (existsSync(fsPath)) {
          entry.coverPath = b.coverPath
          entry.coverData = readFileSync(fsPath).toString('base64')
        }
      }
      if (b.coverThumbPath) {
        const fsPath = join(uploadsRoot, b.coverThumbPath.replace(/^\/uploads\//, ''))
        if (existsSync(fsPath)) {
          entry.coverThumbPath = b.coverThumbPath
          entry.coverThumbData = readFileSync(fsPath).toString('base64')
        }
      }
      if (entry.coverData || entry.coverThumbData) bookImages.push(entry)
    }
    data.bookImages = bookImages

    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="medialibrary-backup-${Date.now()}.json"`)
    res.json(data)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── IMPORT ───────────────────────────────────────────────────────────────────
router.post('/import', (req, res) => {
  const data = req.body
  if (!data || typeof data !== 'object' || Array.isArray(data)) return res.status(400).json({ error: 'Invalid backup format' })
  try {
    db.transaction(() => {
      // Alles löschen
      db.prepare('DELETE FROM next').run()
      db.prepare('DELETE FROM sortorder').run()
      db.prepare('DELETE FROM gametags').run()
      db.prepare('DELETE FROM gameplatforms').run()
      db.prepare('DELETE FROM episodeprogress').run()
      db.prepare('DELETE FROM mediaproviders').run()
      db.prepare('DELETE FROM games').run()
      db.prepare('DELETE FROM movies').run()
      db.prepare('DELETE FROM series').run()
      db.prepare('DELETE FROM bookformats').run()
      db.prepare('DELETE FROM books').run()
      db.prepare('DELETE FROM hltbcache').run()
      db.prepare('DELETE FROM tmdbcache').run()
      db.prepare('DELETE FROM tmdbcacheepisodes').run()

      // Games
      const insertGame = db.prepare('INSERT INTO games (id, externalId, status, userRating, completedAt, lastTouched) VALUES (@id, @externalId, @status, @userRating, @completedAt, @lastTouched)')
      for (const g of data.games ?? []) {
        insertGame.run(withDefaults(g, { userRating: null, completedAt: null, lastTouched: null }))
      }

      // Game Platforms
      const insertPlatform = db.prepare('INSERT INTO gameplatforms (id, gameId, platform, storefront) VALUES (@id, @gameId, @platform, @storefront)')
      for (const p of data.gameplatforms ?? []) {
        insertPlatform.run(withDefaults(p, { storefront: null }))
      }

      // Game Tags
      const insertTag = db.prepare('INSERT INTO gametags (id, gameId, tag) VALUES (@id, @gameId, @tag)')
      for (const t of data.gametags ?? []) insertTag.run(t)

      // Sort Order
      const insertSort = db.prepare('INSERT INTO sortorder (id, gameId, position) VALUES (@id, @gameId, @position)')
      for (const s of data.sortorder ?? []) insertSort.run(s)

      // Movies
      const insertMovie = db.prepare('INSERT INTO movies (id, externalId, status, userRating, completedAt, lastTouched) VALUES (@id, @externalId, @status, @userRating, @completedAt, @lastTouched)')
      for (const m of data.movies ?? []) {
        insertMovie.run(withDefaults(m, { userRating: null, completedAt: null, lastTouched: null }))
      }

      // Series
      const insertSeries = db.prepare('INSERT INTO series (id, externalId, status, userRating, completedAt, lastTouched) VALUES (@id, @externalId, @status, @userRating, @completedAt, @lastTouched)')
      for (const s of data.series ?? []) {
        insertSeries.run(withDefaults(s, { userRating: null, completedAt: null, lastTouched: null }))
      }

      // Media Providers
      const insertProvider = db.prepare('INSERT INTO mediaproviders (id, mediaId, mediaType, provider) VALUES (@id, @mediaId, @mediaType, @provider)')
      for (const p of data.mediaproviders ?? []) insertProvider.run(p)

      // Episode Progress
      const insertEpisodeProgress = db.prepare(`
        INSERT INTO episodeprogress (id, seriesId, season, episode, watchedAt, lastTouched)
        VALUES (@id, @seriesId, @season, @episode, @watchedAt, @lastTouched)
      `)
      for (const ep of data.episodeprogress ?? []) {
        insertEpisodeProgress.run(withDefaults(ep, { watchedAt: null, lastTouched: null }))
      }

      // Books
      const insertBook = db.prepare(`
        INSERT INTO books (
          id, title, authors, description, imageUrl, coverPath, coverThumbPath, pageCount,
          publishedDate, seriesName, seriesPosition, publisher, isbn, language,
          sourceName, sourceUrl, alternateTitle, status, userRating, completedAt, lastTouched
        )
        VALUES (
          @id, @title, @authors, @description, @imageUrl, @coverPath, @coverThumbPath, @pageCount,
          @publishedDate, @seriesName, @seriesPosition, @publisher, @isbn, @language,
          @sourceName, @sourceUrl, @alternateTitle, @status, @userRating, @completedAt, @lastTouched
        )
      `)
      for (const b of data.books ?? []) {
        const book = withDefaults(b, {
          title: null,
          authors: '[]',
          description: null,
          imageUrl: null,
          coverPath: null,
          coverThumbPath: null,
          pageCount: null,
          publishedDate: null,
          seriesName: null,
          seriesPosition: null,
          publisher: null,
          isbn: null,
          language: null,
          sourceName: null,
          sourceUrl: null,
          alternateTitle: null,
          userRating: null,
          completedAt: null,
          lastTouched: null,
        })
        book.publishedDate = normalizeBookPublishedDate(book.publishedDate) ?? book.publishedDate
        insertBook.run(book)
      }

      // Book Formats
      const insertBookFormat = db.prepare('INSERT INTO bookformats (id, bookId, format) VALUES (@id, @bookId, @format)')
      const importedBookFormats = new Set()
      for (const f of data.bookformats ?? []) {
        const format = normalizeBookFormat(f.format)
        if (!VALID_BOOK_FORMATS.includes(format)) continue
        const key = `${f.bookId}:${format}`
        if (importedBookFormats.has(key)) continue
        importedBookFormats.add(key)
        insertBookFormat.run({ ...f, format })
      }

      // Next (game + movie + series + book)
      const insertNext = db.prepare('INSERT INTO next (id, mediaId, mediaType) VALUES (@id, @mediaId, @mediaType)')
      for (const n of data.next ?? []) insertNext.run(n)
    })()

    let bookImagesWritten = 0
    for (const img of data.bookImages ?? []) {
      if (img.coverData && img.coverPath) {
        const fsPath = join(uploadsRoot, img.coverPath.replace(/^\/uploads\//, ''))
        mkdirSync(dirname(fsPath), { recursive: true })
        writeFileSync(fsPath, Buffer.from(img.coverData, 'base64'))
        bookImagesWritten++
      }
      if (img.coverThumbData && img.coverThumbPath) {
        const fsPath = join(uploadsRoot, img.coverThumbPath.replace(/^\/uploads\//, ''))
        mkdirSync(dirname(fsPath), { recursive: true })
        writeFileSync(fsPath, Buffer.from(img.coverThumbData, 'base64'))
      }
    }

    res.json({
      success: true,
      imported: {
        games:          data.games?.length ?? 0,
        gameplatforms:  data.gameplatforms?.length ?? 0,
        gametags:       data.gametags?.length ?? 0,
        sortorder:      data.sortorder?.length ?? 0,
        next:           data.next?.length ?? 0,
        movies:         data.movies?.length ?? 0,
        series:         data.series?.length ?? 0,
        mediaproviders: data.mediaproviders?.length ?? 0,
        episodeprogress: data.episodeprogress?.length ?? 0,
        books:          data.books?.length ?? 0,
        bookformats:    data.bookformats?.length ?? 0,
        bookImages:     bookImagesWritten,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/clear-hltb-cache', (req, res) => {
  try {
    db.prepare('DELETE FROM hltbcache').run()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/clear-tmdb-cache', (req, res) => {
  try {
    db.prepare('DELETE FROM tmdbcache').run()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/clear-tmdb-episodes-cache', (req, res) => {
  try {
    db.prepare('DELETE FROM tmdbcacheepisodes').run()
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Media Library Admin</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e0e0e0; padding: 2rem; }
    h1 { color: #fff; margin-bottom: 2rem; font-size: 1.4rem; }
    h2 { color: #aaa; font-size: 1rem; margin-bottom: 0.75rem; }
    .card { background: #1a1d26; border: 1px solid #2a2d3a; border-radius: 10px; padding: 1.5rem; margin-bottom: 1.5rem; max-width: 600px; }
    p { font-size: 0.88rem; color: #888; margin-bottom: 1rem; line-height: 1.5; }
    .btn-row { display: flex; flex-wrap: wrap; gap: 0.5rem; }
    button { background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.6rem 1.4rem; cursor: pointer; font-size: 0.9rem; }
    button:hover { background: #2563eb; }
    button.danger { background: #ef4444; }
    button.danger:hover { background: #dc2626; }
    input[type=file] { display: none; }
    .status { margin-top: 1rem; padding: 0.6rem 0.9rem; border-radius: 6px; font-size: 0.85rem; display: none; }
    .status.ok  { background: #14532d; color: #86efac; display: block; }
    .status.err { background: #450a0a; color: #fca5a5; display: block; }
    pre { background: #0f1117; border: 1px solid #2a2d3a; border-radius: 6px; padding: 0.75rem; font-size: 0.78rem; margin-top: 0.75rem; max-height: 200px; overflow: auto; }
  </style>
</head>
<body>
  <h1>Media Library Admin</h1>

  <div class="card">
    <h2>Export</h2>
    <p>Exports all library data (games, movies, series, books, episode progress) as a JSON file. Caches are not included — they are re-fetched on demand.</p>
    <button onclick="exportDb()">Download backup</button>
    <div id="exportStatus" class="status"></div>
  </div>

  <div class="card">
    <h2>Import</h2>
    <p>Restores a previously exported backup.<br>
      <strong style="color:#fca5a5">The entire database will be wiped before import!</strong>
    </p>
    <button onclick="document.getElementById('fileInput').click()">Choose JSON file</button>
    <input type="file" id="fileInput" accept=".json" onchange="previewImport(event)">
    <pre id="preview" style="display:none"></pre>
    <button id="confirmBtn" class="danger" style="display:none; margin-top:0.75rem" onclick="confirmImport()">
      Import now — overwrite database
    </button>
    <div id="importStatus" class="status"></div>
  </div>

  <div class="card">
    <h2>Manage caches</h2>
    <p>Clears caches so fresh data is fetched on next load. Episode watch progress is <strong>not</strong> affected.</p>
    <div class="btn-row">
      <button class="danger" onclick="clearCache('clear-hltb-cache', 'hltbStatus')">Clear HLTB cache</button>
      <button class="danger" onclick="clearCache('clear-tmdb-cache', 'tmdbStatus')">Clear TMDB metadata</button>
      <button class="danger" onclick="clearCache('clear-tmdb-episodes-cache', 'tmdbEpStatus')">Clear episode cache</button>
    </div>
    <div id="hltbStatus" class="status"></div>
    <div id="tmdbStatus" class="status"></div>
    <div id="tmdbEpStatus" class="status"></div>
  </div>

  <script>
    let pendingImport = null

    function showStatus(id, msg, ok) {
      const el = document.getElementById(id)
      el.textContent = msg
      el.className = 'status ' + (ok ? 'ok' : 'err')
    }

    async function exportDb() {
      try {
        const res = await fetch('/api/admin/export')
        if (!res.ok) throw new Error('Export failed')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = \`medialibrary-backup-\${Date.now()}.json\`
        a.click()
        URL.revokeObjectURL(url)
        showStatus('exportStatus', 'Backup downloaded', true)
      } catch (err) {
        showStatus('exportStatus', err.message, false)
      }
    }

    function previewImport(event) {
      const file = event.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = e => {
        try {
          pendingImport = JSON.parse(e.target.result)
          const preview = {
            exportedAt:      pendingImport.exportedAt,
            games:           pendingImport.games?.length ?? 0,
            movies:          pendingImport.movies?.length ?? 0,
            series:          pendingImport.series?.length ?? 0,
            episodeprogress: pendingImport.episodeprogress?.length ?? 0,
            books:           pendingImport.books?.length ?? 0,
            bookformats:     pendingImport.bookformats?.length ?? 0,
            bookImages:      pendingImport.bookImages?.length ?? 0,
            next:            pendingImport.next?.length ?? 0,
          }
          document.getElementById('preview').textContent = JSON.stringify(preview, null, 2)
          document.getElementById('preview').style.display = 'block'
          document.getElementById('confirmBtn').style.display = 'inline-block'
          document.getElementById('importStatus').className = 'status'
        } catch {
          showStatus('importStatus', 'Invalid JSON file', false)
        }
      }
      reader.readAsText(file)
    }

    async function confirmImport() {
      if (!pendingImport) return
      try {
        const res = await fetch('/api/admin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingImport)
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        const summary = Object.entries(data.imported).map(([k, v]) => \`\${k}: \${v}\`).join(', ')
        showStatus('importStatus', 'Import successful · ' + summary, true)
        document.getElementById('confirmBtn').style.display = 'none'
        document.getElementById('preview').style.display = 'none'
        pendingImport = null
      } catch (err) {
        showStatus('importStatus', err.message, false)
      }
    }

    async function clearCache(endpoint, statusId) {
      try {
        const res = await fetch(\`/api/admin/\${endpoint}\`, { method: 'POST' })
        if (!res.ok) throw new Error('Failed')
        showStatus(statusId, 'Cache cleared', true)
      } catch (err) {
        showStatus(statusId, err.message, false)
      }
    }
  </script>
</body>
</html>`)
})

export default router
