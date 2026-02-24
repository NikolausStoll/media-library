import { Router } from 'express';
import { db, getGameWithPlatforms } from '../db/library.js';
import { getFromCache, saveToCache, deleteFromCache } from '../services/db.js';
import { getGame as fetchFromHltb } from '../services/hltbService.js';

const router = Router();

async function aggregateGame(game) {
  let hltb = getFromCache(game.externalId);

  if (!hltb) {
    try {
      hltb = await fetchFromHltb(game.externalId);
      saveToCache(hltb);
    } catch (err) {
      console.error(`HLTB fetch fehlgeschlagen für ${game.externalId}:`, err.message);
      hltb = null;
    }
  }

  return {
    id: String(game.id),
    externalId: game.externalId,
    name: hltb?.name ?? game.externalId,
    imageUrl: hltb?.imageUrl ?? null,
    status: game.status,
    platforms: game.platforms,
    tags: game.tags ?? [],
    gameplayMain: hltb?.gameplayMain ?? null,
    gameplayExtra: hltb?.gameplayExtra ?? null,
    gameplayComplete: hltb?.gameplayComplete ?? null,
    gameplayAll: hltb?.gameplayAll ?? null,
    rating: hltb?.rating ?? null,
    dlcs: hltb?.dlcs ?? [],
  };
}

// GET /api/games
router.get('/', async (req, res) => {
  try {
    const rawGames = db.prepare('SELECT * FROM games').all().map((g) => ({
      ...g,
      platforms: db
        .prepare('SELECT id, platform, storefront FROM game_platforms WHERE gameId = ?')
        .all(g.id),
      tags: db
        .prepare('SELECT tag FROM game_tags WHERE gameId = ?')
        .all(g.id)
        .map(r => r.tag),
    }));

    const aggregated = await Promise.all(rawGames.map(aggregateGame));
    aggregated.sort((a, b) => a.name.localeCompare(b.name));
    res.json(aggregated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

 // DELETE /api/games/:id/cache  → HLTB Cache für dieses Spiel invalidieren
router.delete('/:id/cache', (req, res) => {
  const id = Number(req.params.id);
  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!game) return res.status(404).json({ error: 'Spiel nicht gefunden' });

  try {
    deleteFromCache(game.externalId);
    res.json({ success: true, message: `Cache für ${game.externalId} invalidiert` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /api/games/:id
router.get('/:id', async (req, res) => {
  try {
    const game = getGameWithPlatforms(Number(req.params.id));
    if (!game) return res.status(404).json({ error: 'Spiel nicht gefunden' });
    res.json(await aggregateGame(game));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games
router.post('/', async (req, res) => {
  const { externalId, status, platforms = [] } = req.body;

  if (!externalId || !status)
    return res.status(400).json({ error: 'externalId und status sind Pflichtfelder' });

  const VALID = ['backlog', 'wishlist', 'started', 'completed', 'retired', 'shelved'];
  if (!VALID.includes(status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID.join(', ')}` });

  const existing = db.prepare('SELECT id FROM games WHERE externalId = ?').get(externalId);
  if (existing)
    return res.status(409).json({ error: `Spiel mit externalId ${externalId} existiert bereits` });

  try {
    const gameId = db.transaction(() => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO games (externalId, status) VALUES (?, ?)')
        .run(externalId, status);

      for (const p of platforms) {
        db.prepare('INSERT INTO game_platforms (gameId, platform, storefront) VALUES (?, ?, ?)')
          .run(lastInsertRowid, p.platform, p.storefront ?? null);
      }
      return lastInsertRowid;
    })();

    res.status(201).json(await aggregateGame(getGameWithPlatforms(gameId)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:id
router.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Spiel nicht gefunden' });

  const VALID = ['backlog', 'wishlist', 'started', 'completed', 'retired', 'shelved'];
  if (req.body.status && !VALID.includes(req.body.status))
    return res.status(400).json({ error: `Ungültiger status. Erlaubt: ${VALID.join(', ')}` });

  const merged = {
    externalId: req.body.externalId ?? existing.externalId,
    status:     req.body.status     ?? existing.status,
  };

  try {
    db.prepare('UPDATE games SET externalId=?, status=? WHERE id=?')
      .run(merged.externalId, merged.status, id);
    res.json(await aggregateGame(getGameWithPlatforms(id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/games/:id/platforms
router.put('/:id/platforms', async (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Spiel nicht gefunden' });

  const { platforms } = req.body;
  if (!Array.isArray(platforms))
    return res.status(400).json({ error: 'platforms muss ein Array sein' });

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM game_platforms WHERE gameId = ?').run(id);
      for (const p of platforms) {
        db.prepare('INSERT INTO game_platforms (gameId, platform, storefront) VALUES (?, ?, ?)')
          .run(id, p.platform, p.storefront ?? null);
      }
    })();
    res.json(await aggregateGame(getGameWithPlatforms(id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const VALID_TAGS = ['physical', '100%'];

// PUT /api/games/:id/tags
router.put('/:id/tags', async (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Spiel nicht gefunden' });

  const { tags } = req.body;
  if (!Array.isArray(tags))
    return res.status(400).json({ error: 'tags muss ein Array sein' });

  const invalid = tags.filter(t => !VALID_TAGS.includes(t));
  if (invalid.length > 0)
    return res.status(400).json({
      error: `Ungültige Tags: ${invalid.join(', ')}. Erlaubt: ${VALID_TAGS.join(', ')}`,
    });

  try {
    db.transaction(() => {
      db.prepare('DELETE FROM game_tags WHERE gameId = ?').run(id);
      const stmt = db.prepare('INSERT OR IGNORE INTO game_tags (gameId, tag) VALUES (?, ?)');
      for (const tag of tags) stmt.run(id, tag);
    })();
    res.json(await aggregateGame(getGameWithPlatforms(id)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// DELETE /api/games/:id
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM games WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Spiel nicht gefunden' });

  try {
    db.prepare('DELETE FROM games WHERE id = ?').run(id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
