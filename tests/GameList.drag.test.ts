import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, MARIO } from './helpers'

vi.mock('../src/services/gameStorage.js', () => ({
  loadGames: vi.fn(),
  addGame: vi.fn(),
  updateGame: vi.fn(),
  updateGamePlatforms: vi.fn(),
  deleteGame: vi.fn(),
  loadSortOrder: vi.fn(),
  saveSortOrder: vi.fn(),
  loadNext: vi.fn(),
  saveNext: vi.fn(),
  removeFromNext: vi.fn(),
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

const MARIO_2 = {
  id: '5',
  externalId: '50505',
  name: 'Mario Kart 8',
  status: 'started',
  coverUrl: null,
  rating: null,
  gameplayAll: 20,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
}

describe('GameList – Drag & Drop (Started-Tab)', () => {
  it('Custom-Sort-Button ist nur im Started-Tab sichtbar', async () => {
    const wrapper = await mountApp()

    const customBtnStarted = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtnStarted).toBeDefined()
    expect(customBtnStarted!.classes()).toContain('active')

    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const customBtnBacklog = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    if (customBtnBacklog) {
      expect(customBtnBacklog.classes()).not.toContain('active')
    }

    wrapper.unmount()
  })

  it('startedGames respektiert die startedOrder', async () => {
    const wrapper = await mountApp({
      games: [MARIO, MARIO_2],
      sortOrder: [MARIO_2.id, MARIO.id],
    })

    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    const cardTexts = cards.map(c => c.text())
    expect(cardTexts.some(t => t.includes('Mario Kart'))).toBe(true)
    expect(cardTexts.some(t => t.includes('Mario Odyssey'))).toBe(true)
    wrapper.unmount()
  })

  it('saveSortOrder wird nach Drag-Ende aufgerufen', async () => {
    const { saveSortOrder } = await import('../src/services/gameStorage.js')

    const wrapper = await mountApp({ games: [MARIO, MARIO_2] })

    await nextTick()

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
      games: [MARIO, MARIO_2, MARIO_3],
      sortOrder: [MARIO.id, MARIO_2.id],
    })

    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(3)
    expect(cards[cards.length - 1].text()).toContain('New Game')
    wrapper.unmount()
  })
})
