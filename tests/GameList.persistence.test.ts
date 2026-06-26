import './setupGameMocks'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { nextTick } from 'vue'
import { mountApp } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

beforeEach(() => {
  localStorage.clear()
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

  it('setzt grid-dense bei 9-cols Dichte', async () => {
    const wrapper = await mountApp()

    const denseBtn = wrapper.findAll('button').find(b => b.text().includes('9 cols'))
    await denseBtn!.trigger('click')
    await nextTick()

    expect(wrapper.find('.game-list-container').classes()).toContain('grid-dense')
    expect(localStorage.getItem('gridDensity')).toBe('dense')

    wrapper.unmount()
  })
})
