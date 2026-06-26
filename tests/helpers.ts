import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { vi } from 'vitest'
import GameList from '../src/components/GameList.vue'
import BookList from '../src/components/BookList.vue'
import MovieList from '../src/components/MovieList.vue'
import SeriesList from '../src/components/SeriesList.vue'
import App from '../src/App.vue'
import {
  ZELDA, MARIO, METROID,   HOBBIT, DUNE, FOUNDATION, EBOOK_BOOK,
  INCEPTION, INTERSTELLAR, BREAKING_BAD, THE_OFFICE, PAUSED_SERIES, SAMPLE_EPISODES,
} from './fixtures'

export {
  ZELDA, MARIO, METROID, HOBBIT, DUNE, FOUNDATION, EBOOK_BOOK,
  INCEPTION, INTERSTELLAR, BREAKING_BAD, THE_OFFICE, PAUSED_SERIES, SAMPLE_EPISODES,
}

export function tabButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').find(b => b.text().includes(label))
}

export async function clickTab(wrapper: ReturnType<typeof mount>, label: string) {
  const tab = tabButton(wrapper, label)
  expect(tab).toBeDefined()
  await tab!.trigger('click')
  await nextTick()
}

export async function mountApp(overrides?: {
  games?: any[]
  sortOrder?: string[]
  playNext?: string[]
}) {
  const { loadGames, loadSortOrder, loadNext } =
    await import('../src/services/gameStorage.js')

  ;(loadGames as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.games ?? [ZELDA, MARIO, METROID])
  ;(loadSortOrder as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.sortOrder ?? [])
  ;(loadNext as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.playNext ?? [])

  const wrapper = mount(GameList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}

export async function mountBookApp(overrides?: {
  books?: any[]
  readNext?: string[]
}) {
  const { loadBooks, loadNext } = await import('../src/services/bookStorage.js')

  ;(loadBooks as ReturnType<typeof vi.fn>).mockResolvedValue(
    overrides?.books ?? [HOBBIT, DUNE, FOUNDATION],
  )
  ;(loadNext as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.readNext ?? [])

  const wrapper = mount(BookList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}

export function tabCount(wrapper: ReturnType<typeof mount>, label: string) {
  const tab = tabButton(wrapper, label)
  expect(tab).toBeDefined()
  const countEl = tab!.find('.tab-count')
  expect(countEl.exists()).toBe(true)
  return Number(countEl.text())
}

export function mediaTabButton(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button.tab').find(b => b.text().includes(label))
}

export async function clickMediaTab(wrapper: ReturnType<typeof mount>, label: string) {
  const tab = mediaTabButton(wrapper, label)
  expect(tab).toBeDefined()
  await tab!.trigger('click')
  await nextTick()
}

export function mediaTabCount(wrapper: ReturnType<typeof mount>, label: string) {
  const tab = mediaTabButton(wrapper, label)
  expect(tab).toBeDefined()
  const countEl = tab!.find('.tab-count')
  expect(countEl.exists()).toBe(true)
  return Number(countEl.text())
}

export async function mountMovieApp(overrides?: {
  movies?: any[]
  watchNext?: string[]
}) {
  const { loadMovies } = await import('../src/services/mediaStorage.js')
  const { loadNext } = await import('../src/services/gameStorage.js')

  ;(loadMovies as ReturnType<typeof vi.fn>).mockResolvedValue(
    overrides?.movies ?? [INCEPTION, INTERSTELLAR],
  )
  ;(loadNext as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.watchNext ?? [])

  const wrapper = mount(MovieList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}

export async function mountSeriesApp(overrides?: {
  series?: any[]
  watchNext?: string[]
  progressSummary?: Record<string, number>
  episodes?: any[]
  episodeProgress?: Array<{ season: number, episode: number }>
}) {
  const {
    loadSeries,
    loadEpisodes,
    loadEpisodeProgress,
    loadProgressSummary,
  } = await import('../src/services/mediaStorage.js')
  const { loadNext } = await import('../src/services/gameStorage.js')

  const seriesList = overrides?.series ?? [BREAKING_BAD, THE_OFFICE]

  ;(loadSeries as ReturnType<typeof vi.fn>).mockResolvedValue(seriesList)
  ;(loadNext as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.watchNext ?? [])
  ;(loadProgressSummary as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.progressSummary ?? {})
  ;(loadEpisodes as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.episodes ?? SAMPLE_EPISODES)
  ;(loadEpisodeProgress as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.episodeProgress ?? [])

  const wrapper = mount(SeriesList, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}

export async function mountAppShell(overrides?: {
  mediaType?: string
  games?: any[]
  books?: any[]
  movies?: any[]
  series?: any[]
}) {
  if (overrides?.mediaType) {
    localStorage.setItem('mediaType', overrides.mediaType)
  }

  const { loadGames, loadSortOrder, loadNext } = await import('../src/services/gameStorage.js')
  const { loadBooks, loadNext: loadBookNext } = await import('../src/services/bookStorage.js')
  const { loadMovies, loadSeries, loadProgressSummary, loadEpisodes, loadEpisodeProgress } =
    await import('../src/services/mediaStorage.js')

  ;(loadGames as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.games ?? [ZELDA, MARIO])
  ;(loadSortOrder as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(loadNext as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(loadBooks as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.books ?? [HOBBIT])
  ;(loadBookNext as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(loadMovies as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.movies ?? [INCEPTION])
  ;(loadSeries as ReturnType<typeof vi.fn>).mockResolvedValue(overrides?.series ?? [BREAKING_BAD])
  ;(loadProgressSummary as ReturnType<typeof vi.fn>).mockResolvedValue({})
  ;(loadEpisodes as ReturnType<typeof vi.fn>).mockResolvedValue(SAMPLE_EPISODES)
  ;(loadEpisodeProgress as ReturnType<typeof vi.fn>).mockResolvedValue([])

  const wrapper = mount(App, { attachTo: document.body })
  await flushPromises()
  await nextTick()
  return wrapper
}
