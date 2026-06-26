import './setupGameMocks'
import './setupBookMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountAppShell } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

beforeEach(() => {
  localStorage.setItem('mediaType', 'game')
})

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('App – Media Switcher', () => {
  it('startet mit GameList bei mediaType game', async () => {
    const wrapper = await mountAppShell({ mediaType: 'game' })

    expect(wrapper.text()).toContain('Collection')
    expect(wrapper.text()).toContain('Started')

    wrapper.unmount()
  })

  it('wechselt zu BookList', async () => {
    const wrapper = await mountAppShell({ mediaType: 'game' })

    const booksBtn = wrapper.find('[data-media="book"]')
    expect(booksBtn.exists()).toBe(true)
    await booksBtn.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).not.toContain('Collection')

    wrapper.unmount()
  })

  it('wechselt zu MovieList', async () => {
    const wrapper = await mountAppShell({ mediaType: 'game' })

    await wrapper.find('[data-media="movie"]').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Watchlist')
    expect(wrapper.text()).toContain('Inception')

    wrapper.unmount()
  })

  it('wechselt zu SeriesList', async () => {
    const wrapper = await mountAppShell({ mediaType: 'game' })

    await wrapper.find('[data-media="series"]').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Watching')
    expect(wrapper.text()).toContain('Breaking Bad')

    wrapper.unmount()
  })

  it('persistiert mediaType in localStorage', async () => {
    const wrapper = await mountAppShell({ mediaType: 'game' })

    await wrapper.find('[data-media="book"]').trigger('click')
    await nextTick()

    expect(localStorage.getItem('mediaType')).toBe('book')

    wrapper.unmount()
  })
})
