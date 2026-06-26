import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import {
  mountMovieApp,
  INCEPTION,
  INTERSTELLAR,
  clickMediaTab,
  mediaTabCount,
} from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
})

function watchlistMovie(id: string, title: string) {
  return {
    id,
    externalId: id,
    title,
    titleDe: title,
    status: 'watchlist',
    year: '2020',
    imageUrl: null,
    rating: 7,
    runtime: 120,
    genres: ['Drama'],
    streamingProviders: [],
    userRating: null,
    releaseDateDe: '2020-01-01',
    providers: [],
  }
}

describe('MovieList – Tabs & Filter', () => {
  it('zeigt Watchlist- und Finished-Tabs', async () => {
    const wrapper = await mountMovieApp()

    expect(wrapper.text()).toContain('Watchlist')
    expect(wrapper.text()).toContain('Finished')
    expect(wrapper.text()).toContain('All')

    wrapper.unmount()
  })

  it('Watchlist-Tab zeigt nur watchlist-Filme', async () => {
    const wrapper = await mountMovieApp()

    expect(wrapper.text()).toContain('Inception')
    expect(wrapper.text()).not.toContain('Interstellar')

    wrapper.unmount()
  })

  it('Watchlist-Count ist korrekt', async () => {
    const wrapper = await mountMovieApp()
    expect(mediaTabCount(wrapper, 'Watchlist')).toBe(1)
    wrapper.unmount()
  })

  it('Genre-Filter zeigt nur passende Filme', async () => {
    const wrapper = await mountMovieApp()

    const actionBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Action'))
    expect(actionBtn).toBeDefined()
    await actionBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Inception')
    expect(wrapper.findAll('.game-card').length).toBe(1)

    wrapper.unmount()
  })

  it('Finished-Tab zeigt abgeschlossene Filme', async () => {
    const wrapper = await mountMovieApp()
    await clickMediaTab(wrapper, 'Finished')

    expect(wrapper.text()).toContain('Interstellar')
    expect(wrapper.text()).not.toContain('Inception')

    wrapper.unmount()
  })
})

describe('MovieList – Watch Next', () => {
  it('fügt Film zu Watch Next hinzu und ruft saveNext auf', async () => {
    const { saveNext } = await import('../src/services/gameStorage.js')
    ;(saveNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountMovieApp({ watchNext: [] })

    const inceptionCard = wrapper.findAll('.game-card').find(c => c.text().includes('Inception'))
    expect(inceptionCard).toBeDefined()

    const addBtn = inceptionCard!.find('.card-pn-btn:not(.pn-remove-btn)')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()

    expect(saveNext).toHaveBeenCalledWith([INCEPTION.id], 'movie')
    expect(wrapper.find('.play-next-section').text()).toContain('Inception')

    wrapper.unmount()
  })

  it('entfernt Film aus Watch Next und ruft removeFromNext auf', async () => {
    const { removeFromNext } = await import('../src/services/gameStorage.js')
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountMovieApp({ watchNext: [INCEPTION.id] })

    const removeBtn = wrapper.find('.play-next-section .pn-remove-btn')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(INCEPTION.id, 'movie')
    expect(wrapper.find('.play-next-section').exists()).toBe(false)

    wrapper.unmount()
  })

  it('blockiert Watch Next ab 6 Einträgen', async () => {
    const movies = Array.from({ length: 7 }, (_, i) => watchlistMovie(String(i + 1), `Movie ${i + 1}`))
    const watchNext = movies.slice(0, 6).map(m => m.id)

    const wrapper = await mountMovieApp({ movies, watchNext })

    const addButtons = wrapper.findAll('.card-pn-btn:not(.pn-remove-btn)')
    expect(addButtons.length).toBe(0)

    wrapper.unmount()
  })

  it('entfernt Film aus Watch Next bei Statuswechsel weg von Watchlist', async () => {
    const { updateMovie } = await import('../src/services/mediaStorage.js')
    const { removeFromNext } = await import('../src/services/gameStorage.js')
    ;(updateMovie as ReturnType<typeof vi.fn>).mockResolvedValue({ ...INCEPTION, status: 'finished' })
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountMovieApp({ movies: [INCEPTION], watchNext: [INCEPTION.id] })

    const card = wrapper.find('.play-next-section .game-card')
    expect(card.exists()).toBe(true)
    await card.trigger('click')
    await nextTick()
    await flushPromises()

    const finishedBtn = wrapper.findAll('.status-btn').find(b => b.text().includes('Finished'))
    expect(finishedBtn).toBeDefined()
    await finishedBtn!.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(INCEPTION.id, 'movie')
    expect(updateMovie).toHaveBeenCalledWith(
      INCEPTION.id,
      expect.objectContaining({ status: 'finished' }),
    )

    wrapper.unmount()
  })
})

describe('MovieList – Overlay', () => {
  it('öffnet und schließt Film-Overlay per ESC', async () => {
    const wrapper = await mountMovieApp()

    await wrapper.findAll('.game-card')[0].trigger('click')
    await nextTick()
    expect(wrapper.find('.overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)
    wrapper.unmount()
  })
})
