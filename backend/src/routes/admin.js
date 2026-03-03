import { Router } from 'express'
import { db } from '../db/library.js'

const VALID_GAME_STATUSES = ['backlog', 'wishlist', 'started', 'completed', 'dropped', 'shelved']
const VALID_GAME_PLATFORMS = ['pc', 'xbox', 'switch', '3ds']
const VALID_PC_STOREFRONTS = ['steam', 'epic', 'gog', 'battlenet', 'uplay', 'ea', 'xbox']

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

router.post('/import-games', (req, res) => {
  const { ids, platform = 'pc', status = 'backlog', storefront } = req.body ?? {}
  if (!Array.isArray(ids) || ids.length === 0)
    return res.status(400).json({ error: 'Mindestens eine External ID ist erforderlich.' })

  const normalizedIds = Array.from(
    new Set(
      ids
        .map(id => (typeof id === 'string' ? id : String(id)))
        .map(id => id.trim())
        .filter(Boolean),
    ),
  )

  if (!normalizedIds.length)
    return res.status(400).json({ error: 'Keine gültigen External IDs gefunden.' })

  if (!VALID_GAME_STATUSES.includes(status))
    return res.status(400).json({ error: `Ungültiger Status. Erlaubt: ${VALID_GAME_STATUSES.join(', ')}` })

  if (platform && platform !== 'none' && !VALID_GAME_PLATFORMS.includes(platform))
    return res.status(400).json({ error: `Ungültige Plattform. Erlaubt: ${VALID_GAME_PLATFORMS.join(', ')}` })

  if (platform === 'pc' && storefront && !VALID_PC_STOREFRONTS.includes(storefront))
    return res.status(400).json({ error: `Ungültiges Storefront. Erlaubt: ${VALID_PC_STOREFRONTS.join(', ')}` })

  const inserted = []
  const skipped = []

  try {
    db.transaction(() => {
      const insertGame = db.prepare('INSERT INTO games (externalId, status) VALUES (?, ?)')
      const insertPlatform = db.prepare('INSERT INTO gameplatforms (gameId, platform, storefront) VALUES (?, ?, ?)')

      for (const externalId of normalizedIds) {
        const existing = db.prepare('SELECT id FROM games WHERE externalId = ?').get(externalId)
        if (existing) {
          skipped.push({ externalId, reason: 'exists' })
          continue
        }

        const { lastInsertRowid } = insertGame.run(externalId, status)
        if (platform && platform !== 'none') {
          insertPlatform.run(lastInsertRowid, platform, platform === 'pc' ? storefront ?? null : null)
        }
        inserted.push(externalId)
      }
    })()

    res.status(201).json({
      imported: inserted.length,
      inserted,
      skipped,
      skippedCount: skipped.length,
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
    textarea.bulk-input {
      width: 100%;
      min-height: 80px;
      margin-top: 0.25rem;
      margin-bottom: 0.75rem;
      padding: 0.75rem;
      border-radius: 6px;
      border: 1px solid #2a2d3a;
      background: #0f1117;
      color: #e0e0e0;
      font-family: inherit;
      font-size: 0.9rem;
    }
    .bulk-row {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 0.5rem;
      font-size: 0.85rem;
      color: #c0c0c0;
    }
    .bulk-row label {
      flex-shrink: 0;
    }
    select.bulk-select {
      background: #0f1117;
      color: #e0e0e0;
      border: 1px solid #2a2d3a;
      border-radius: 6px;
      padding: 0.4rem 0.6rem;
      font-size: 0.9rem;
    }
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

  <div class="card">
    <h2>Bulk-Spiele importieren</h2>
    <p>Gib eine durch Kommas oder Semikolons getrennte Liste von HLTB-IDs ein, wähle die Plattform und importiere sie in einem Rutsch.</p>
    <label for="bulkGamesInput" style="font-size:0.85rem; color:#c0c0c0">External IDs (z. B. 12345, 67890; 24680)</label>
    <textarea id="bulkGamesInput" class="bulk-input" placeholder="12345, 67890; 24680"></textarea>
     <div class="bulk-row">
      <label for="bulkStatus">Status</label>
      <select id="bulkStatus" class="bulk-select">
        <option value="backlog">Backlog</option>
        <option value="wishlist">Wishlist</option>
        <option value="started">Started</option>
        <option value="completed">Completed</option>
        <option value="dropped">Dropped</option>
        <option value="shelved">Shelved</option>
      </select>
    </div>
    <div class="bulk-row">
      <label for="bulkPlatform">Plattform</label>
      <select id="bulkPlatform" class="bulk-select">
        <option value="pc">PC</option>
        <option value="xbox">Xbox</option>
        <option value="switch">Switch</option>
        <option value="3ds">3DS</option>
        <option value="none">Keine Plattform</option>
      </select>
    </div>   
    <div class="bulk-row" id="bulkStorefrontWrapper">
      <label for="bulkStorefront">Storefront</label>
      <select id="bulkStorefront" class="bulk-select">
        <option value="steam">Steam</option>
        <option value="epic">Epic</option>
        <option value="gog">GOG</option>
        <option value="battlenet">Battle.net</option>
        <option value="uplay">Ubisoft</option>
        <option value="ea">EA</option>
        <option value="xbox">Xbox App</option>
      </select>
    </div>
    <button id="bulkImportBtn" onclick="importBulkGames()">Import starten</button>
    <div id="bulkImportStatus" class="status"></div>
    <pre id="bulkImportSummary" style="display:none"></pre>
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

    function toggleStorefrontField() {
      const platform = document.getElementById('bulkPlatform')?.value
      const wrapper = document.getElementById('bulkStorefrontWrapper')
      if (!wrapper) return
      wrapper.style.display = platform === 'pc' ? 'flex' : 'none'
    }

    document.getElementById('bulkPlatform')?.addEventListener('change', toggleStorefrontField)
    toggleStorefrontField()

    function parseBulkIds(text) {
      return Array.from(
        new Set(
          text
            .split(/[,;\\n\\r]+/)
            .map(id => id.trim())
            .filter(Boolean),
        ),
      )
    }

    async function importBulkGames() {
      const input = document.getElementById('bulkGamesInput')
      const platform = document.getElementById('bulkPlatform')?.value ?? 'pc'
      const status = document.getElementById('bulkStatus')?.value ?? 'backlog'
      const storefront = document.getElementById('bulkStorefront')?.value
      const statusId = 'bulkImportStatus'
      const summary = document.getElementById('bulkImportSummary')
      const button = document.getElementById('bulkImportBtn')
      const ids = parseBulkIds(input.value)

      if (!ids.length) {
        showStatus(statusId, 'Bitte mindestens eine External ID eingeben.', false)
        if (summary) summary.style.display = 'none'
        return
      }

      if (button) button.disabled = true
      if (summary) summary.style.display = 'none'

      try {
        const res = await fetch('/api/admin/import-games', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids, platform, storefront, status }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Import fehlgeschlagen')
        const parts = ['Importiert: ' + (data.imported ?? 0)]
        if (data.skippedCount) parts.push('Übersprungen: ' + data.skippedCount)
        showStatus(statusId, parts.join(' · '), true)
        if (summary) {
          if (data.skipped?.length) {
            summary.textContent = 'Übersprungene IDs: ' + data.skipped.map(s => s.externalId ?? s).join(', ')
            summary.style.display = 'block'
          } else {
            summary.style.display = 'none'
          }
        }
        input.value = ''
      } catch (err) {
        showStatus(statusId, err.message, false)
      } finally {
        if (button) button.disabled = false
      }
    }
  </script>
</body>
</html>`)
})

export default router
