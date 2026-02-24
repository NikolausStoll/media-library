import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

const BASE_URL = 'https://howlongtobeat.com';

const HEADERS = {
  'Referer': 'https://howlongtobeat.com',
  'Origin': 'https://howlongtobeat.com',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
};

// Token max. 30 Minuten cachen
let authToken = null;
let tokenFetchedAt = 0;
const TOKEN_TTL = 30 * 60 * 1000;

async function getAuthToken(force = false) {
  const now = Date.now();
  if (!force && authToken && now - tokenFetchedAt < TOKEN_TTL) return authToken;

  console.log('Auth Token abrufen...');
  const res = await fetch(`${BASE_URL}/api/finder/init?t=${Date.now()}`, { headers: HEADERS });
  const json = await res.json();
  authToken = json.token;
  tokenFetchedAt = Date.now();
  console.log('Auth Token erhalten:', authToken);
  return authToken;
}

function toHours(seconds) {
  if (!seconds || seconds === 0) return null;
  return Math.round((seconds / 3600) * 10) / 10;
}

// ─── SEARCH ──────────────────────────────────────────────
export async function searchGames(query, isRetry = false) {
  const token = await getAuthToken(isRetry);

  const body = JSON.stringify({
    searchType: 'games',
    searchTerms: query.trim().split(/\s+/),
    searchPage: 1,
    size: 20,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '', difficulty: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      lists: { sortCategory: 'follows' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
    useCache: true,
  });

  const res = await fetch(`${BASE_URL}/api/finder`, {
    method: 'POST',
    headers: { ...HEADERS, 'x-auth-token': token },
    body,
  });

  if (res.status === 403) {
    if (isRetry) throw new Error('Search fehlgeschlagen: 403 auch nach Token-Refresh');
    console.log('403 – Token erneuern und retry...');
    return searchGames(query, true);
  }

  if (!res.ok) throw new Error(`Search fehlgeschlagen: HTTP ${res.status}`);

  const json = await res.json();
  return (json.data ?? []).map((g) => ({
    id: String(g.game_id),
    name: g.game_name,
    imageUrl: g.game_image ? `${BASE_URL}/games/${g.game_image}` : null,
  }));
}

// ─── GET ─────────────────────────────────────────────────
export async function getGame(id) {
  const res = await fetch(`${BASE_URL}/game/${id}`, { headers: HEADERS });

  if (!res.ok) throw new Error(`Spiel nicht gefunden: HTTP ${res.status}`);

  const html = await res.text();
  const $ = cheerio.load(html);

  const raw = $('#__NEXT_DATA__').html();
  if (!raw) throw new Error('__NEXT_DATA__ nicht gefunden');

  const nextData = JSON.parse(raw);
  const props = nextData?.props?.pageProps;
  const game = props?.game?.data?.game?.[0] ?? {};
  const relationships = props?.game?.data?.relationships ?? [];

  return {
    id: String(id),
    name: game.game_name ?? '',
    imageUrl: game.game_image ? `${BASE_URL}/games/${game.game_image}` : null,
    gameplayMain: toHours(game.comp_main),
    gameplayExtra: toHours(game.comp_plus),
    gameplayComplete: toHours(game.comp_100),
    gameplayAll: toHours(game.comp_all),
    rating: game.review_score ?? null,
    dlcs: relationships.map((d) => ({
      id: String(d.game_id),
      name: d.game_name,
    })),
  };
}
