const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'

// ─── MOVIES ──────────────────────────────────────────────────────────────────

export async function loadMovies() {
  const res = await fetch(`${API_BASE}/movies`)
  if (!res.ok) throw new Error(`loadMovies failed: ${res.status}`)
  return res.json()
}

export async function addMovie({ externalId, status, providers = [] }) {
  const res = await fetch(`${API_BASE}/movies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId, status, providers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `addMovie failed: ${res.status}`)
  }
  return res.json()
}

export async function updateMovie(id, patch) {
  const res = await fetch(`${API_BASE}/movies/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `updateMovie failed: ${res.status}`)
  }
  return res.json()
}

export async function updateMovieProviders(id, providers) {
  const res = await fetch(`${API_BASE}/movies/${id}/providers`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(providers),
  })
  if (!res.ok) throw new Error(`updateMovieProviders failed: ${res.status}`)
  return res.json()
}

export async function deleteMovie(id) {
  const res = await fetch(`${API_BASE}/movies/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteMovie failed: ${res.status}`)
}

// ─── SERIES ──────────────────────────────────────────────────────────────────

export async function loadSeries() {
  const res = await fetch(`${API_BASE}/series`)
  if (!res.ok) throw new Error(`loadSeries failed: ${res.status}`)
  return res.json()
}

export async function addSeries({ externalId, status, providers = [] }) {
  const res = await fetch(`${API_BASE}/series`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalId, status, providers }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `addSeries failed: ${res.status}`)
  }
  return res.json()
}

export async function updateSeries(id, patch) {
  const res = await fetch(`${API_BASE}/series/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `updateSeries failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteSeries(id) {
  const res = await fetch(`${API_BASE}/series/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`deleteSeries failed: ${res.status}`)
}

// ─── EPISODE FORTSCHRITT ──────────────────────────────────────────────────────

export async function loadEpisodes(seriesId) {
  const res = await fetch(`${API_BASE}/series/${seriesId}/episodes`)
  if (!res.ok) throw new Error(`loadEpisodes failed: ${res.status}`)
  return res.json()
}

export async function loadEpisodeProgress(seriesId) {
  const res = await fetch(`${API_BASE}/series/${seriesId}/progress`)
  if (!res.ok) throw new Error(`loadEpisodeProgress failed: ${res.status}`)
  return res.json()
}

export async function toggleEpisode(seriesId, season, episode) {
  const res = await fetch(`${API_BASE}/series/${seriesId}/progress/toggle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ season, episode }),
  })
  if (!res.ok) throw new Error(`toggleEpisode failed: ${res.status}`)
  return res.json()
}

export async function toggleSeason(seriesId, season, episodeNumbers, watched) {
  const res = await fetch(`${API_BASE}/series/${seriesId}/progress/season/${season}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ episodes: episodeNumbers, watched }),
  })
  if (!res.ok) throw new Error(`toggleSeason failed: ${res.status}`)
  return res.json()
}

// ─── TMDB SEARCH ─────────────────────────────────────────────────────────────

export async function searchTmdb(query, type = 'movie') {
  const res = await fetch(
    `${API_BASE}/tmdb/search?q=${encodeURIComponent(query)}&type=${type}`
  )
  if (!res.ok) throw new Error(`searchTmdb failed: ${res.status}`)
  return res.json()
}
