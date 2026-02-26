import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, ZELDA } from './helpers'

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
  storefronts: [{ id: 'nintendo', label: 'Nintendo' }],
  availablePlatforms: [{ id: 'switch', label: 'Switch' }],
}))

vi.mock('../src/data/platformLogos.js', () => ({
  getPlatformLogo: vi.fn(() => null),
}))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Search Overlay – addGame', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hltb/search')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: '99999', name: 'New Test Game', imageUrl: null }],
        })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })
  })

  it('addGame wird in aktive Liste eingefügt (primärer Button)', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')
    ;(addGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '99', externalId: '99999', name: 'New Test Game',
      status: 'started', platforms: [], coverUrl: null,
      rating: null, gameplayAll: null,
    })

    const wrapper = await mountApp()

    // Search Overlay öffnen
    const openBtn = wrapper.find('.search-open-btn')
    expect(openBtn.exists()).toBe(true)
    await openBtn.trigger('click')
    await nextTick()

    expect(wrapper.find('.search-overlay').exists()).toBe(true)

    // Suche ausführen
    const searchInput = wrapper.find('.search-overlay .search-input')
    await searchInput.setValue('New Test')
    await wrapper.find('.hltb-search-btn').trigger('click')
    await flushPromises()
    await nextTick()

    // Ergebnis-Karte prüfen
    const addBtn = wrapper.find('.search-result-add-btn.primary')
    expect(addBtn.exists()).toBe(true)

    await addBtn.trigger('click')
    await flushPromises()

    // addGame mit activeTab (started) aufgerufen
    expect(addGame).toHaveBeenCalledWith('99999', 'started', [])

    wrapper.unmount()
  })

  it('addGame wird in andere Liste eingefügt (Other-Dropdown)', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')
    ;(addGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '99', externalId: '99999', name: 'New Test Game',
      status: 'backlog', platforms: [], coverUrl: null,
      rating: null, gameplayAll: null,
    })

    const wrapper = await mountApp()

    // Search Overlay öffnen & suchen
    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    await wrapper.find('.search-overlay .search-input').setValue('New Test')
    await wrapper.find('.hltb-search-btn').trigger('click')
    await flushPromises()
    await nextTick()

    // "Other"-Dropdown auf backlog setzen
    const select = wrapper.find('.search-result-status-select')
    expect(select.exists()).toBe(true)
    await select.setValue('backlog')
    await select.trigger('change')
    await flushPromises()

    // addGame mit backlog aufgerufen
    expect(addGame).toHaveBeenCalledWith('99999', 'backlog', [])

    wrapper.unmount()
  })
})


describe('Backend-Mock – API Calls', () => {
  beforeEach(() => {
    global.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/hltb/search')) {
        return Promise.resolve({
          ok: true,
          json: async () => [{ id: '99999', name: 'New Test Game', imageUrl: null }],
        })
      }
      return Promise.resolve({ ok: true, json: async () => [] })
    })
  })
  it('ruft loadGames, loadSortOrder und loadPlayNext beim Mount auf', async () => {
    const { loadGames, loadSortOrder, loadPlayNext } =
      await import('../src/services/gameStorage.js')

    const wrapper = await mountApp()

    expect(loadGames).toHaveBeenCalledTimes(1)
    expect(loadSortOrder).toHaveBeenCalledTimes(1)
    expect(loadPlayNext).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  it('addGame wird mit externalId + activeTab aufgerufen', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')
    ;(addGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ZELDA,
      id: '99',
    })

    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const input = wrapper.find('.add-game-input')
    await input.setValue('99999')
    await nextTick()

    const addBtn = wrapper.find('.add-game-btn')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()

    expect(addGame).toHaveBeenCalledWith('99999', 'backlog', [])
    wrapper.unmount()
  })

  it('addGame wird NICHT aufgerufen wenn Input leer ist', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')

    const wrapper = await mountApp()

    const addBtn = wrapper.find('.add-game-btn')
    await addBtn.trigger('click')
    await flushPromises()

    expect(addGame).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('zeigt Fehlermeldung bei leerem Input', async () => {
    const wrapper = await mountApp()

    const addBtn = wrapper.find('.add-game-btn')
    await addBtn.trigger('click')
    await nextTick()

    expect(addBtn.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('deleteGame wird nach Bestätigung aufgerufen', async () => {
    const { deleteGame } = await import('../src/services/gameStorage.js')
    ;(deleteGame as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp()

    // Zum Backlog-Tab wechseln
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await flushPromises()
    await nextTick()

    // Alphabetisch ist Metroid vor Zelda – gezielt ZELDA per Name finden
    const cards = wrapper.findAll('.game-card')
    const zeldaCard = cards.find(c => c.text().includes('Zelda'))
    expect(zeldaCard).toBeDefined()

    await zeldaCard!.trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    await wrapper.find('.delete-trigger-btn').trigger('click')
    await nextTick()

    await wrapper.find('.delete-confirm-btn').trigger('click')
    await flushPromises()
    await nextTick()

    // ✅ API mit ZELDA-ID aufgerufen
    expect(deleteGame).toHaveBeenCalledWith('1')

    // ✅ Overlay geschlossen
    expect(wrapper.find('.overlay').exists()).toBe(false)

    // ✅ Zelda nicht mehr in der Liste
    const remainingCards = wrapper.findAll('.game-card')
    expect(remainingCards.every(c => !c.text().includes('Zelda'))).toBe(true)

    wrapper.unmount()
  })

  it('updateGame wird beim Status-Wechsel aufgerufen', async () => {
    const { updateGame } = await import('../src/services/gameStorage.js')
    ;(updateGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ZELDA,
      status: 'completed',
    })

    const wrapper = await mountApp({ games: [ZELDA] })
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const completedBtn = wrapper
      .findAll('.status-btn')
      .find(b => b.text().includes('Completed'))
    expect(completedBtn).toBeDefined()
    await completedBtn!.trigger('click')
    await flushPromises()

    expect(updateGame).toHaveBeenCalledWith(
      ZELDA.id,
      expect.objectContaining({ status: 'completed' })
    )
    wrapper.unmount()
  })

  it('addGame-Fehler zeigt Error-Message an', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')
    ;(addGame as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Server Error'))

    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const input = wrapper.find('.add-game-input')
    await input.setValue('12345')
    await nextTick()

    const addBtn = wrapper.find('.add-game-btn')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Server Error')
    wrapper.unmount()
  })
})
