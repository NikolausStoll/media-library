import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import {
  mountSeriesApp,
  BREAKING_BAD,
  PAUSED_SERIES,
  clickMediaTab,
} from './helpers'

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('SeriesList – Filters & paused section', () => {
  it('zeigt pausierte Serien im Watching-Tab separat', async () => {
    const wrapper = await mountSeriesApp({
      series: [BREAKING_BAD, PAUSED_SERIES],
    })

    expect(wrapper.text()).toContain('Breaking Bad')
    expect(wrapper.text()).toContain('PAUSED')
    expect(wrapper.text()).toContain('Walking Dead')

    wrapper.unmount()
  })

  it('Genre-Filter zeigt nur passende Serien', async () => {
    const wrapper = await mountSeriesApp({
      series: [BREAKING_BAD, { ...PAUSED_SERIES, genres: ['Comedy'], title: 'Comedy Show' }],
    })

    const dramaBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Drama'))
    expect(dramaBtn).toBeDefined()
    await dramaBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Breaking Bad')
    expect(wrapper.text()).not.toContain('Comedy Show')

    wrapper.unmount()
  })

  it('Provider-Filter filtert nach Streaming-Anbieter', async () => {
    const noProvider = {
      ...BREAKING_BAD,
      id: '33',
      title: 'No Stream Show',
      streamingProviders: [],
    }

    const wrapper = await mountSeriesApp({
      series: [BREAKING_BAD, noProvider],
    })

    const netflixBtn = wrapper.findAll('.provider-logo-btn')
      .find(b => b.find('img[alt="Netflix"]').exists())
    expect(netflixBtn).toBeDefined()
    await netflixBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Breaking Bad')
    expect(wrapper.text()).not.toContain('No Stream Show')

    wrapper.unmount()
  })

  it('Dropped-Tab zeigt dropped Serien', async () => {
    const dropped = {
      ...BREAKING_BAD,
      id: '34',
      title: 'Dropped Show',
      status: 'dropped',
    }

    const wrapper = await mountSeriesApp({ series: [dropped, BREAKING_BAD] })
    await clickMediaTab(wrapper, 'Dropped')

    expect(wrapper.text()).toContain('Dropped Show')
    expect(wrapper.text()).not.toContain('Breaking Bad')

    wrapper.unmount()
  })
})
