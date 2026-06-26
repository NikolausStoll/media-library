import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountSeriesApp } from './helpers'

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('SeriesList – TMDB Search Overlay', () => {
  it('sucht Serien und zeigt Ergebnisse', async () => {
    const { searchTmdb } = await import('../src/services/mediaStorage.js')
    ;(searchTmdb as ReturnType<typeof vi.fn>).mockResolvedValue([
      { id: 1396, titleEn: 'Breaking Bad', year: '2008', imageUrl: null },
    ])

    const wrapper = await mountSeriesApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()

    const input = wrapper.find('.search-overlay .search-input')
    await input.setValue('Breaking')
    await wrapper.find('.hltb-search-btn').trigger('click')
    await flushPromises()
    await nextTick()

    expect(searchTmdb).toHaveBeenCalledWith('Breaking', 'series')
    expect(wrapper.text()).toContain('Breaking Bad')

    wrapper.unmount()
  })

  it('schließt Search Overlay mit ESC', async () => {
    const wrapper = await mountSeriesApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('.search-overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.search-overlay').exists()).toBe(false)
    wrapper.unmount()
  })
})
