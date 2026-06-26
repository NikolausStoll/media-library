import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountApp, ZELDA, MARIO, METROID, clickTab } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Filters & Sortierung', () => {
  it('Platform-Filter "Switch" zeigt nur Switch-Spiele im Collection', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

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
    await clickTab(wrapper, 'Collection')

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
    await clickTab(wrapper, 'Collection')

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
    await clickTab(wrapper, 'Collection')

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('zelda')
    await nextTick()

    expect(wrapper.findAll('.game-card').length).toBe(1)
    expect(wrapper.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Fuzzy-Suche filtert nicht passende Spiele heraus', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

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
    await clickTab(wrapper, 'Collection')

    const searchInput = wrapper.find('.search-input')
    await searchInput.setValue('ZELDA')
    await nextTick()

    expect(wrapper.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Name-Sort: erster Klick → A→Z', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    expect(cards[0].text()).toContain('Metroid')
    expect(cards[1].text()).toContain('Zelda')

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()

    const descCards = wrapper.findAll('.game-card')
    expect(descCards[0].text()).toContain('Zelda')
    expect(descCards[1].text()).toContain('Metroid')
    wrapper.unmount()
  })

  it('Name-Sort: zweiter Klick togglet zurück auf A→Z', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()
    await nameBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    expect(cards[0].text()).toContain('Metroid')
    expect(cards[1].text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Wechsel zu "Started" Tab setzt sortBy auf custom', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const nameBtn = wrapper.findAll('button').find(b => b.text().includes('Name'))
    await nameBtn!.trigger('click')
    await nextTick()

    await clickTab(wrapper, 'Started')

    const customBtn = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtn?.classes()).toContain('active')
    wrapper.unmount()
  })

  it('Sidebar-Sections erscheinen in der richtigen Reihenfolge: Search → Sort → Filter', async () => {
    const wrapper = await mountApp()

    const sidebar = wrapper.find('.sidebar-content')
    expect(sidebar.exists()).toBe(true)

    const sections = sidebar.findAll('.sidebar-section-label')
    const labels = sections.map(s => s.text().trim().toUpperCase())

    const searchIdx  = labels.findIndex(l => l.includes('SEARCH'))
    const sortIdx    = labels.findIndex(l => l.includes('SORT'))
    const filterIdx  = labels.findIndex(l => l.includes('FILTER'))

    expect(searchIdx).toBeGreaterThanOrEqual(0)
    expect(sortIdx).toBeGreaterThanOrEqual(0)
    expect(filterIdx).toBeGreaterThanOrEqual(0)

    expect(searchIdx).toBeLessThan(sortIdx)
    expect(sortIdx).toBeLessThan(filterIdx)

    wrapper.unmount()
  })
})
