import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, ZELDA, MARIO, clickTab } from './helpers'

const WISHLIST_GAME = {
  ...ZELDA,
  id: '99',
  externalId: '99999',
  name: 'Wishlist Only Game',
  status: 'wishlist',
}

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('GameList – Wishlist & All tab', () => {
  it('Wishlist-Tab zeigt nur Wishlist-Spiele', async () => {
    const wrapper = await mountApp({ games: [WISHLIST_GAME, ZELDA] })
    await clickTab(wrapper, 'Wishlist')

    expect(wrapper.text()).toContain('Wishlist Only')
    expect(wrapper.text()).not.toContain('Zelda')

    wrapper.unmount()
  })

  it('All-Tab schließt Wishlist-Spiele aus', async () => {
    const wrapper = await mountApp({ games: [WISHLIST_GAME, ZELDA, MARIO] })
    await clickTab(wrapper, 'All')

    expect(wrapper.text()).toContain('Zelda')
    expect(wrapper.text()).not.toContain('Wishlist Only')

    wrapper.unmount()
  })
})

describe('GameList – Overlay actions', () => {
  it('setzt User Rating über updateGame', async () => {
    const { updateGame } = await import('../src/services/gameStorage.js')
    ;(updateGame as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ZELDA, userRating: 8 })

    const wrapper = await mountApp({ games: [ZELDA] })
    await clickTab(wrapper, 'Collection')

    const zeldaCard = wrapper.findAll('.game-card').find(c => c.text().includes('Zelda'))
    await zeldaCard!.trigger('click')
    await nextTick()

    const ratingBtn = wrapper.findAll('.tag-btn').find(b => b.text() === '8')
    expect(ratingBtn).toBeDefined()
    await ratingBtn!.trigger('click')
    await flushPromises()

    expect(updateGame).toHaveBeenCalledWith(ZELDA.id, { userRating: 8 })
    wrapper.unmount()
  })

  it('toggelt Tags über updateGameTags', async () => {
    const { updateGameTags } = await import('../src/services/gameStorage.js')
    ;(updateGameTags as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ZELDA, tags: ['physical'] })

    const wrapper = await mountApp({ games: [{ ...ZELDA, tags: [] }] })
    await clickTab(wrapper, 'Collection')

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const physicalBtn = wrapper.findAll('.tag-btn').find(b => b.text() === 'Physical')
    expect(physicalBtn).toBeDefined()
    await physicalBtn!.trigger('click')
    await flushPromises()

    expect(updateGameTags).toHaveBeenCalledWith(ZELDA.id, ['physical'])
    wrapper.unmount()
  })

  it('speichert Platform Editor über updateGamePlatforms', async () => {
    const { updateGamePlatforms } = await import('../src/services/gameStorage.js')
    ;(updateGamePlatforms as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...MARIO,
      platforms: [{ platform: 'pc', storefront: 'steam' }],
    })

    const wrapper = await mountApp({ games: [MARIO] })

    const platformBadge = wrapper.find('.game-card .card-platform')
    await platformBadge.trigger('click')
    await nextTick()

    const addSelect = wrapper.find('.add-platform-select')
    await addSelect.setValue('pc')
    await addSelect.trigger('change')
    await nextTick()

    await wrapper.find('.close-btn').trigger('click')
    await flushPromises()

    expect(updateGamePlatforms).toHaveBeenCalledWith(
      MARIO.id,
      expect.arrayContaining([expect.objectContaining({ platform: 'pc' })]),
    )
    wrapper.unmount()
  })
})

describe('GameList – Search overlay ESC priority', () => {
  it('schließt zuerst Search Overlay, Detail-Overlay bleibt offen', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })
    await clickTab(wrapper, 'Collection')

    await wrapper.find('.game-card').trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay-content').exists()).toBe(true)

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('.search-overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.search-overlay').exists()).toBe(false)
    expect(wrapper.find('.overlay-content').exists()).toBe(true)

    wrapper.unmount()
  })
})
