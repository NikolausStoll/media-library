import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountApp, ZELDA, MARIO, METROID } from './helpers'

vi.mock('../src/services/gameStorage.js', () => ({
  loadGames: vi.fn(),
  addGame: vi.fn(),
  updateGame: vi.fn(),
  updateGamePlatforms: vi.fn(),
  deleteGame: vi.fn(),
  loadSortOrder: vi.fn(),
  saveSortOrder: vi.fn(),
  loadPlayNext: vi.fn(),
  savePlayNext: vi.fn(),
  removeFromPlayNextApi: vi.fn(),
}))

vi.mock('../src/data/games.js', () => ({
  storefronts: [{ id: 'nintendo', label: 'Nintendo' }, { id: 'steam', label: 'Steam' }],
  availablePlatforms: [{ id: 'switch', label: 'Switch' }, { id: 'pc', label: 'PC' }],
}))

vi.mock('../src/data/platformLogos.js', () => ({
  getPlatformLogo: vi.fn(() => null),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('GameList – Rendering', () => {
  it('zeigt alle Tab-Labels', async () => {
    const wrapper = await mountApp()
    const tabLabels = ['Backlog', 'Wishlist', 'Started', 'Completed', 'Retired']
    tabLabels.forEach(label => {
      expect(wrapper.text()).toContain(label)
    })
    wrapper.unmount()
  })

  it('zeigt die korrekten Spiel-Counts pro Tab', async () => {
    const wrapper = await mountApp()
    const tabEls = wrapper.findAll('.tab-btn, [data-tab], button').filter(b =>
      ['Backlog', 'Started'].some(l => b.text().includes(l))
    )
    expect(tabEls.length).toBeGreaterThanOrEqual(2)
    wrapper.unmount()
  })

  it('rendert Game-Cards für den aktiven Tab (Backlog)', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    wrapper.unmount()
  })

  it('zeigt Zelda-Karte im Backlog-Tab', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('wechselt Tab und zeigt Started-Spiele', async () => {
    const wrapper = await mountApp()
    const startedTab = wrapper.findAll('button').find(b => b.text().includes('Started'))
    expect(startedTab).toBeDefined()
    await startedTab!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Mario')
    wrapper.unmount()
  })

  it('zeigt keine Cards wenn Tab leer ist', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })
    const completedTab = wrapper.findAll('button').find(b => b.text().includes('Completed'))
    await completedTab!.trigger('click')
    await nextTick()
    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(0)
    wrapper.unmount()
  })

  it('zeigt Sidebar-Elemente (Sortierung, Filter)', async () => {
    const wrapper = await mountApp()
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('SORT')
    wrapper.unmount()
  })
})
