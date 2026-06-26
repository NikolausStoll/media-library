import { vi } from 'vitest'

vi.mock('../src/services/mediaStorage.js', () => ({
  loadMovies: vi.fn(),
  addMovie: vi.fn(),
  updateMovie: vi.fn(),
  updateMovieProviders: vi.fn(),
  deleteMovie: vi.fn(),
  loadSeries: vi.fn(),
  addSeries: vi.fn(),
  updateSeries: vi.fn(),
  deleteSeries: vi.fn(),
  loadEpisodes: vi.fn(),
  loadEpisodeProgress: vi.fn(),
  loadProgressSummary: vi.fn(),
  toggleEpisode: vi.fn(),
  toggleSeason: vi.fn(),
  searchTmdb: vi.fn(),
  getTmdbDetail: vi.fn(),
}))
