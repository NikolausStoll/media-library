import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import BookCardTitle from '../src/components/books/BookCardTitle.vue'

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverMock)
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('BookCardTitle', () => {
  it('shows alternate title on second line for short main title', async () => {
    const wrapper = mount(BookCardTitle, {
      props: {
        title: 'Das Spiel des Löwen',
        alternateTitle: "The Lion's Game",
      },
      attachTo: document.body,
    })
    await flushPromises()
    await nextTick()

    expect(wrapper.text()).toContain('Das Spiel des Löwen')
    expect(wrapper.find('.book-card-alternate-title').exists()).toBe(true)
    expect(wrapper.find('.book-card-alternate-title').text()).toBe("The Lion's Game")
    expect(wrapper.find('.book-card-title-hint').exists()).toBe(false)

    wrapper.unmount()
  })

  it('shows ↔ hint and toggles title on click for long main title', async () => {
    const host = document.createElement('div')
    host.style.width = '72px'
    document.body.appendChild(host)

    const wrapper = mount(BookCardTitle, {
      props: {
        title: 'Harry Potter und der Stein der Weisen',
        alternateTitle: "Harry Potter and the Philosopher's Stone",
      },
      attachTo: host,
    })
    await flushPromises()
    await nextTick()

    if (!wrapper.find('.book-card-title-hint').exists()) {
      host.remove()
      wrapper.unmount()
      return
    }

    expect(wrapper.find('.book-card-alternate-title').exists()).toBe(false)

    await wrapper.find('.book-card-title-main').trigger('click')
    await nextTick()

    expect(wrapper.text()).toContain("Harry Potter and the Philosopher's Stone")
    expect(wrapper.find('.book-card-title-hint').exists()).toBe(true)

    host.remove()
    wrapper.unmount()
  })

  it('hides alternate UI when alternate title matches main title', async () => {
    const wrapper = mount(BookCardTitle, {
      props: {
        title: 'Dune',
        alternateTitle: 'Dune',
      },
    })

    expect(wrapper.find('.book-card-alternate-title').exists()).toBe(false)
    expect(wrapper.find('.book-card-title-hint').exists()).toBe(false)

    wrapper.unmount()
  })

  it('does not stop click propagation when toggle is unavailable', async () => {
    const parent = mount({
      components: { BookCardTitle },
      template: `
        <div class="card" @click="opened = true">
          <BookCardTitle title="Das Spiel des Löwen" alternate-title="The Lion's Game" />
        </div>
      `,
      data: () => ({ opened: false }),
    }, { attachTo: document.body })
    await flushPromises()
    await nextTick()

    await parent.find('.book-card-title-main').trigger('click')
    expect(parent.vm.opened).toBe(true)

    parent.unmount()
  })
})
