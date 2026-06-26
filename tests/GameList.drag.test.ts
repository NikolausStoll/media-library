import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, MARIO, clickTab } from './helpers'

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
  imageUrl: null,
  rating: null,
  gameplayAll: 20,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
  tags: [],
}

describe('GameList – Drag & Drop (Started-Tab)', () => {
  it('Custom-Sort-Button ist nur im Started-Tab aktiv', async () => {
    const wrapper = await mountApp()

    const customBtnStarted = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtnStarted).toBeDefined()
    expect(customBtnStarted!.classes()).toContain('active')

    await clickTab(wrapper, 'Collection')

    const customBtnCollection = wrapper.findAll('button').find(b => b.text().includes('Custom'))
    expect(customBtnCollection).toBeUndefined()

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
    expect(cards[0].text()).toContain('Mario Kart')
    expect(cards[1].text()).toContain('Mario Odyssey')
    wrapper.unmount()
  })

  it('saveSortOrder wird nach Drag-Ende aufgerufen', async () => {
    const { saveSortOrder } = await import('../src/services/gameStorage.js')

    const wrapper = await mountApp({ games: [MARIO, MARIO_2] })

    await nextTick()

    const draggable = wrapper.findComponent({ name: 'draggable' })
    expect(draggable.exists()).toBe(true)
    await draggable.vm.$emit('end')
    await flushPromises()
    expect(saveSortOrder).toHaveBeenCalled()
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
