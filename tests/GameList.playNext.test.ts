import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, ZELDA, MARIO, METROID, clickTab } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

function backlogGame(id: string, name: string) {
  return {
    id,
    externalId: id,
    name,
    status: 'backlog',
    coverUrl: null,
    imageUrl: null,
    rating: null,
    gameplayAll: null,
    platforms: [{ platform: 'switch', storefront: 'nintendo' }],
    tags: [],
  }
}

describe('GameList – Play Next', () => {
  it('fügt Spiel per Card-Button zu Play Next hinzu und ruft saveNext auf', async () => {
    const { saveNext } = await import('../src/services/gameStorage.js')
    ;(saveNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp({ playNext: [] })
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    expect(zeldaCard).toBeDefined()

    const addBtn = zeldaCard!.find('.card-pn-btn:not(.pn-remove-btn)')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()

    expect(saveNext).toHaveBeenCalledWith([ZELDA.id])
    expect(wrapper.find('.play-next-section').text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('entfernt Spiel aus Play Next und ruft removeFromNext auf', async () => {
    const { removeFromNext } = await import('../src/services/gameStorage.js')
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp({ playNext: [ZELDA.id] })
    await clickTab(wrapper, 'Collection')

    const removeBtn = wrapper.find('.play-next-section .pn-remove-btn')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(ZELDA.id)
    expect(wrapper.find('.play-next-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('blockiert Play Next ab 6 Einträgen', async () => {
    const games = Array.from({ length: 7 }, (_, i) =>
      backlogGame(String(i + 1), `Game ${i + 1}`),
    )
    const playNext = games.slice(0, 6).map(g => g.id)

    const wrapper = await mountApp({ games, playNext })
    await clickTab(wrapper, 'Collection')

    const addButtons = wrapper.findAll('.card-pn-btn:not(.pn-remove-btn)')
    expect(addButtons.length).toBe(0)
    wrapper.unmount()
  })

  it('entfernt Spiel aus Play Next bei Statuswechsel weg von Collection', async () => {
    const { updateGame, removeFromNext } = await import('../src/services/gameStorage.js')
    ;(updateGame as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ZELDA, status: 'started' })
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp({ games: [ZELDA], playNext: [ZELDA.id] })
    await clickTab(wrapper, 'Collection')

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const startedBtn = wrapper.findAll('.status-btn').find(b => b.text().includes('Started'))
    expect(startedBtn).toBeDefined()
    await startedBtn!.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(ZELDA.id)
    expect(updateGame).toHaveBeenCalledWith(
      ZELDA.id,
      expect.objectContaining({ status: 'started' }),
    )
    wrapper.unmount()
  })
})

describe('GameList – Collection label', () => {
  it('zeigt Collection statt Backlog in Tabs und Status-Overlay', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })
    await clickTab(wrapper, 'Collection')

    expect(wrapper.text()).toContain('Collection')
    expect(wrapper.text()).not.toMatch(/\bBacklog\b/)

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const statusLabels = wrapper.findAll('.status-btn').map(b => b.text())
    expect(statusLabels).toContain('Collection')
    expect(statusLabels).not.toContain('Backlog')

    wrapper.unmount()
  })
})
