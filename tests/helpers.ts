import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { vi } from 'vitest'
import GameList from '../src/components/GameList.vue'

export const ZELDA = {
  id: '1', externalId: '10101',
  name: 'The Legend of Zelda: Tears of the Kingdom',
  status: 'backlog', coverUrl: null, rating: null, gameplayAll: null,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
}

export const MARIO = {
  id: '2', externalId: '20202',
  name: 'Super Mario Odyssey',
  status: 'started', coverUrl: null, rating: 9, gameplayAll: 12,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
}

export const METROID = {
  id: '3', externalId: '30303',
  name: 'Metroid Dread',
  status: 'backlog', coverUrl: null, rating: null, gameplayAll: null,
  platforms: [{ platform: 'pc', storefront: 'steam' }],
}

export async function mountApp(overrides?: {
  games?: any[]
  sortOrder?: string[]
  playNext?: string[]
}) {
  const { loadGames, loadSortOrder, loadPlayNext } =
    await import('../src/services/gameStorage.js')

  ;(loadGames     as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.games     ?? [ZELDA, MARIO, METROID])
  ;(loadSortOrder as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.sortOrder ?? [])
  ;(loadPlayNext  as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.playNext  ?? [])

  const wrapper = mount(GameList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}
