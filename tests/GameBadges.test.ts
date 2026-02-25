import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { mountApp, ZELDA, MARIO } from './helpers'

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

describe('GameBadges', () => {
  // ── Play-Next Badge ───────────────────────────────────────────────────────

  it('zeigt Play-Next-Badge wenn Spiel in playNextList ist', async () => {
    const wrapper = await mountApp({ playNext: [ZELDA.id] })

    // Zu Backlog wechseln (ZELDA ist in backlog, PlayNext ist dort sichtbar)
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    // PlayNext-Sektion sollte sichtbar sein
    const playNextSection = wrapper.find('.play-next-section')
    expect(playNextSection.exists()).toBe(true)
    expect(playNextSection.text()).toContain('Zelda')
    wrapper.unmount()
  })

  it('Normal-Backlog-Karten sind NICHT in der Play-Next-Sektion', async () => {
    const wrapper = await mountApp({ playNext: [ZELDA.id] })

    // Zu Backlog wechseln
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    const playNextSection = wrapper.find('.play-next-section')
    expect(playNextSection.text()).not.toContain('Metroid')
    wrapper.unmount()
  })

  it('Play-Next-Sektion ist leer wenn playNextList leer ist', async () => {
    const wrapper = await mountApp({ playNext: [] })

    const cards = wrapper.findAll('.play-next .game-card, .play-next-list .game-card')
    expect(cards.length).toBe(0)
    wrapper.unmount()
  })

  // ── statusCounts ─────────────────────────────────────────────────────────

  it('statusCounts für Started-Tab enthält shelved-Spiele', async () => {
    const shelvedGame = { ...MARIO, id: '4', status: 'shelved', name: 'Shelved Game' }
    const wrapper = await mountApp({ games: [ZELDA, MARIO, shelvedGame] })

    const startedTab = wrapper.findAll('button').find(b => b.text().includes('Started'))
    // Tab sollte 2 anzeigen (1× started + 1× shelved)
    expect(startedTab!.text()).toMatch(/2/)
    wrapper.unmount()
  })

  it('Backlog-Count entspricht Anzahl der Backlog-Spiele', async () => {
    const wrapper = await mountApp({ games: [ZELDA, MARIO] })
    // Nur ZELDA ist backlog → Count = 1
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    expect(backlogTab!.text()).toMatch(/1/)
    wrapper.unmount()
  })

  // ── Cover-Fallback ────────────────────────────────────────────────────────

  it('zeigt Fallback wenn coverUrl null ist', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })

    // Zu Backlog wechseln (ZELDA ist in backlog)
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    // kein img mit src gesetzt oder Placeholder-Element vorhanden
    const imgs = wrapper.findAll('.game-card img')
    imgs.forEach(img => {
      const src = img.attributes('src')
      expect(src == null || src === '' || src.includes('placeholder')).toBe(true)
    })
    wrapper.unmount()
  })

  // ── Platform-Label ────────────────────────────────────────────────────────

  it('zeigt Platform-Label auf der Game-Card', async () => {
    const wrapper = await mountApp({ games: [ZELDA] })

    // Zu Backlog wechseln (ZELDA ist in backlog)
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    // Switch oder Nintendo sollte auf der Card erscheinen
    const card = wrapper.find('.game-card')
    expect(card.text()).toMatch(/Switch|Nintendo/i)
    wrapper.unmount()
  })
})
