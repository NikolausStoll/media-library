import fetch from 'node-fetch'

const OL_BASE = 'https://openlibrary.org'

const HEADERS = {
  'User-Agent': 'MediaLibrary/1.0 (https://github.com/NikolausStoll/media-library; media-library-app@nikolausstoll.dev)',
}

export async function getRatingByIsbn(isbn) {
  if (!isbn) return null

  const editionRes = await fetch(`${OL_BASE}/isbn/${isbn}.json`, { headers: HEADERS })
  if (!editionRes.ok) return null

  const edition = await editionRes.json()
  const workKey = edition?.works?.[0]?.key
  if (!workKey) return null

  const ratingsRes = await fetch(`${OL_BASE}${workKey}/ratings.json`, { headers: HEADERS })
  if (!ratingsRes.ok) return null

  const data = await ratingsRes.json()
  const avg = data?.summary?.average
  const count = data?.summary?.count

  if (avg == null || count === 0) return null

  return {
    average: Math.round(avg * 10) / 10,
    count,
  }
}
