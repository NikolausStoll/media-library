import { vi } from 'vitest'

vi.mock('../src/services/gameStorage.js', () => ({
  loadGames: vi.fn(),
  addGame: vi.fn(),
  updateGame: vi.fn(),
  updateGamePlatforms: vi.fn(),
  updateGameTags: vi.fn(),
  deleteGame: vi.fn(),
  loadSortOrder: vi.fn(),
  saveSortOrder: vi.fn(),
  loadNext: vi.fn(),
  saveNext: vi.fn(),
  removeFromNext: vi.fn(),
}))

vi.mock('../src/data/games.js', () => ({
  storefronts: [
    { id: 'nintendo', label: 'Nintendo' },
    { id: 'steam', label: 'Steam' },
  ],
  availablePlatforms: [
    { id: 'switch', label: 'Switch' },
    { id: 'pc', label: 'PC' },
  ],
}))

vi.mock('../src/data/platformLogos.js', () => ({
  getPlatformLogo: vi.fn(() => null),
}))
