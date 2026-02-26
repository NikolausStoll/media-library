import { Router } from 'express'
import { db } from '../db/library.js'

const router = Router()

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
      // Caches
      hltbcache:      db.prepare('SELECT * FROM hltbcache').all(),
      tmdbcache:      db.prepare('SELECT * FROM tmdbcache').all(),
    }
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
  if (!data?.games) return res.status(400).json({ error: 'Ungültiges Backup-Format' })
  try {
    db.transaction(() => {
      // Alles löschen
      db.prepare('DELETE FROM next').run()
      db.prepare('DELETE FROM sortorder').run()
      db.prepare('DELETE FROM gametags').run()
      db.prepare('DELETE FROM gameplatforms').run()
      db.prepare('DELETE FROM games').run()
      db.prepare('DELETE FROM mediaproviders').run()
      db.prepare('DELETE FROM movies').run()
      db.prepare('DELETE FROM series').run()
      db.prepare('DELETE FROM hltbcache').run()
      db.prepare('DELETE FROM tmdbcache').run()

      // Games
      const insertGame = db.prepare('INSERT INTO games (id, externalId, status, userRating) VALUES (@id, @externalId, @status, @userRating)')
      for (const g of data.games ?? []) insertGame.run(g)

      // Game Platforms
      const insertPlatform = db.prepare('INSERT INTO gameplatforms (id, gameId, platform, storefront) VALUES (@id, @gameId, @platform, @storefront)')
      for (const p of data.gameplatforms ?? []) insertPlatform.run(p)

      // Game Tags
      const insertTag = db.prepare('INSERT INTO gametags (id, gameId, tag) VALUES (@id, @gameId, @tag)')
      for (const t of data.gametags ?? []) insertTag.run(t)

      // Sort Order
      const insertSort = db.prepare('INSERT INTO sortorder (id, gameId, position) VALUES (@id, @gameId, @position)')
      for (const s of data.sortorder ?? []) insertSort.run(s)

      // Next (game + movie + series)
      const insertNext = db.prepare('INSERT INTO next (id, mediaId, mediaType) VALUES (@id, @mediaId, @mediaType)')
      for (const n of data.next ?? []) insertNext.run(n)

      // Movies
      const insertMovie = db.prepare('INSERT INTO movies (id, externalId, status, userRating) VALUES (@id, @externalId, @status, @userRating)')
      for (const m of data.movies ?? []) insertMovie.run(m)

      // Series
      const insertSeries = db.prepare('INSERT INTO series (id, externalId, status, userRating) VALUES (@id, @externalId, @status, @userRating)')
      for (const s of data.series ?? []) insertSeries.run(s)

      // Media Providers
      const insertProvider = db.prepare('INSERT INTO mediaproviders (id, mediaId, mediaType, provider) VALUES (@id, @mediaId, @mediaType, @provider)')
      for (const p of data.mediaproviders ?? []) insertProvider.run(p)

      // HLTB Cache
      const insertHltb = db.prepare(`
        INSERT INTO hltbcache (id, name, imageUrl, gameplayMain, gameplayExtra, gameplayComplete, gameplayAll, rating, dlcs, updatedAt)
        VALUES (@id, @name, @imageUrl, @gameplayMain, @gameplayExtra, @gameplayComplete, @gameplayAll, @rating, @dlcs, @updatedAt)
      `)
      for (const c of data.hltbcache ?? []) insertHltb.run(c)

      // TMDB Cache
      const insertTmdb = db.prepare(`
        INSERT INTO tmdbcache (id, mediaType, titleEn, titleDe, imageUrl, year, certification, rating, runtime, seasons, episodes, genres, linkUrl, originalLang, updatedAt)
        VALUES (@id, @mediaType, @titleEn, @titleDe, @imageUrl, @year, @certification, @rating, @runtime, @seasons, @episodes, @genres, @linkUrl, @originalLang, @updatedAt)
      `)
      for (const c of data.tmdbcache ?? []) insertTmdb.run(c)
    })()

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
        hltbcache:      data.hltbcache?.length ?? 0,
        tmdbcache:      data.tmdbcache?.length ?? 0,
      }
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="de">
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
    button { background: #3b82f6; color: #fff; border: none; border-radius: 6px; padding: 0.6rem 1.4rem; cursor: pointer; font-size: 0.9rem; margin-right: 0.5rem; }
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
    <p>Exportiert alle Tabellen (Games, Movies, Series, Providers, Next, Caches) als JSON-Datei.</p>
    <button onclick="exportDb()">Backup herunterladen</button>
    <div id="exportStatus" class="status"></div>
  </div>

  <div class="card">
    <h2>Import</h2>
    <p>Importiert ein bestehendes Backup.<br>
      <strong style="color:#fca5a5">Die gesamte Datenbank wird vor dem Import geleert!</strong>
    </p>
    <button onclick="document.getElementById('fileInput').click()">JSON-Datei wählen</button>
    <input type="file" id="fileInput" accept=".json" onchange="previewImport(event)">
    <pre id="preview" style="display:none"></pre>
    <button id="confirmBtn" class="danger" style="display:none; margin-top:0.75rem" onclick="confirmImport()">
      Jetzt importieren – DB überschreiben
    </button>
    <div id="importStatus" class="status"></div>
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
        if (!res.ok) throw new Error('Export fehlgeschlagen')
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = \`medialibrary-backup-\${Date.now()}.json\`
        a.click()
        URL.revokeObjectURL(url)
        showStatus('exportStatus', 'Backup heruntergeladen', true)
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
            exportedAt:     pendingImport.exportedAt,
            games:          pendingImport.games?.length ?? 0,
            movies:         pendingImport.movies?.length ?? 0,
            series:         pendingImport.series?.length ?? 0,
            mediaproviders: pendingImport.mediaproviders?.length ?? 0,
            next:           pendingImport.next?.length ?? 0,
            sortorder:      pendingImport.sortorder?.length ?? 0,
            hltbcache:      pendingImport.hltbcache?.length ?? 0,
            tmdbcache:      pendingImport.tmdbcache?.length ?? 0,
          }
          document.getElementById('preview').textContent = JSON.stringify(preview, null, 2)
          document.getElementById('preview').style.display = 'block'
          document.getElementById('confirmBtn').style.display = 'inline-block'
          document.getElementById('importStatus').className = 'status'
        } catch {
          showStatus('importStatus', 'Ungültige JSON-Datei', false)
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
        showStatus('importStatus', 'Import erfolgreich: ' + JSON.stringify(data.imported), true)
        document.getElementById('confirmBtn').style.display = 'none'
        document.getElementById('preview').style.display = 'none'
        pendingImport = null
      } catch (err) {
        showStatus('importStatus', err.message, false)
      }
    }
  </script>
</body>
</html>`)
})

export default router
