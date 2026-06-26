import { vi } from 'vitest'

vi.mock('../src/services/bookStorage.js', () => ({
  loadBooks: vi.fn(),
  addBook: vi.fn(),
  updateBook: vi.fn(),
  updateBookFormats: vi.fn(),
  deleteBook: vi.fn(),
  loadNext: vi.fn(),
  saveNext: vi.fn(),
  removeFromNext: vi.fn(),
  prepareBookDraft: vi.fn(),
  searchBookCandidates: vi.fn(),
  loadBookEditions: vi.fn(),
}))
