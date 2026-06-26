import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('mediaStorage service', () => {
  it('loadMovies returns parsed JSON list', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: '1', title: 'Dune' }],
    })

    const { loadMovies } = await import('../../src/services/mediaStorage.js')
    const movies = await loadMovies()

    expect(fetchMock).toHaveBeenCalledWith('/api/movies')
    expect(movies).toEqual([{ id: '1', title: 'Dune' }])
  })

  it('updateMovie sends PATCH body', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '2', status: 'finished' }),
    })

    const { updateMovie } = await import('../../src/services/mediaStorage.js')
    await updateMovie('2', { status: 'finished' })

    expect(fetchMock).toHaveBeenCalledWith('/api/movies/2', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'finished' }),
    })
  })

  it('toggleEpisode posts season and episode', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ watched: true, season: 1, episode: 2 }),
    })

    const { toggleEpisode } = await import('../../src/services/mediaStorage.js')
    const result = await toggleEpisode('5', 1, 2)

    expect(fetchMock).toHaveBeenCalledWith('/api/series/5/progress/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ season: 1, episode: 2 }),
    })
    expect(result.watched).toBe(true)
  })

  it('loadProgressSummary fetches summary endpoint', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ 1: 5, 2: 10 }),
    })

    const { loadProgressSummary } = await import('../../src/services/mediaStorage.js')
    const summary = await loadProgressSummary()

    expect(fetchMock).toHaveBeenCalledWith('/api/series/progress-summary')
    expect(summary).toEqual({ 1: 5, 2: 10 })
  })

  it('toggleSeason sends bulk watched flag', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ season: 1, episode: 1 }],
    })

    const { toggleSeason } = await import('../../src/services/mediaStorage.js')
    await toggleSeason('5', 1, [1, 2], true)

    expect(fetchMock).toHaveBeenCalledWith('/api/series/5/progress/season/1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ episodes: [1, 2], watched: true }),
    })
  })

  it('searchTmdb encodes query and media type', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ id: 1, title: 'Test' }],
    })

    const { searchTmdb } = await import('../../src/services/mediaStorage.js')
    await searchTmdb('dune', 'movie')

    expect(fetchMock).toHaveBeenCalledWith('/api/tmdb/search?q=dune&type=movie')
  })

  it('addMovie throws on failed response', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Invalid status' }),
    })

    const { addMovie } = await import('../../src/services/mediaStorage.js')
    await expect(
      addMovie({ externalId: '1', status: 'watchlist', providers: [] }),
    ).rejects.toThrow('Invalid status')
  })
})
