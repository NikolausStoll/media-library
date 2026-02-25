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

describe('Filters & Sortierung', () => {
  it('Platform-Filter "Switch" zeigt nur Switch-Spiele im Backlog', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const switchBtn = wrapper.findAll('button').find(b => b.text().includes('Switch'))
    expect(switchBtn).toBeDefined()
    await switchBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(1)
    expect(wrapper.text()).toContain('Zelda')
    expect(wrapper.text()).not.toContain('Metroid')
    wrapper.unmount()
  })

  it('Storefront-Filter "Steam" filtert Nintendo-Spiele heraus', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const steamBtn = wrapper.findAll('button').find(b => b.text().includes('Steam'))
    expect(steamBtn).toBeDefined()
    await steamBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(1)
    expect(wrapper.text()).toContain('Metroid')
    expect(wrapper.text()).not.toContain('Zelda')
    wrapper.unmount()
  })

  it('Kombination Platform+Storefront gibt leere Liste wenn kein Match', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const switchBtn = wrapper.findAll('button').find(b => b.text().includes('Switch'))
    const steamBtn = wrapper.findAll('button').find(b => b.text().includes('Steam'))
    await switchBtn!.trigger('click')
    await steamBtn!.trigger('click')
    await nextTick()

    expect(wrapper.findAll('.game-card').length).toBe(0)
    wrapper.unmount()
  })

  it('Fuzzy-Suche findet Spiel mit Teilstring', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('zelda')
    await nextTick()

    expect(wrapper.findAll('.game-card').length).toBeGreaterThanOrEqual(1)
    expect(wrapper.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Fuzzy-Suche filtert nicht passende Spiele heraus', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('zelda')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Fuzzy-Suche ist case-insensitive', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('ZELDA')
    await nextTick()

    expect(wrapper.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Name-Sort: erster Klick → A→Z', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    const names = cards.map(c => c.text())
    expect(names.some(n => n.includes('Metroid'))).toBe(true)
    expect(names.some(n => n.includes('Zelda'))).toBe(true)
    wrapper.unmount()
  })

  it('Name-Sort: zweiter Klick togglet auf Z→A', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()
    const firstOrder = wrapper.findAll('.game-card').map(c => c.text())

    await nameBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    const secondOrder = cards.map(c => c.text())
    expect(secondOrder[0]).toBe(firstOrder[1])
    expect(secondOrder[1]).toBe(firstOrder[0])
    wrapper.unmount()
  })

  it('Wechsel zu "Started" Tab setzt sortBy auf custom', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()

    const startedTab = wrapper.findAll('button').find(b => b.text().includes('Started'))
    await startedTab!.trigger('click')
    await nextTick()

    const customBtn = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtn?.classes()).toContain('active')
    wrapper.unmount()
  })
})
