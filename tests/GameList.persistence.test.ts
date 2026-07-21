import './setupGameMocks'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountApp } from './helpers'
import {
  COMPACT_GRID_MIN_WIDTH,
  DENSE_GRID_MIN_WIDTH,
} from '../src/utils/gridDensity.js'
import { clampGridDensity } from '../src/utils/gridDensity.js'

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

describe('clampGridDensity', () => {
  it('caps dense to compact under 1400 and to normal under 1080', () => {
    expect(clampGridDensity('dense', DENSE_GRID_MIN_WIDTH)).toBe('dense')
    expect(clampGridDensity('dense', DENSE_GRID_MIN_WIDTH - 1)).toBe('compact')
    expect(clampGridDensity('compact', COMPACT_GRID_MIN_WIDTH - 1)).toBe('normal')
    expect(clampGridDensity('dense', COMPACT_GRID_MIN_WIDTH - 1)).toBe('normal')
  })
})

describe('GameList – View persistence', () => {
  it('stellt list-view aus localStorage wieder her', async () => {
    localStorage.setItem('viewMode', 'list')

    const wrapper = await mountApp()
    expect(wrapper.find('.game-list-container').classes()).toContain('list-view')

    wrapper.unmount()
  })

  it('setzt grid-compact bei 6-cols Dichte ab 1080px', async () => {
    stubInnerWidth(COMPACT_GRID_MIN_WIDTH)
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
    expect(wrapper.findAll('button').find(b => b.text().includes('6 cols'))).toBeDefined()
    expect(wrapper.find('.game-list-container').classes()).not.toContain('grid-dense')
    expect(wrapper.find('.game-list-container').classes()).toContain('grid-compact')
    expect(localStorage.getItem('gridDensity')).toBe('compact')

    wrapper.unmount()
  })

  it('versteckt 6/9 cols unter 1080px und capped auf 3 cols', async () => {
    localStorage.setItem('gridDensity', 'compact')
    stubInnerWidth(COMPACT_GRID_MIN_WIDTH - 1)

    const wrapper = await mountApp()
    await nextTick()

    expect(wrapper.findAll('button').find(b => b.text().includes('6 cols'))).toBeUndefined()
    expect(wrapper.findAll('button').find(b => b.text().includes('9 cols'))).toBeUndefined()
    expect(wrapper.find('.game-list-container').classes()).not.toContain('grid-compact')
    expect(wrapper.find('.game-list-container').classes()).not.toContain('grid-dense')
    expect(localStorage.getItem('gridDensity')).toBe('normal')

    wrapper.unmount()
  })
})
