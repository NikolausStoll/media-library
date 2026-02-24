import { db } from './library.js';

const games = [
  {
    externalId: '114144', status: 'completed',
    platforms: [{ platform: 'pc', storefront: 'steam' }],
  },
  {
    externalId: '10270', status: 'started',
    platforms: [{ platform: 'pc', storefront: 'gog' }, { platform: 'switch', storefront: null }],
  },
  {
    externalId: '38887', status: 'started',
    platforms: [{ platform: 'pc', storefront: 'steam' }],
  },
  {
    externalId: '63622', status: 'backlog',
    platforms: [{ platform: 'pc', storefront: 'epic' }],
  },
  {
    externalId: '52905', status: 'wishlist',
    platforms: [{ platform: 'switch', storefront: null }],
  },
];

db.prepare('DELETE FROM play_next').run();
db.prepare('DELETE FROM sort_order').run();
db.prepare('DELETE FROM game_platforms').run();
db.prepare('DELETE FROM games').run();

const insertGame = db.transaction((g) => {
  const { lastInsertRowid: gameId } = db
    .prepare('INSERT INTO games (externalId, status) VALUES (?, ?)')
    .run(g.externalId, g.status);

  for (const p of g.platforms) {
    db.prepare('INSERT INTO game_platforms (gameId, platform, storefront) VALUES (?, ?, ?)')
      .run(gameId, p.platform, p.storefront ?? null);
  }
  return gameId;
});

const insertedIds = games.map(insertGame);

const startedIds = games
  .map((g, i) => ({ g, id: insertedIds[i] }))
  .filter(({ g }) => g.status === 'started')
  .map(({ id }) => id);

const insertSort = db.prepare('INSERT INTO sort_order (gameId, position) VALUES (?, ?)');
startedIds.forEach((gameId, position) => insertSort.run(gameId, position));

console.log('Seed fertig ✓');
