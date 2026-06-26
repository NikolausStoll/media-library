import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('bookStorage service', () => {
  it('addBook sends object payload unchanged', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ id: '3', title: 'Dune' }),
    })

    const payload = {
      title: 'Dune',
      authors: ['Frank Herbert'],
      status: 'backlog',
      formats: [{ format: 'paperback' }],
    }

    const { addBook } = await import('../../src/services/bookStorage.js')
    await addBook(payload)

    expect(fetchMock).toHaveBeenCalledWith('/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  })

  it('updateBook throws backend error text', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Book not found' }),
    })

    const { updateBook } = await import('../../src/services/bookStorage.js')
    await expect(updateBook('9', { status: 'started' })).rejects.toThrow('Book not found')
  })

  it('loadNext defaults to book media type', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => [{ mediaId: 4 }],
    })

    const { loadNext } = await import('../../src/services/bookStorage.js')
    const ids = await loadNext()

    expect(fetchMock).toHaveBeenCalledWith('/api/next?type=book')
    expect(ids).toEqual(['4'])
  })
})
