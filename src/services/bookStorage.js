const API_BASE = '/api'

export async function loadBooks() {
  try {
    const res = await fetch(`${API_BASE}/books`)
    if (!res.ok) throw new Error(`Books fetch failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('loadBooks:', err)
    return []
  }
}

export async function addBook(externalId, status, formats = []) {
  const res = await fetch(`${API_BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId, status, formats }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error ?? `Fehler ${res.status}`)
  }

  return await res.json()
}

export async function updateBook(id, data) {
  try {
    const res = await fetch(`${API_BASE}/books/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`updateBook failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('updateBook:', err)
  }
}

export async function updateBookFormats(id, formats) {
  try {
    const res = await fetch(`${API_BASE}/books/${id}/formats`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ formats }),
    })
    if (!res.ok) throw new Error(`updateBookFormats failed: ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error('updateBookFormats:', err)
  }
}

export async function deleteBook(id) {
  try {
    const res = await fetch(`${API_BASE}/books/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`deleteBook failed: ${res.status}`)
  } catch (err) {
    console.error('deleteBook:', err)
  }
}

export async function loadNext(mediaType = 'book') {
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

export async function saveNext(mediaIds, mediaType = 'book') {
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

export async function removeFromNext(mediaId, mediaType = 'book') {
  try {
    const res = await fetch(`${API_BASE}/next/${mediaId}?type=${mediaType}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`removeFromNext failed: ${res.status}`)
  } catch (err) {
    console.error('removeFromNext', err)
  }
}

export async function searchGoogleBooks(query) {
  const res = await fetch(`${API_BASE}/googlebooks/search?q=${encodeURIComponent(String(query).trim())}`)
  if (!res.ok) throw new Error(`searchGoogleBooks failed: ${res.status}`)
  return res.json()
}
