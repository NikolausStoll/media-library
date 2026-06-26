import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import {
  mountSeriesApp,
  BREAKING_BAD,
  THE_OFFICE,
  SAMPLE_EPISODES,
  clickMediaTab,
  mediaTabCount,
} from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
})

function watchlistSeries(id: string, title: string) {
  return {
    id,
    externalId: id,
    title,
    titleDe: title,
    status: 'watchlist',
    year: '2020',
    imageUrl: null,
    rating: 8,
    runtime: 45,
    seasonCount: 1,
    episodeCount: 10,
    genres: ['Drama'],
    streamingProviders: [],
    userRating: null,
    providers: [],
  }
}

async function openEpisodesTab(wrapper: Awaited<ReturnType<typeof mountSeriesApp>>, title: string) {
  const card = wrapper.findAll('.game-card').find(c => c.text().includes(title))
  expect(card).toBeDefined()
  await card!.trigger('click')
  await flushPromises()
  await nextTick()

  const episodesTab = wrapper.find('.overlay').findAll('button.tab')
    .find(b => b.text().includes('Episodes'))
  expect(episodesTab).toBeDefined()
  await episodesTab!.trigger('click')
  await nextTick()
}

describe('SeriesList – Tabs', () => {
  it('zeigt Watching- und Watchlist-Tabs', async () => {
    const wrapper = await mountSeriesApp()

    expect(wrapper.text()).toContain('Watching')
    expect(wrapper.text()).toContain('Watchlist')
    expect(wrapper.text()).toContain('Finished')
    expect(wrapper.text()).toContain('Dropped')

    wrapper.unmount()
  })

  it('Watching-Tab zeigt laufende Serien', async () => {
    const wrapper = await mountSeriesApp()

    expect(wrapper.text()).toContain('Breaking Bad')
    expect(wrapper.text()).not.toContain('The Office')

    wrapper.unmount()
  })

  it('Watchlist-Tab zeigt Watchlist-Serien', async () => {
    const wrapper = await mountSeriesApp()
    await clickMediaTab(wrapper, 'Watchlist')

    expect(wrapper.text()).toContain('The Office')
    expect(wrapper.text()).not.toContain('Breaking Bad')

    wrapper.unmount()
  })

  it('Watchlist-Count ist korrekt', async () => {
    const wrapper = await mountSeriesApp()
    expect(mediaTabCount(wrapper, 'Watchlist')).toBe(1)
    wrapper.unmount()
  })
})

describe('SeriesList – Watch Next', () => {
  it('fügt Serie zu Watch Next hinzu', async () => {
    const { saveNext } = await import('../src/services/gameStorage.js')
    ;(saveNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountSeriesApp({ watchNext: [] })
    await clickMediaTab(wrapper, 'Watchlist')

    const officeCard = wrapper.findAll('.game-card').find(c => c.text().includes('The Office'))
    expect(officeCard).toBeDefined()

    const addBtn = officeCard!.find('.card-pn-btn:not(.pn-remove-btn)')
    await addBtn.trigger('click')
    await flushPromises()

    expect(saveNext).toHaveBeenCalledWith([THE_OFFICE.id], 'series')
    expect(wrapper.find('.play-next-section').text()).toContain('The Office')

    wrapper.unmount()
  })

  it('entfernt Serie aus Watch Next', async () => {
    const { removeFromNext } = await import('../src/services/gameStorage.js')
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountSeriesApp({ watchNext: [THE_OFFICE.id] })
    await clickMediaTab(wrapper, 'Watchlist')

    await wrapper.find('.play-next-section .pn-remove-btn').trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(THE_OFFICE.id, 'series')
    wrapper.unmount()
  })

  it('blockiert Watch Next ab 6 Einträgen', async () => {
    const series = Array.from({ length: 7 }, (_, i) => watchlistSeries(String(i + 1), `Show ${i + 1}`))
    const watchNext = series.slice(0, 6).map(s => s.id)

    const wrapper = await mountSeriesApp({ series, watchNext })
    await clickMediaTab(wrapper, 'Watchlist')

    expect(wrapper.findAll('.card-pn-btn:not(.pn-remove-btn)').length).toBe(0)
    wrapper.unmount()
  })

  it('entfernt Serie aus Watch Next bei Statuswechsel weg von Watchlist', async () => {
    const { updateSeries } = await import('../src/services/mediaStorage.js')
    const { removeFromNext } = await import('../src/services/gameStorage.js')
    ;(updateSeries as ReturnType<typeof vi.fn>).mockResolvedValue({ ...THE_OFFICE, status: 'watching' })
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountSeriesApp({ series: [THE_OFFICE], watchNext: [THE_OFFICE.id] })
    await clickMediaTab(wrapper, 'Watchlist')

    await wrapper.find('.game-card').trigger('click')
    await nextTick()

    const watchingBtn = wrapper.findAll('.status-btn').find(b => b.text().includes('Watching'))
    await watchingBtn!.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(THE_OFFICE.id, 'series')
    expect(updateSeries).toHaveBeenCalledWith(
      THE_OFFICE.id,
      expect.objectContaining({ status: 'watching' }),
    )

    wrapper.unmount()
  })
})

describe('SeriesList – Episode Tracking', () => {
  it('lädt Episoden beim Öffnen des Overlays', async () => {
    const { loadEpisodes, loadEpisodeProgress } = await import('../src/services/mediaStorage.js')

    const wrapper = await mountSeriesApp()
    await openEpisodesTab(wrapper, 'Breaking Bad')

    expect(loadEpisodes).toHaveBeenCalledWith(BREAKING_BAD.id)
    expect(loadEpisodeProgress).toHaveBeenCalledWith(BREAKING_BAD.id)
    expect(wrapper.find('.episode-row').exists()).toBe(true)
    expect(wrapper.text()).toContain('Pilot')

    wrapper.unmount()
  })

  it('toggle Episode ruft toggleEpisode auf und markiert Zeile', async () => {
    const { toggleEpisode } = await import('../src/services/mediaStorage.js')
    ;(toggleEpisode as ReturnType<typeof vi.fn>).mockResolvedValue({ watched: true })

    const wrapper = await mountSeriesApp()
    await openEpisodesTab(wrapper, 'Breaking Bad')

    const firstEpisode = wrapper.find('.episode-row input[type="checkbox"]')
    await firstEpisode.trigger('change')
    await flushPromises()

    expect(toggleEpisode).toHaveBeenCalledWith(BREAKING_BAD.id, 1, 1)
    expect(wrapper.find('.episode-row.watched').exists()).toBe(true)

    wrapper.unmount()
  })

  it('Season Bulk Toggle markiert alle Episoden einer Staffel', async () => {
    const { toggleSeason } = await import('../src/services/mediaStorage.js')
    ;(toggleSeason as ReturnType<typeof vi.fn>).mockResolvedValue([
      { season: 1, episode: 1 },
      { season: 1, episode: 2 },
    ])

    const wrapper = await mountSeriesApp()
    await openEpisodesTab(wrapper, 'Breaking Bad')

    const markAllBtn = wrapper.find('.season-toggle-btn')
    expect(markAllBtn.text()).toContain('Mark all')
    await markAllBtn.trigger('click')
    await flushPromises()

    expect(toggleSeason).toHaveBeenCalledWith(
      BREAKING_BAD.id,
      1,
      SAMPLE_EPISODES.filter(e => e.season === 1).map(e => e.episode),
      true,
    )
    expect(wrapper.findAll('.episode-row.watched').length).toBe(2)

    wrapper.unmount()
  })

  it('Season Bulk Toggle entfernt Fortschritt wenn Staffel komplett', async () => {
    const { toggleSeason } = await import('../src/services/mediaStorage.js')
    ;(toggleSeason as ReturnType<typeof vi.fn>).mockResolvedValue([])

    const wrapper = await mountSeriesApp({
      episodeProgress: [
        { season: 1, episode: 1 },
        { season: 1, episode: 2 },
      ],
    })
    await openEpisodesTab(wrapper, 'Breaking Bad')

    const completeBtn = wrapper.find('.season-toggle-btn')
    expect(completeBtn.text()).toContain('Complete')
    await completeBtn.trigger('click')
    await flushPromises()

    expect(toggleSeason).toHaveBeenCalledWith(
      BREAKING_BAD.id,
      1,
      SAMPLE_EPISODES.filter(e => e.season === 1).map(e => e.episode),
      false,
    )
    expect(wrapper.find('.episode-row.watched').exists()).toBe(false)

    wrapper.unmount()
  })
})

describe('SeriesList – Card Progress', () => {
  it('zeigt Fortschritt aus progress-summary auf der Karte', async () => {
    const wrapper = await mountSeriesApp({
      progressSummary: { [BREAKING_BAD.id]: 5 },
    })

    expect(wrapper.text()).toContain('5/62')

    wrapper.unmount()
  })
})
