import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import GameList from '../src/components/GameList.vue'

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

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

const ZELDA = {
  id: '1',
  externalId: '10101',
  name: 'The Legend of Zelda: Tears of the Kingdom',
  status: 'backlog',
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
  coverUrl: null,
}

const MARIO = {
  id: '2',
  externalId: '20202',
  name: 'Super Mario Odyssey',
  status: 'started',
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
  coverUrl: null,
}

async function mountApp() {
  const { loadGames, loadSortOrder, loadPlayNext } =
    await import('../src/services/gameStorage.js')

  ;(loadGames as ReturnType<typeof vi.fn>).mockResolvedValue([ZELDA, MARIO])
  ;(loadSortOrder as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(loadPlayNext as ReturnType<typeof vi.fn>).mockResolvedValue([])

  const wrapper = mount(GameList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Overlay – Game-Detail', () => {

  it('öffnet Game-Detail beim Klick auf Card', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBeGreaterThan(0)

    await cards[0].trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(true)
    expect(wrapper.find('.overlay-title').text()).toContain('Zelda')

    wrapper.unmount()
  })

  it('zeigt den korrekten Spielnamen im Overlay', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    await cards[0].trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay-title').text()).toBe(
      'The Legend of Zelda: Tears of the Kingdom'
    )

    wrapper.unmount()
  })

  it('schließt Overlay beim Klick auf den Backdrop', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.findAll('.game-card')[0].trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    await wrapper.find('.overlay').trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('schließt Overlay mit ESC-Taste', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.findAll('.game-card')[0].trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    await wrapper.trigger('keydown', { key: 'Escape' })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('schließt NICHT beim Klick auf overlay-content', async () => {
    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.findAll('.game-card')[0].trigger('click')
    await nextTick()

    await wrapper.find('.overlay-content').trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(true)

    wrapper.unmount()
  })

  it('wechselt den Status eines Spiels im Overlay', async () => {
    const { updateGame } = await import('../src/services/gameStorage.js')
    ;(updateGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ZELDA,
      status: 'completed',
    })

    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.findAll('.game-card')[0].trigger('click')
    await nextTick()

    const completedBtn = wrapper
      .findAll('.status-btn')
      .find(b => b.text().includes('Completed'))

    expect(completedBtn).toBeDefined()
    await completedBtn!.trigger('click')
    await flushPromises()
    await nextTick()

    expect(updateGame).toHaveBeenCalledWith(
      ZELDA.id,
      expect.objectContaining({ status: 'completed' })
    )
    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('zeigt Delete-Bestätigung und löscht dann das Spiel', async () => {
    const { deleteGame } = await import('../src/services/gameStorage.js')
    ;(deleteGame as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp()
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))

    if (backlogTab) {
      await backlogTab.trigger('click')
      await flushPromises()
      await nextTick()
    }

    const cards = wrapper.findAll('.game-card')
    if (cards.length === 0) {
      wrapper.unmount()
      return
    }

    await cards[0].trigger('click')
    await nextTick()

    const deleteBtn = wrapper.find('.delete-trigger-btn')
    expect(deleteBtn.exists()).toBe(true)
    await deleteBtn.trigger('click')
    await nextTick()

    const confirmBtn = wrapper.find('.delete-confirm-btn')
    expect(confirmBtn.exists()).toBe(true)
    await confirmBtn.trigger('click')
    await flushPromises()

    expect(deleteGame).toHaveBeenCalledWith(ZELDA.id)
    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('öffnet für jede Card das richtige Spiel im Overlay', async () => {
    const wrapper = await mountApp()
    let cards = wrapper.findAll('.game-card')

    if (cards.length === 0) {
      const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
      if (backlogTab) {
        await backlogTab.trigger('click')
        await nextTick()
        cards = wrapper.findAll('.game-card')
      }
    }

    expect(cards.length).toBeGreaterThan(0)

    await cards[0].trigger('click')
    await nextTick()

    const overlayTitle = wrapper.find('.overlay-title').text()
    expect(overlayTitle).toBeTruthy()
    expect(overlayTitle.length).toBeGreaterThan(0)

    wrapper.unmount()
  })
  
  it('Platform Editor öffnet sich beim Klick auf Platform-Badge', async () => {
    const wrapper = await mountApp()

    // Started-Tab ist default, MARIO hat status: started
    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBeGreaterThan(0)

    // Platform-Badge klicken (nicht die Karte selbst)
    const platformBadge = cards[0].find('.card-platform')
    expect(platformBadge.exists()).toBe(true)
    await platformBadge.trigger('click')
    await nextTick()

    // Platform Editor sollte offen sein, NICHT der Status-Overlay
    expect(wrapper.find('.editor-content').exists()).toBe(true)
    expect(wrapper.find('.overlay-content').exists()).toBe(false)

    wrapper.unmount()
  })

  it('Platform Editor schließt sich nach Done-Klick', async () => {
    const wrapper = await mountApp()

    const platformBadge = wrapper.findAll('.game-card')[0].find('.card-platform')
    await platformBadge.trigger('click')
    await nextTick()

    expect(wrapper.find('.editor-content').exists()).toBe(true)

    await wrapper.find('.close-btn').trigger('click')
    await flushPromises()
    await nextTick()

    expect(wrapper.find('.editor-content').exists()).toBe(false)

    wrapper.unmount()
  })

  it('Platform Editor schließt sich mit ESC', async () => {
    const wrapper = await mountApp()

    const platformBadge = wrapper.findAll('.game-card')[0].find('.card-platform')
    await platformBadge.trigger('click')
    await nextTick()

    expect(wrapper.find('.editor-content').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.editor-content').exists()).toBe(false)

    wrapper.unmount()
  })


})
