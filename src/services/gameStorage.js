const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'

export async function loadGames() {
  try {
    const res = await fetch(`${API_BASE}/games`)
    if (!res.ok) throw new Error(`Games fetch failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('loadGames:', err)
    return []
  }
}

export async function addGame(externalId, status, platforms = []) {
  const res = await fetch(`${API_BASE}/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId, status, platforms }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error ?? `Fehler ${res.status}`)
  }

  return await res.json()
}

export async function updateGame(id, data) {
  try {
    const res = await fetch(`${API_BASE}/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`updateGame failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('updateGame:', err)
  }
}

export async function updateGamePlatforms(id, platforms) {
  try {
    const res = await fetch(`${API_BASE}/games/${id}/platforms`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms }),
    })
    if (!res.ok) throw new Error(`updateGamePlatforms failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('updateGamePlatforms:', err)
  }
}

export async function deleteGame(id) {
  try {
    const res = await fetch(`${API_BASE}/games/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`deleteGame failed: ${res.status}`)
  } catch (err) {
    console.error('deleteGame:', err)
  }
}

export async function updateGameTags(gameId, tags) {
  const res = await fetch(`${API_BASE}/games/${gameId}/tags`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tags }),
  })
  if (!res.ok) throw new Error(`updateGameTags failed: ${res.status}`)
  return res.json()
}

export async function loadSortOrder() {
  try {
    const res = await fetch(`${API_BASE}/sort-order`)
    if (!res.ok) throw new Error(`loadSortOrder failed: ${res.status}`)
    const data = await res.json()
    return data
      .sort((a, b) => a.position - b.position)
      .map(entry => String(entry.gameId))
  } catch (err) {
    console.error('loadSortOrder:', err)
    return []
  }
}

export async function saveSortOrder(orderedGameIds) {
  try {
    const res = await fetch(`${API_BASE}/sort-order`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: orderedGameIds.map(Number) }),
    })
    if (!res.ok) throw new Error(`saveSortOrder failed: ${res.status}`)
  } catch (err) {
    console.error('saveSortOrder:', err)
  }
}

export async function loadNext(mediaType = 'game') {
  try {
    const res = await fetch(`${API_BASE}/next?type=${mediaType}`)
    if (!res.ok) throw new Error(`loadNext failed: ${res.status}`)
    const data = await res.json()
    return data.map(entry => String(entry.mediaId))
  } catch (err) {
    console.error('loadNext', err)
    return []
  }
}

export async function saveNext(mediaIds, mediaType = 'game') {
  const items = mediaIds.map(id => ({ mediaId: Number(id), mediaType }))
  const res = await fetch(`${API_BASE}/next`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(items),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `saveNext failed: ${res.status}`)
  }
}

export async function removeFromNext(mediaId, mediaType = 'game') {
  try {
    const res = await fetch(`${API_BASE}/next/${mediaId}?type=${mediaType}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`removeFromNext failed: ${res.status}`)
  } catch (err) {
    console.error('removeFromNext', err)
  }
}
