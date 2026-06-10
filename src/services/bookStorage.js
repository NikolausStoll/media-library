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

export async function addBook(input, status, formats = []) {
  const payload = typeof input === 'object' && input !== null
    ? input
    : { title: input, status, formats }

  const res = await fetch(`${API_BASE}/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unbekannter Fehler' }))
    throw new Error(err.error ?? `Fehler ${res.status}`)
  }

  return await res.json()
}

export async function updateBook(id, data) {
  const res = await fetch(`${API_BASE}/books/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `updateBook failed: ${res.status}`)
  }
  return await res.json()
}

export async function updateBookFormats(id, formats) {
  const res = await fetch(`${API_BASE}/books/${id}/formats`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ formats }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `updateBookFormats failed: ${res.status}`)
  }
  return await res.json()
}

export async function prepareBookDraft({ isbn, languageHint }) {
  const res = await fetch(`${API_BASE}/books/prepare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isbn, languageHint }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `prepareBookDraft failed: ${res.status}`)
  }
  return await res.json()
}

function appendOptionalParam(params, key, value) {
  const normalized = String(value ?? '').trim()
  if (normalized) params.set(key, normalized)
}

export async function searchBookCandidates(query, options = {}) {
  const params = new URLSearchParams({ q: String(query).trim() })
  appendOptionalParam(params, 'language', options.language)
  appendOptionalParam(params, 'sort', options.sort)

  const res = await fetch(`${API_BASE}/books/search?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `searchBookCandidates failed: ${res.status}`)
  }
  return await res.json()
}

export async function loadBookEditions(workKey, options = {}) {
  const params = new URLSearchParams({ workKey: String(workKey ?? '').trim() })
  appendOptionalParam(params, 'language', options.language)
  appendOptionalParam(params, 'format', options.format)
  appendOptionalParam(params, 'sort', options.sort)

  const res = await fetch(`${API_BASE}/books/editions?${params.toString()}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `Status ${res.status}` }))
    throw new Error(err.error ?? `loadBookEditions failed: ${res.status}`)
  }
  return await res.json()
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
