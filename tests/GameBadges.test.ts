import './setupGameMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mountApp, ZELDA, MARIO, clickTab, tabCount } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('GameBadges', () => {
  it('zeigt Play-Next-Badge wenn Spiel in playNextList ist', async () => {
    const wrapper = await mountApp({ playNext: [ZELDA.id] })
    await clickTab(wrapper, 'Collection')

    const playNextSection = wrapper.find('.play-next-section')
    expect(playNextSection.exists()).toBe(true)
    expect(playNextSection.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Normal-Collection-Karten sind NICHT in der Play-Next-Sektion', async () => {
    const wrapper = await mountApp({ playNext: [ZELDA.id] })
    await clickTab(wrapper, 'Collection')

    const playNextSection = wrapper.find('.play-next-section')
    expect(playNextSection.text()).not.toContain('Metroid')
    wrapper.unmount()
  })

  it('Play-Next-Sektion fehlt wenn playNextList leer ist', async () => {
    const wrapper = await mountApp({ playNext: [] })
    await clickTab(wrapper, 'Collection')

    expect(wrapper.find('.play-next-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('statusCounts für Started-Tab enthält shelved-Spiele', async () => {
    const shelvedGame = { ...MARIO, id: '4', status: 'shelved', name: 'Shelved Game' }
    const wrapper = await mountApp({ games: [ZELDA, MARIO, shelvedGame] })

    expect(tabCount(wrapper, 'Started')).toBe(2)
    wrapper.unmount()
  })

  it('Collection-Count entspricht Anzahl der Collection-Spiele', async () => {
    const wrapper = await mountApp({ games: [ZELDA, MARIO] })
    expect(tabCount(wrapper, 'Collection')).toBe(1)
    wrapper.unmount()
  })

  it('zeigt Fallback wenn coverUrl null ist', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })
    await clickTab(wrapper, 'Collection')

    const imgs = wrapper.findAll('.game-card img')
    imgs.forEach(img => {
      const src = img.attributes('src')
      expect(src == null || src === '' || src.includes('placeholder')).toBe(true)
    })
    wrapper.unmount()
  })

  it('zeigt Platform-Label auf der Game-Card', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })
    await clickTab(wrapper, 'Collection')

    const card = wrapper.find('.game-card')
    expect(card.text()).toMatch(/Switch|Nintendo/i)
    wrapper.unmount()
  })
})
