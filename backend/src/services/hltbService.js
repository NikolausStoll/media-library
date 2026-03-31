import fetch from 'node-fetch'
import * as cheerio from 'cheerio'

const BASE_URL = 'https://howlongtobeat.com'

const HEADERS = {
  'Referer': 'https://howlongtobeat.com',
  'Origin': 'https://howlongtobeat.com',
  'Content-Type': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0',
}

let authToken = null
let hpKey = null
let hpVal = null
let tokenFetchedAt = 0
const TOKEN_TTL = 30 * 60 * 1000
const PAGE_SIZE = 20
const MAX_PAGES = 2
const MAX_RESULTS = PAGE_SIZE * MAX_PAGES

function normalizeReleaseDate(value) {
  if (!value) return null
  const normalized = String(value).trim()
  if (!normalized) return null
  if (normalized === '0000-00-00') return null
  const yearOnlyMatch = normalized.match(/^(\d{4})-00-00$/)
  if (yearOnlyMatch) return yearOnlyMatch[1]
  return normalized
}

function mapDlcEntry(entry) {
  if (!entry) return null
  return {
    id: String(entry.game_id),
    name: entry.game_name ?? '',
    type: normalizeType(entry.game_type ?? entry.relationship_type ?? entry.type ?? 'dlc', 'dlc'),
    gameplayAll: toHours(entry.comp_all),
    rating: entry.review_score ?? null,
  }
}

async function getAuthToken(force = false) {
  const now = Date.now()
  if (!force && authToken && now - tokenFetchedAt < TOKEN_TTL) return authToken

  console.log('Auth Token abrufen...')
  const res = await fetch(`${BASE_URL}/api/find/init?t=${Date.now()}`, { headers: HEADERS })
  const json = await res.json()
  authToken = json.token
  hpKey = json.hpKey ?? null
  hpVal = json.hpVal ?? null
  tokenFetchedAt = Date.now()
  console.log('Auth Token erhalten:', authToken)
  return authToken
}

function toHours(seconds) {
  if (!seconds || seconds === 0) return null
  return Math.round((seconds / 3600) * 10) / 10
}

function normalizeType(value, fallback) {
  if (!value) return fallback
  const normalized = String(value).toLowerCase()
  if (normalized.includes('expansion')) return 'dlc'
  if (normalized.includes('dlc')) return 'dlc'
  if (normalized.includes('game')) return 'game'
  return fallback
}

export async function searchGames(query) {
  const results = []

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const pageResults = await searchPage(query, page)
    if (!pageResults.length) break
    results.push(...pageResults)
    if (pageResults.length < PAGE_SIZE) break
  }

  return results.slice(0, MAX_RESULTS)
}

async function searchPage(query, page, isRetry = false) {
  const token = await getAuthToken(isRetry)

  const payload = {
    searchType: 'games',
    searchTerms: query.trim().split(/\s+/),
    searchPage: page,
    size: PAGE_SIZE,
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
  }

  if (hpKey) payload[hpKey] = hpVal

  const reqHeaders = { ...HEADERS, 'x-auth-token': token }
  if (hpKey) {
    reqHeaders['x-hp-key'] = hpKey
    reqHeaders['x-hp-val'] = hpVal
  }

  const res = await fetch(`${BASE_URL}/api/find`, {
    method: 'POST',
    headers: reqHeaders,
    body: JSON.stringify(payload),
  })

  if (res.status === 403) {
    if (isRetry) throw new Error('Search fehlgeschlagen: 403 auch nach Token-Refresh')
    console.log('403 – Token erneuern und retry...')
    return searchPage(query, page, true)
  }

  if (!res.ok) throw new Error(`Search fehlgeschlagen: HTTP ${res.status}`)

  const json = await res.json()
  return (json.data ?? []).map((g) => ({
    id: String(g.game_id),
    name: g.game_name,
    imageUrl: g.game_image ? `${BASE_URL}/games/${g.game_image}` : null,
  }))
}

export async function getGame(id) {
  const res = await fetch(`${BASE_URL}/game/${id}`, { headers: HEADERS })

  if (!res.ok) throw new Error(`Spiel nicht gefunden: HTTP ${res.status}`)

  const html = await res.text()
  const $ = cheerio.load(html)

  const raw = $('#__NEXT_DATA__').html()
  if (!raw) throw new Error('__NEXT_DATA__ nicht gefunden')

  const nextData = JSON.parse(raw)
  const props = nextData?.props?.pageProps
  const game = props?.game?.data?.game?.[0] ?? {}
  const relationships = props?.game?.data?.relationships ?? []

  return {
    id: String(id),
    name: game.game_name ?? '',
    imageUrl: game.game_image ? `${BASE_URL}/games/${game.game_image}` : null,
    gameplayMain: toHours(game.comp_main),
    gameplayExtra: toHours(game.comp_plus),
    gameplayComplete: toHours(game.comp_100),
    gameplayAll: toHours(game.comp_all),
    rating: game.review_score ?? null,
    gameType: normalizeType(game.game_type ?? game.category ?? 'game', 'game'),
    dlcs: relationships.map(mapDlcEntry).filter(Boolean),
    releaseDateEu: normalizeReleaseDate(game.release_eu),
  }
}
