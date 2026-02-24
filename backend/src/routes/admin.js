import { Router } from 'express';
import { db } from '../db/library.js';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const cacheDb = new Database(join(__dirname, '../../backend.db'));

const router = Router();

// ─── EXPORT ──────────────────────────────────────────────
router.get('/export', (req, res) => {
  try {
    const data = {
      exportedAt: new Date().toISOString(),
      games:          db.prepare('SELECT * FROM games').all(),
      game_platforms: db.prepare('SELECT * FROM game_platforms').all(),
      game_tags:      db.prepare('SELECT * FROM game_tags').all(),
      sort_order:     db.prepare('SELECT * FROM sort_order').all(),
      play_next:      db.prepare('SELECT * FROM play_next').all(),
      hltb_cache:     db.prepare('SELECT * FROM hltb_cache').all(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="gamelibrary-backup-${Date.now()}.json"`);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── IMPORT ──────────────────────────────────────────────
router.post('/import', (req, res) => {
  const data = req.body;

  if (!data?.games)
    return res.status(400).json({ error: 'Ungültiges Backup-Format' });

  try {
    db.transaction(() => {
      // Alles löschen
      db.prepare('DELETE FROM play_next').run();
      db.prepare('DELETE FROM sort_order').run();
      db.prepare('DELETE FROM game_tags').run();
      db.prepare('DELETE FROM game_platforms').run();
      db.prepare('DELETE FROM games').run();
      db.prepare('DELETE FROM hltb_cache').run();

      // Games
      const insertGame = db.prepare(
        'INSERT INTO games (id, externalId, status) VALUES (@id, @externalId, @status)'
      );
      for (const g of data.games ?? []) insertGame.run(g);

      // Platforms
      const insertPlatform = db.prepare(
        'INSERT INTO game_platforms (id, gameId, platform, storefront) VALUES (@id, @gameId, @platform, @storefront)'
      );
      for (const p of data.game_platforms ?? []) insertPlatform.run(p);

      // Tags
      const insertTag = db.prepare(
        'INSERT INTO game_tags (id, gameId, tag) VALUES (@id, @gameId, @tag)'
      );
      for (const t of data.game_tags ?? []) insertTag.run(t);

      // Sort Order
      const insertSort = db.prepare(
        'INSERT INTO sort_order (id, gameId, position) VALUES (@id, @gameId, @position)'
      );
      for (const s of data.sort_order ?? []) insertSort.run(s);

      // Play Next
      const insertPlayNext = db.prepare(
        'INSERT INTO play_next (id, gameId) VALUES (@id, @gameId)'
      );
      for (const p of data.play_next ?? []) insertPlayNext.run(p);

      // HLTB Cache
      const insertCache = db.prepare(`
        INSERT INTO hltb_cache (id, name, imageUrl, gameplayMain, gameplayExtra, gameplayComplete, gameplayAll, rating, dlcs, updatedAt)
        VALUES (@id, @name, @imageUrl, @gameplayMain, @gameplayExtra, @gameplayComplete, @gameplayAll, @rating, @dlcs, @updatedAt)
      `);
      for (const c of data.hltb_cache ?? []) insertCache.run(c);

    })();

    res.json({
      success: true,
      imported: {
        games:          data.games?.length ?? 0,
        game_platforms: data.game_platforms?.length ?? 0,
        game_tags:      data.game_tags?.length ?? 0,
        sort_order:     data.sort_order?.length ?? 0,
        play_next:      data.play_next?.length ?? 0,
        hltb_cache:     data.hltb_cache?.length ?? 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ADMIN PAGE ───────────────────────────────────────────
router.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <title>Game Library – Admin</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #0f1117; color: #e0e0e0; padding: 2rem; }
    h1 { color: #fff; margin-bottom: 2rem; font-size: 1.4rem; }
    h2 { color: #aaa; font-size: 1rem; margin-bottom: 0.75rem; }
    .card {
      background: #1a1d26; border: 1px solid #2a2d3a;
      border-radius: 10px; padding: 1.5rem;
      margin-bottom: 1.5rem; max-width: 600px;
    }
    p { font-size: 0.88rem; color: #888; margin-bottom: 1rem; line-height: 1.5; }
    button {
      background: #3b82f6; color: #fff; border: none;
      border-radius: 6px; padding: 0.6rem 1.4rem;
      cursor: pointer; font-size: 0.9rem; margin-right: 0.5rem;
    }
    button:hover { background: #2563eb; }
    button.danger { background: #ef4444; }
    button.danger:hover { background: #dc2626; }
    input[type="file"] { display: none; }
    .status {
      margin-top: 1rem; padding: 0.6rem 0.9rem;
      border-radius: 6px; font-size: 0.85rem; display: none;
    }
    .status.ok  { background: #14532d; color: #86efac; display: block; }
    .status.err { background: #450a0a; color: #fca5a5; display: block; }
    pre {
      background: #0f1117; border: 1px solid #2a2d3a;
      border-radius: 6px; padding: 0.75rem;
      font-size: 0.78rem; margin-top: 0.75rem;
      max-height: 200px; overflow: auto;
    }
  </style>
</head>
<body>
  <h1>⚙️ Game Library Admin</h1>

  <!-- Export -->
  <div class="card">
    <h2>📤 Export</h2>
    <p>Exportiert alle Tabellen (Games, Platforms, Tags, Sort Order, Play Next, HLTB Cache) als JSON-Datei.</p>
    <button onclick="exportDb()">Backup herunterladen</button>
    <div id="exportStatus" class="status"></div>
  </div>

  <!-- Import -->
  <div class="card">
    <h2>📥 Import</h2>
    <p>
      Importiert ein bestehendes Backup.<br>
      <strong style="color:#fca5a5">⚠️ Die gesamte Datenbank wird vor dem Import geleert!</strong>
    </p>
    <button onclick="document.getElementById('fileInput').click()">JSON-Datei wählen</button>
    <input type="file" id="fileInput" accept=".json" onchange="previewImport(event)" />
    <pre id="preview" style="display:none"></pre>
    <button id="confirmBtn" class="danger" style="display:none; margin-top:0.75rem" onclick="confirmImport()">
      ⚠️ Jetzt importieren & DB überschreiben
    </button>
    <div id="importStatus" class="status"></div>
  </div>

  <script>
    let pendingImport = null;

    function showStatus(id, msg, ok) {
      const el = document.getElementById(id);
      el.textContent = msg;
      el.className = 'status ' + (ok ? 'ok' : 'err');
    }

    async function exportDb() {
      try {
        const res = await fetch('/api/admin/export');
        if (!res.ok) throw new Error('Export fehlgeschlagen');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'gamelibrary-backup-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        showStatus('exportStatus', '✓ Backup heruntergeladen', true);
      } catch (err) {
        showStatus('exportStatus', err.message, false);
      }
    }

    function previewImport(event) {
      const file = event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          pendingImport = JSON.parse(e.target.result);
          const preview = {
            exportedAt:     pendingImport.exportedAt,
            games:          pendingImport.games?.length ?? 0,
            game_platforms: pendingImport.game_platforms?.length ?? 0,
            game_tags:      pendingImport.game_tags?.length ?? 0,
            sort_order:     pendingImport.sort_order?.length ?? 0,
            play_next:      pendingImport.play_next?.length ?? 0,
            hltb_cache:     pendingImport.hltb_cache?.length ?? 0,
          };
          const pre = document.getElementById('preview');
          pre.textContent = JSON.stringify(preview, null, 2);
          pre.style.display = 'block';
          document.getElementById('confirmBtn').style.display = 'inline-block';
          document.getElementById('importStatus').className = 'status';
        } catch {
          showStatus('importStatus', 'Ungültige JSON-Datei', false);
        }
      };
      reader.readAsText(file);
    }

    async function confirmImport() {
      if (!pendingImport) return;

      try {
        const res = await fetch('/api/admin/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingImport),
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error);

        showStatus('importStatus',
          '✓ Import erfolgreich: ' + JSON.stringify(data.imported), true);
        document.getElementById('confirmBtn').style.display = 'none';
        document.getElementById('preview').style.display = 'none';
        pendingImport = null;
      } catch (err) {
        showStatus('importStatus', '❌ ' + err.message, false);
      }
    }
  </script>
</body>
</html>`);
});

export default router;
