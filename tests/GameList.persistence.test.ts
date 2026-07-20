import './setupGameMocks'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountApp } from './helpers'
import { DENSE_GRID_MIN_WIDTH } from '../src/utils/gridDensity.js'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

function stubInnerWidth(width) {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    writable: true,
    value: width,
  })
}

beforeEach(() => {
  localStorage.clear()
  stubInnerWidth(DENSE_GRID_MIN_WIDTH)
})

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
  localStorage.clear()
})

describe('GameList – View persistence', () => {
  it('stellt list-view aus localStorage wieder her', async () => {
    localStorage.setItem('viewMode', 'list')

    const wrapper = await mountApp()
    expect(wrapper.find('.game-list-container').classes()).toContain('list-view')

    wrapper.unmount()
  })

  it('setzt grid-compact bei 6-cols Dichte', async () => {
    const wrapper = await mountApp()

    const compactBtn = wrapper.findAll('button').find(b => b.text().includes('6 cols'))
    expect(compactBtn).toBeDefined()
    await compactBtn!.trigger('click')
    await nextTick()

    expect(wrapper.find('.game-list-container').classes()).toContain('grid-compact')
    expect(localStorage.getItem('gridDensity')).toBe('compact')

    wrapper.unmount()
  })

  it('setzt grid-dense bei 9-cols Dichte ab 1400px', async () => {
    const wrapper = await mountApp()

    const denseBtn = wrapper.findAll('button').find(b => b.text().includes('9 cols'))
    expect(denseBtn).toBeDefined()
    await denseBtn!.trigger('click')
    await nextTick()

    expect(wrapper.find('.game-list-container').classes()).toContain('grid-dense')
    expect(localStorage.getItem('gridDensity')).toBe('dense')

    wrapper.unmount()
  })

  it('versteckt 9 cols unter 1400px und capped gespeichertes dense auf compact', async () => {
    localStorage.setItem('gridDensity', 'dense')
    stubInnerWidth(DENSE_GRID_MIN_WIDTH - 1)

    const wrapper = await mountApp()
    await nextTick()

    expect(wrapper.findAll('button').find(b => b.text().includes('9 cols'))).toBeUndefined()
    expect(wrapper.find('.game-list-container').classes()).not.toContain('grid-dense')
    expect(wrapper.find('.game-list-container').classes()).toContain('grid-compact')
    expect(localStorage.getItem('gridDensity')).toBe('compact')

    wrapper.unmount()
  })
})
