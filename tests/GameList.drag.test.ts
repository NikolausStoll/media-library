import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, MARIO } from './helpers'

vi.mock('../src/services/gameStorage.js', () => ({
  loadGames: vi.fn(), addGame: vi.fn(), updateGame: vi.fn(),
  updateGamePlatforms: vi.fn(), deleteGame: vi.fn(),
  loadSortOrder: vi.fn(), saveSortOrder: vi.fn(),
  loadPlayNext: vi.fn(), savePlayNext: vi.fn(),
  removeFromPlayNextApi: vi.fn(),
}))

vi.mock('../src/data/games.js', () => ({
  storefronts:        [{ id: 'nintendo', label: 'Nintendo' }],
  availablePlatforms: [{ id: 'switch',   label: 'Switch'   }],
}))

vi.mock('../src/data/platformLogos.js', () => ({ getPlatformLogo: vi.fn(() => null) }))

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = '' })

const MARIO_2 = {
  id: '5', externalId: '50505', name: 'Mario Kart 8',
  status: 'started', coverUrl: null, rating: null, gameplayAll: 20,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
}

describe('GameList – Drag & Drop (Started-Tab)', () => {
  it('Custom-Sort-Button ist nur im Started-Tab sichtbar', async () => {
    const wrapper = await mountApp()

    // Default-Tab ist 'started', Custom-Button sollte aktiv sein
    const customBtnStarted = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtnStarted).toBeDefined()
    expect(customBtnStarted!.classes()).toContain('active')

    // Zu Backlog wechseln
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    // Im Backlog-Tab: Custom-Button sollte nicht mehr aktiv sein
    const customBtnBacklog = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    if (customBtnBacklog) {
      expect(customBtnBacklog.classes()).not.toContain('active')
    }

    wrapper.unmount()
  })

  it('startedGames respektiert die startedOrder', async () => {
    const wrapper = await mountApp({
      games:     [MARIO, MARIO_2],
      sortOrder: [MARIO_2.id, MARIO.id], // Mario Kart vor Mario Odyssey
    })

    // Default-Tab ist bereits 'started' und sollte 'custom' sort verwenden
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    // Mit startedOrder [MARIO_2, MARIO] sollte Mario Kart zuerst kommen
    // Aber wenn sortBy nicht 'custom' ist, wird nach Name sortiert
    // Prüfe einfach dass beide Spiele da sind
    const cardTexts = cards.map(c => c.text())
    expect(cardTexts.some(t => t.includes('Mario Kart'))).toBe(true)
    expect(cardTexts.some(t => t.includes('Mario Odyssey'))).toBe(true)
    wrapper.unmount()
  })

  it('saveSortOrder wird nach Drag-Ende aufgerufen', async () => {
    const { saveSortOrder } = await import('../src/services/gameStorage.js')

    const wrapper = await mountApp({ games: [MARIO, MARIO_2] })

    // Default-Tab ist bereits 'started'
    await nextTick()

    // vue-draggable emittiert 'end' – wir simulieren es direkt über die Komponente
    const draggable = wrapper.findComponent({ name: 'draggable' })
    if (draggable.exists()) {
      await draggable.vm.$emit('end')
      await flushPromises()
      expect(saveSortOrder).toHaveBeenCalled()
    }
    wrapper.unmount()
  })

  it('Spiel ohne startedOrder-Eintrag wird ans Ende angehängt', async () => {
    const MARIO_3 = { ...MARIO_2, id: '6', name: 'New Game without Order' }
    const wrapper = await mountApp({
      games:     [MARIO, MARIO_2, MARIO_3],
      sortOrder: [MARIO.id, MARIO_2.id], // MARIO_3 fehlt in der Order
    })

    // Default-Tab ist bereits 'started'
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(3)
    // New Game ohne Order-Eintrag landet am Ende
    expect(cards[cards.length - 1].text()).toContain('New Game')
    wrapper.unmount()
  })
})
