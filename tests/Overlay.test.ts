import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { mountApp, ZELDA, clickTab } from './helpers'

global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [],
})

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('Overlay – Game-Detail', () => {

  it('öffnet Game-Detail beim Klick auf Card', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    expect(wrapper.find('.overlay').exists()).toBe(false)

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    expect(zeldaCard).toBeDefined()

    await zeldaCard!.trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(true)
    expect(wrapper.find('.overlay-title').text()).toContain('Zelda')

    wrapper.unmount()
  })

  it('zeigt den korrekten Spielnamen im Overlay', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    expect(zeldaCard).toBeDefined()
    await zeldaCard!.trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay-title').text()).toBe(
      'The Legend of Zelda: Tears of the Kingdom',
    )

    wrapper.unmount()
  })

  it('zeigt Cover und Aktionen auf Options sowie HLTB-Profilinfos auf Details', async () => {
    const game = {
      ...ZELDA,
      imageFullUrl: '/uploads/images/games/zelda.webp',
      gameplayMain: 50,
      gameplayExtra: 75,
      gameplayComplete: 120,
      gameplayAll: 80,
      summary: 'A large adventure.',
      platform: 'Switch, PC',
      genre: 'Adventure',
      developer: 'Nintendo',
      publisher: 'Nintendo',
      releaseDateEu: '2017-03-03',
      hltbFetchedAt: '2026-08-27T12:30:00.000Z',
    }
    const wrapper = await mountApp({ games: [game] })
    await clickTab(wrapper, 'Collection')

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    expect(wrapper.find('.game-options-top').exists()).toBe(true)
    expect(wrapper.find('.options-cover img').attributes('src')).toBe(game.imageFullUrl)
    expect(wrapper.find('.game-options-actions .status-btn').exists()).toBe(true)
    expect(wrapper.find('.game-options-actions .overlay-section-label').text()).toBe('Status')

    await wrapper.findAll('.tab').find(button => button.text() === 'Details')!.trigger('click')
    await nextTick()

    expect(wrapper.find('.metric-box-all').text()).toContain('80 h')
    expect(wrapper.find('.metric-row').text()).toContain('Main + Sides')
    expect(wrapper.find('.hltb-description').text()).toContain(game.summary)
    expect(wrapper.find('.hltb-fields').text()).toContain('Nintendo')
    expect(wrapper.find('.hltb-fields').text()).toContain(game.platform)
    expect(wrapper.find('.detail-section-title').text()).toContain('HowLongToBeat')
    expect(wrapper.find('.hltb-fields').text()).toContain('HLTB abgerufen')
    expect(wrapper.find('.hltb-fields').text()).not.toContain('EU')

    wrapper.unmount()
  })

  it('schließt Overlay beim Klick auf den Backdrop', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    await zeldaCard!.trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    await wrapper.find('.overlay').trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('schließt Overlay mit ESC-Taste', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    await zeldaCard!.trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('schließt NICHT beim Klick auf overlay-content', async () => {
    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    await zeldaCard!.trigger('click')
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
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    await zeldaCard!.trigger('click')
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
      expect.objectContaining({ status: 'completed' }),
    )
    expect(wrapper.find('.overlay').exists()).toBe(false)

    wrapper.unmount()
  })

  it('zeigt Delete-Bestätigung und löscht dann das Spiel', async () => {
    const { deleteGame } = await import('../src/services/gameStorage.js')
    ;(deleteGame as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp()
    await clickTab(wrapper, 'Collection')

    const cards = wrapper.findAll('.game-card')
    const zeldaCard = cards.find(c => c.text().includes('Zelda'))
    expect(zeldaCard).toBeDefined()

    await zeldaCard!.trigger('click')
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

  it('öffnet für Started-Card das richtige Spiel im Overlay', async () => {
    const wrapper = await mountApp()

    const marioCard = wrapper.findAll('.game-card').find(c => c.text().includes('Mario Odyssey'))
    expect(marioCard).toBeDefined()

    await marioCard!.trigger('click')
    await nextTick()

    expect(wrapper.find('.overlay-title').text()).toBe('Super Mario Odyssey')

    wrapper.unmount()
  })

  it('Platform Editor öffnet sich beim Klick auf Platform-Badge', async () => {
    const wrapper = await mountApp()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBeGreaterThan(0)

    const platformBadge = cards[0].find('.card-platform')
    expect(platformBadge.exists()).toBe(true)
    await platformBadge.trigger('click')
    await nextTick()

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
