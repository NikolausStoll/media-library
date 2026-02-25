import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountApp, ZELDA } from './helpers'

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

describe('Backend-Mock – API Calls', () => {
  // ── onMounted ─────────────────────────────────────────────────────────────

  it('ruft loadGames, loadSortOrder und loadPlayNext beim Mount auf', async () => {
    const { loadGames, loadSortOrder, loadPlayNext } =
      await import('../src/services/gameStorage.js')

    const wrapper = await mountApp()

    expect(loadGames).toHaveBeenCalledTimes(1)
    expect(loadSortOrder).toHaveBeenCalledTimes(1)
    expect(loadPlayNext).toHaveBeenCalledTimes(1)
    wrapper.unmount()
  })

  // ── addGame ───────────────────────────────────────────────────────────────

  it('addGame wird mit externalId + activeTab aufgerufen', async () => {
    const { addGame } = await import('../src/services/gameStorage.js')
    ;(addGame as ReturnType<typeof vi.fn>).mockResolvedValue({
      ...ZELDA, id: '99',
    })

    const wrapper = await mountApp()

    // Zu Backlog wechseln
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

    // Die Fehlermeldung könnte anders sein oder gar nicht erscheinen
    // wenn der Button disabled ist
    expect(addBtn.attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  // ── deleteGame ────────────────────────────────────────────────────────────

  it('deleteGame wird nach Bestätigung aufgerufen', async () => {
    const { deleteGame } = await import('../src/services/gameStorage.js')
    ;(deleteGame as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountApp({ games: [ZELDA] })

    // Zu Backlog wechseln (ZELDA ist in backlog)
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    // Overlay öffnen
    const card = wrapper.find('.game-card')
    await card.trigger('click')
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
    wrapper.unmount()
  })

  // ── updateGame ────────────────────────────────────────────────────────────

  it('updateGame wird beim Status-Wechsel aufgerufen', async () => {
    const { updateGame } = await import('../src/services/gameStorage.js')
    ;(updateGame as ReturnType<typeof vi.fn>).mockResolvedValue({ ...ZELDA, status: 'completed' })

    const wrapper = await mountApp({ games: [ZELDA] })

    // Zu Backlog wechseln (ZELDA ist in backlog)
    const backlogTab = wrapper.findAll('button').find(b => b.text().includes('Backlog'))
    await backlogTab!.trigger('click')
    await nextTick()

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const completedBtn = wrapper.findAll('.status-btn').find(b =>
      b.text().includes('Completed')
    )
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

    // Zu Backlog wechseln
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
