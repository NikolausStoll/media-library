import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountMovieApp } from './helpers'

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('MovieList – TMDB Search Overlay', () => {
  it('sucht Filme und zeigt Ergebnisse', async () => {
    const { searchTmdb } = await import('../src/services/mediaStorage.js')
    ;(searchTmdb as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 603, titleEn: 'The Matrix', year: '1999', imageUrl: null },
    ])

    const wrapper = await mountMovieApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()

    const input = wrapper.find('.search-overlay .search-input')
    await input.setValue('Matrix')
    await wrapper.find('.hltb-search-btn').trigger('click')
    await flushPromises()
    await nextTick()

    expect(searchTmdb).toHaveBeenCalledWith('Matrix', 'movie')
    expect(wrapper.text()).toContain('The Matrix')

    wrapper.unmount()
  })

  it('schließt Search Overlay mit ESC', async () => {
    const wrapper = await mountMovieApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('.search-overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.search-overlay').exists()).toBe(false)
    wrapper.unmount()
  })
})
