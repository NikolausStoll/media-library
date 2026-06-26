import './setupBookMocks'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { mountBookApp, HOBBIT, EBOOK_BOOK, FOUNDATION } from './helpers'

global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })

afterEach(() => {
  vi.clearAllMocks()
  document.body.innerHTML = ''
})

describe('BookList – Search overlay', () => {
  it('sucht Bücher und öffnet Editor aus Ergebnis', async () => {
    const { searchBookCandidates } = await import('../src/services/bookStorage.js')
    ;(searchBookCandidates as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        title: 'Neuromancer',
        authors: ['William Gibson'],
        isbnCandidates: [],
        openLibraryWorkKey: '/works/OL123W',
      },
    ])

    const wrapper = await mountBookApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()

    const input = wrapper.find('.search-overlay .search-input')
    await input.setValue('Neuro')
    await wrapper.find('.hltb-search-btn').trigger('click')
    await flushPromises()
    await nextTick()

    expect(searchBookCandidates).toHaveBeenCalled()
    expect(wrapper.text()).toContain('Neuromancer')

    await wrapper.find('.search-result-add-btn.primary').trigger('click')
    await nextTick()

    expect(wrapper.find('.book-editor-content').exists()).toBe(true)
    const titleInput = wrapper.findAll('.book-editor-content input.book-editor-input')[0]
    expect((titleInput.element as HTMLInputElement).value).toBe('Neuromancer')

    wrapper.unmount()
  })

  it('schließt Search Overlay mit ESC', async () => {
    const wrapper = await mountBookApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    expect(wrapper.find('.search-overlay').exists()).toBe(true)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await nextTick()

    expect(wrapper.find('.search-overlay').exists()).toBe(false)
    wrapper.unmount()
  })
})

describe('BookList – Manual editor', () => {
  it('speichert neues Buch über Editor', async () => {
    const { addBook } = await import('../src/services/bookStorage.js')
    ;(addBook as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: '50',
      title: 'Manual Book',
      status: 'backlog',
      formats: [{ format: 'paperback' }],
      authors: ['Me'],
    })

    const wrapper = await mountBookApp()

    await wrapper.find('.search-open-btn').trigger('click')
    await nextTick()
    await wrapper.find('.desktop-manual-btn').trigger('click')
    await nextTick()

    const titleInput = wrapper.find('.book-editor-content .book-editor-input')
    await titleInput.setValue('Manual Book')

    await wrapper.find('.book-editor-actions .close-btn').trigger('click')
    await flushPromises()

    expect(addBook).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Manual Book',
        status: 'backlog',
      }),
    )
    expect(wrapper.text()).toContain('Manual Book')

    wrapper.unmount()
  })
})

describe('BookList – Filters & sort', () => {
  it('Format-Filter zeigt nur passende Bücher', async () => {
    const wrapper = await mountBookApp({ books: [HOBBIT, EBOOK_BOOK] })

    const paperbackBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Paperback'))
    expect(paperbackBtn).toBeDefined()
    await paperbackBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Hobbit')
    expect(wrapper.text()).not.toContain('Project Hail Mary')

    wrapper.unmount()
  })

  it('Language-Filter zeigt nur passende Bücher', async () => {
    const wrapper = await mountBookApp({ books: [HOBBIT, EBOOK_BOOK] })

    const deBtn = wrapper.findAll('.filter-btn').find(b => b.text().includes('Deutsch'))
    expect(deBtn).toBeDefined()
    await deBtn!.trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain('Project Hail Mary')
    expect(wrapper.text()).not.toContain('Hobbit')

    wrapper.unmount()
  })

  it('Title-Sort ordnet standardmäßig A→Z und togglet auf Z→A', async () => {
    const wrapper = await mountBookApp({ books: [HOBBIT, FOUNDATION] })

    let cards = wrapper.findAll('.game-card')
    expect(cards[0].text()).toContain('Foundation')
    expect(cards[1].text()).toContain('Hobbit')

    const titleBtn = wrapper.findAll('button').find(b => b.text().includes('Title'))
    await titleBtn!.trigger('click')
    await nextTick()

    cards = wrapper.findAll('.game-card')
    expect(cards[0].text()).toContain('Hobbit')
    expect(cards[1].text()).toContain('Foundation')

    wrapper.unmount()
  })
})
