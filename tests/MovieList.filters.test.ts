import './setupGameMocks'
import './setupMediaMocks'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountMovieApp, INCEPTION, INTERSTELLAR, clickMediaTab } from './helpers'
afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('MovieList – Provider & sort', () => {
  it('Provider-Filter zeigt nur Netflix-Filme', async () => {
    const wrapper = await mountMovieApp()

    const netflixBtn = wrapper.findAll('.provider-logo-btn')
      .find(b => b.find('img[alt="Netflix"]').exists())
    expect(netflixBtn).toBeDefined()
    await netflixBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Inception')
    expect(wrapper.findAll('.game-card').length).toBe(1)

    wrapper.unmount()
  })

  it('Year-Sort startet absteigend und togglet aufsteigend', async () => {
    const wrapper = await mountMovieApp({
      movies: [INTERSTELLAR, INCEPTION],
      watchNext: [],
    })
    await clickMediaTab(wrapper, 'All')

    const yearBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Year'))
    expect(yearBtn).toBeDefined()
    await yearBtn!.trigger('click')
    await nextTick()

    let cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(2)
    expect(cards[0].text()).toContain('Interstellar')
    expect(cards[1].text()).toContain('Inception')

    await yearBtn!.trigger('click')
    await nextTick()

    cards = wrapper.findAll('.game-card')
    expect(cards[0].text()).toContain('Inception')
    expect(cards[1].text()).toContain('Interstellar')

    wrapper.unmount()
  })

  it('Rating-Sort togglet absteigend als Default', async () => {
    const wrapper = await mountMovieApp()
    await clickMediaTab(wrapper, 'All')

    const ratingBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Rating'))
    await ratingBtn!.trigger('click')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards[0].text()).toContain('Interstellar')

    wrapper.unmount()
  })
})

describe('MovieList – Not released section', () => {
  it('zeigt zukünftige Releases separat in der Watchlist', async () => {
    const futureMovie = {
      ...INCEPTION,
      id: '22',
      title: 'Future Film',
      releaseDateDe: '2099-12-31',
    }

    const wrapper = await mountMovieApp({ movies: [INCEPTION, futureMovie] })

    expect(wrapper.text()).toContain('Future Film')
    expect(wrapper.text()).toMatch(/Not Released/)

    wrapper.unmount()
  })
})
