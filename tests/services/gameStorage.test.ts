import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('gameStorage service', () => {
  it('addGame sends POST with externalId, status and platforms', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '1', externalId: '42', status: 'backlog' }),
    })

    const { addGame } = await import('../../src/services/gameStorage.js')
    await addGame('42', 'backlog', [{ platform: 'pc', storefront: 'steam' }])

    expect(fetchMock).toHaveBeenCalledWith('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalId: '42',
        status: 'backlog',
        platforms: [{ platform: 'pc', storefront: 'steam' }],
      }),
    })
  })

  it('addGame throws API error message on failure', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Duplicate game' }),
    })

    const { addGame } = await import('../../src/services/gameStorage.js')
    await expect(addGame('42', 'backlog', [])).rejects.toThrow('Duplicate game')
  })

  it('saveNext sends typed queue payload', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const { saveNext } = await import('../../src/services/gameStorage.js')
    await saveNext(['1', '2'], 'game')

    expect(fetchMock).toHaveBeenCalledWith('/api/next', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { mediaId: 1, mediaType: 'game' },
        { mediaId: 2, mediaType: 'game' },
      ]),
    })
  })

  it('removeFromNext calls DELETE with media type query', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const { removeFromNext } = await import('../../src/services/gameStorage.js')
    await removeFromNext('7', 'game')

    expect(fetchMock).toHaveBeenCalledWith('/api/next/7?type=game', { method: 'DELETE' })
  })

  it('loadSortOrder maps API rows to ordered game IDs', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [
        { gameId: 2, position: 1 },
        { gameId: 1, position: 0 },
      ],
    })

    const { loadSortOrder } = await import('../../src/services/gameStorage.js')
    const order = await loadSortOrder()

    expect(order).toEqual(['1', '2'])
  })

  it('updateGamePlatforms sends platform payload', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) })

    const { updateGamePlatforms } = await import('../../src/services/gameStorage.js')
    await updateGamePlatforms('9', [{ platform: 'pc', storefront: 'steam' }])

    expect(fetchMock).toHaveBeenCalledWith('/api/games/9/platforms', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: [{ platform: 'pc', storefront: 'steam' }] }),
    })
  })

  it('updateGameTags sends tag list', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ tags: ['physical'] }) })

    const { updateGameTags } = await import('../../src/services/gameStorage.js')
    await updateGameTags('9', ['physical'])

    expect(fetchMock).toHaveBeenCalledWith('/api/games/9/tags', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tags: ['physical'] }),
    })
  })
})
