import './setupBookMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountBookApp, HOBBIT, DUNE, FOUNDATION, tabCount } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

function backlogBook(id: string, title: string) {
  return {
    id,
    title,
    status: 'backlog',
    authors: ['Author'],
    formats: [{ format: 'paperback' }],
    imageUrl: null,
    pageCount: 200,
    userRating: null,
    language: 'en',
  }
}

async function openBookOptionsTab(wrapper: Awaited<ReturnType<typeof mountBookApp>>) {
  const optionsTab = wrapper.find('.overlay').findAll('button.tab')
    .find(b => b.text().includes('Options'))
  expect(optionsTab).toBeDefined()
  await optionsTab!.trigger('click')
  await nextTick()
}

describe('BookList – Library tab', () => {
  it('zeigt Library statt Backlog als Tab-Label', async () => {
    const wrapper = await mountBookApp()

    expect(wrapper.text()).toContain('Library')
    expect(wrapper.text()).not.toMatch(/\bBacklog\b/)

    wrapper.unmount()
  })

  it('Library-Tab zeigt nur Bücher mit status backlog', async () => {
    const wrapper = await mountBookApp()

    expect(wrapper.text()).toContain('Hobbit')
    expect(wrapper.text()).toContain('Foundation')
    expect(wrapper.text()).not.toContain('Dune')

    wrapper.unmount()
  })

  it('Library-Count entspricht Anzahl der Library-Bücher', async () => {
    const wrapper = await mountBookApp()
    expect(tabCount(wrapper, 'Library')).toBe(2)
    wrapper.unmount()
  })
})

describe('BookList – Read Next', () => {
  it('fügt Buch per Card-Button zu Read Next hinzu und ruft saveNext auf', async () => {
    const { saveNext } = await import('../src/services/bookStorage.js')
    ;(saveNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountBookApp({ readNext: [] })

    const hobbitCard = wrapper.findAll('.game-card').find(c => c.text().includes('Hobbit'))
    expect(hobbitCard).toBeDefined()

    const addBtn = hobbitCard!.find('.card-pn-btn:not(.pn-remove-btn)')
    expect(addBtn.exists()).toBe(true)
    await addBtn.trigger('click')
    await flushPromises()

    expect(saveNext).toHaveBeenCalledWith([HOBBIT.id])
    expect(wrapper.find('.play-next-section').text()).toContain('Hobbit')
    wrapper.unmount()
  })

  it('entfernt Buch aus Read Next und ruft removeFromNext auf', async () => {
    const { removeFromNext } = await import('../src/services/bookStorage.js')
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountBookApp({ readNext: [HOBBIT.id] })

    const removeBtn = wrapper.find('.play-next-section .pn-remove-btn')
    expect(removeBtn.exists()).toBe(true)
    await removeBtn.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(HOBBIT.id)
    expect(wrapper.find('.play-next-section').exists()).toBe(false)
    wrapper.unmount()
  })

  it('blockiert Read Next ab 6 Einträgen', async () => {
    const books = Array.from({ length: 7 }, (_, i) =>
      backlogBook(String(i + 1), `Book ${i + 1}`),
    )
    const readNext = books.slice(0, 6).map(b => b.id)

    const wrapper = await mountBookApp({ books, readNext })

    const addButtons = wrapper.findAll('.card-pn-btn:not(.pn-remove-btn)')
    expect(addButtons.length).toBe(0)
    wrapper.unmount()
  })

  it('entfernt Buch aus Read Next bei Statuswechsel weg von Library', async () => {
    const { updateBook, removeFromNext } = await import('../src/services/bookStorage.js')
    ;(updateBook as ReturnType<typeof vi.fn>).mockResolvedValue({ ...HOBBIT, status: 'started' })
    ;(removeFromNext as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)

    const wrapper = await mountBookApp({ books: [HOBBIT], readNext: [HOBBIT.id] })

    await wrapper.find('.game-card').trigger('click')
    await nextTick()
    await openBookOptionsTab(wrapper)

    const startedBtn = wrapper.findAll('.status-btn').find(b => b.text().includes('Started'))
    expect(startedBtn).toBeDefined()
    await startedBtn!.trigger('click')
    await flushPromises()

    expect(removeFromNext).toHaveBeenCalledWith(HOBBIT.id)
    expect(updateBook).toHaveBeenCalledWith(
      HOBBIT.id,
      expect.objectContaining({ status: 'started' }),
    )
    wrapper.unmount()
  })
})

describe('BookList – Search', () => {
  it('findet Bücher nach Serienname', async () => {
    const wrapper = await mountBookApp({
      books: [
        { ...HOBBIT, seriesName: 'Middle-earth' },
        DUNE,
      ],
    })

    await wrapper.find('.search-input').setValue('middle')
    await nextTick()

    const cards = wrapper.findAll('.game-card')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('Hobbit')
    expect(wrapper.text()).not.toContain('Dune')

    wrapper.unmount()
  })
})

describe('BookList – Status overlay labels', () => {
  it('zeigt Library in Status-Buttons', async () => {
    const wrapper = await mountBookApp({ books: [HOBBIT] })

    await wrapper.find('.game-card').trigger('click')
    await nextTick()
    await openBookOptionsTab(wrapper)

    const statusLabels = wrapper.findAll('.status-btn').map(b => b.text())
    expect(statusLabels).toContain('Library')
    expect(statusLabels).not.toContain('Backlog')

    wrapper.unmount()
  })
})
