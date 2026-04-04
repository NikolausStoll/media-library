<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'

defineProps({ mediaType: { type: String, default: 'book' } })
const emit = defineEmits(['switch-media'])

import {
  loadBooks,
  addBook,
  updateBook,
  updateBookFormats,
  deleteBook,
  loadNext,
  saveNext,
  removeFromNext,
} from '../services/bookStorage.js'

import BookFilters from './books/BookFilters.vue'
import BookSearchOverlay from './books/BookSearchOverlay.vue'
import BookStatusOverlay from './books/BookStatusOverlay.vue'

const API_BASE = '/api'

const bookList      = ref([])
const readNextList  = ref([])
const activeTab     = ref('backlog')
const loading       = ref(true)

const MOBILE_BREAKPOINT = 768
const isMobileLayout = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false)

const sidebarOpen        = ref(!isMobileLayout.value)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')
const filterSectionsOpen = ref({ formatFilter: true, sort: true })

const overlayBook        = ref(null)
const showOverlay        = ref(false)
const deleteConfirm      = ref(false)
const showFormatEditor   = ref(false)
const formatEditor       = ref(null)
const showSearchOverlay  = ref(false)
const overlaySearchQuery = ref('')

const searchQuery     = ref('')
const formatFilter    = ref([])
const noRatingFilter  = ref(false)
const sortBy          = ref('title')
const sortDirection   = ref('asc')

const searchResults   = ref([])
const searchLoading   = ref(false)
const searchError     = ref('')
const searchSearched  = ref(false)
const SEARCH_RESULTS_LIMIT = 40

const viewMode = ref(localStorage.getItem('viewMode') || 'grid')
const gridDensity = ref(localStorage.getItem('gridDensity') || 'normal')

watch(viewMode, val => localStorage.setItem('viewMode', val))
watch(gridDensity, val => localStorage.setItem('gridDensity', val))
watch(darkMode, val => localStorage.setItem('darkMode', val))

watch(showOverlay, val => {
  if (!val) deleteConfirm.value = false
})

watch(overlaySearchQuery, () => {
  searchResults.value  = []
  searchSearched.value = false
  searchError.value    = ''
})

const tabs = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },
  { id: 'started',   label: 'Started'   },
  { id: 'completed', label: 'Completed' },
  { id: 'all',       label: 'All'       },
]

const statusOptions = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },
  { id: 'started',   label: 'Started'   },
  { id: 'shelved',   label: 'Shelved'   },
  { id: 'completed', label: 'Completed' },
]

const availableFormats = [
  { id: 'hardcover', label: 'Hardcover' },
  { id: 'kindle',    label: 'Kindle' },
]

function getFormatLabel(format) {
  return availableFormats.find(f => f.id === format)?.label ?? format
}

function fuzzyMatch(str, query) {
  const s = str.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return true
  let si = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = s.indexOf(q[qi], si)
    if (found === -1) return false
    si = found + 1
  }
  return true
}

function applySort(list) {
  const dir = sortDirection.value === 'asc' ? 1 : -1

  if (sortBy.value === 'title')
    return [...list].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? '') * dir)

  if (sortBy.value === 'rating')
    return [...list].sort((a, b) => {
      if (a.rating == null && b.rating == null) return 0
      if (a.rating == null) return 1
      if (b.rating == null) return -1
      return (a.rating - b.rating) * dir
    })

  if (sortBy.value === 'pages')
    return [...list].sort((a, b) => {
      if (a.pageCount == null && b.pageCount == null) return 0
      if (a.pageCount == null) return 1
      if (b.pageCount == null) return -1
      return (a.pageCount - b.pageCount) * dir
    })

  return list
}

const readNextBooks = computed(() => {
  let base = readNextList.value
    .map(id => bookList.value.find(b => String(b.id) === String(id)))
    .filter(b => b && b.status === 'backlog')

  if (formatFilter.value.length)
    base = base.filter(b => b.formats.some(f => formatFilter.value.includes(f.format ?? f)))

  if (searchQuery.value.trim())
    base = base.filter(b => fuzzyMatch(b.title, searchQuery.value))

  return applySort(base)
})

const normalBacklogBooks = computed(() =>
  bookList.value.filter(
    b => b.status === 'backlog' && !readNextList.value.includes(String(b.id)),
  ),
)

const shelvedBooks = computed(() => {
  let base = bookList.value.filter(b => b.status === 'shelved')

  if (formatFilter.value.length)
    base = base.filter(b => b.formats.some(f => formatFilter.value.includes(f.format ?? f)))

  if (searchQuery.value.trim())
    base = base.filter(b => fuzzyMatch(b.title, searchQuery.value))

  return applySort(base)
})

const filteredBooks = computed(() => {
  let base =
    activeTab.value === 'all'     ? bookList.value.filter(b => b.status !== 'wishlist') :
    activeTab.value === 'started' ? bookList.value.filter(b => b.status === 'started') :
    activeTab.value === 'backlog' ? normalBacklogBooks.value :
    bookList.value.filter(b => b.status === activeTab.value)

  if (formatFilter.value.length)
    base = base.filter(b => b.formats.some(f => formatFilter.value.includes(f.format ?? f)))

  if (noRatingFilter.value)
    base = base.filter(b => b.userRating == null)

  if (searchQuery.value.trim())
    base = base.filter(b => fuzzyMatch(b.title, searchQuery.value))

  return applySort(base)
})

const statusCounts = computed(() => {
  const c = {}
  tabs.forEach(t => { c[t.id] = bookList.value.filter(b => b.status === t.id).length })
  c['started'] += bookList.value.filter(b => b.status === 'shelved').length
  c['all'] = bookList.value.filter(b => b.status !== 'wishlist').length
  return c
})

// Swipe
const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_THRESHOLD = 60
function onSwipeStart(e) {
  if (!e.touches?.length || !isMobileLayout.value) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}
function onSwipeEnd(e) {
  if (!e.changedTouches?.length || !isMobileLayout.value) return
  const deltaX = e.changedTouches[0].clientX - touchStartX.value
  const deltaY = e.changedTouches[0].clientY - touchStartY.value
  if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < SWIPE_THRESHOLD) return
  const idx = tabs.findIndex(t => t.id === activeTab.value)
  if (deltaX > 0 && idx > 0) activeTab.value = tabs[idx - 1].id
  else if (deltaX < 0 && idx >= 0 && idx < tabs.length - 1) activeTab.value = tabs[idx + 1].id
}

// Sort toggles
function toggleTitleSort() {
  if (sortBy.value !== 'title') { sortBy.value = 'title'; sortDirection.value = 'asc' }
  else { sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc' }
}
function toggleRatingSort() {
  if (sortBy.value !== 'rating') { sortBy.value = 'rating'; sortDirection.value = 'desc' }
  else { sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc' }
}
function togglePagesSort() {
  if (sortBy.value !== 'pages') { sortBy.value = 'pages'; sortDirection.value = 'asc' }
  else { sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc' }
}

// Overlay
function openOverlay(book, event) {
  event?.stopPropagation()
  overlayBook.value = book
  showOverlay.value = true
}

async function changeStatus(newStatus) {
  if (!overlayBook.value) return
  const book = overlayBook.value
  const bookId = String(book.id)
  const wasInReadNext = readNextList.value.includes(bookId)

  showOverlay.value = false
  overlayBook.value = null

  if (wasInReadNext && newStatus !== 'backlog') {
    readNextList.value = readNextList.value.filter(id => String(id) !== bookId)
    await removeFromNext(book.id)
  }

  const updated = await updateBook(book.id, { status: newStatus })
  const idx = bookList.value.findIndex(b => String(b.id) === String(book.id))
  if (idx !== -1) bookList.value[idx] = updated
}

async function handleDeleteBook() {
  if (!overlayBook.value) return
  const book = overlayBook.value
  const bookId = String(book.id)
  const wasInReadNext = readNextList.value.includes(bookId)

  showOverlay.value = false
  overlayBook.value = null
  bookList.value = bookList.value.filter(b => String(b.id) !== bookId)

  if (wasInReadNext) {
    readNextList.value = readNextList.value.filter(id => String(id) !== bookId)
    await removeFromNext(book.id)
  }

  await deleteBook(book.id)
}

async function setBookUserRating(val) {
  const book = overlayBook.value
  if (!book) return
  const updated = await updateBook(book.id, { userRating: val })
  const idx = bookList.value.findIndex(b => String(b.id) === String(book.id))
  if (idx !== -1) bookList.value[idx] = updated
  overlayBook.value = updated
}

async function handleCompletionDateUpdate({ id, completedAt }) {
  if (!id) return
  try {
    const updated = await updateBook(id, { completedAt })
    const idx = bookList.value.findIndex(b => String(b.id) === String(id))
    if (idx !== -1) bookList.value[idx] = updated
    if (overlayBook.value && String(overlayBook.value.id) === String(id))
      overlayBook.value = updated
  } catch (err) {
    console.error('Failed to update completion date', err)
  }
}

async function clearBookCache(book) {
  try {
    const res = await fetch(`${API_BASE}/googlebooks/cache/${book.externalId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`clearCache failed: ${res.status}`)
  } catch (err) {
    console.error('clearBookCache:', err)
  }
}

// Format Editor
function openFormatEditor(book, event) {
  event?.stopPropagation()
  formatEditor.value = { ...book, formats: book.formats.map(f => ({ ...f })) }
  showFormatEditor.value = true
}

async function saveFormatEditor() {
  if (!formatEditor.value) return
  const book = bookList.value.find(b => String(b.id) === String(formatEditor.value.id))
  if (book) book.formats = formatEditor.value.formats
  await updateBookFormats(formatEditor.value.id, formatEditor.value.formats)
  showFormatEditor.value = false
  formatEditor.value = null
}

function addFormat(formatId) {
  if (!formatId || !formatEditor.value) return
  if (formatEditor.value.formats.some(f => (f.format ?? f) === formatId)) return
  formatEditor.value.formats.push({ format: formatId })
}

function removeFormat(index) {
  formatEditor.value.formats.splice(index, 1)
}

// Read Next
async function addToReadNext(book) {
  const bookId = String(book.id)
  if (readNextList.value.length >= 6 || readNextList.value.includes(bookId)) return
  readNextList.value = [...readNextList.value, bookId]
  try {
    await saveNext(readNextList.value)
  } catch (err) {
    readNextList.value = readNextList.value.filter(id => id !== bookId)
    console.error('addToReadNext failed:', err)
  }
}

async function removeFromReadNext(bookId) {
  const id = String(bookId)
  readNextList.value = readNextList.value.filter(i => String(i) !== id)
  await removeFromNext(bookId)
}

// Search
function openSearchOverlay() {
  overlaySearchQuery.value = searchQuery.value
  showSearchOverlay.value = true
  nextTick(() => {
    if (overlaySearchQuery.value.trim()) searchGBooks()
  })
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  overlaySearchQuery.value = ''
  searchResults.value  = []
  searchSearched.value = false
  searchError.value    = ''
}

async function searchGBooks() {
  const q = overlaySearchQuery.value.trim()
  if (q.length < 2) return
  searchLoading.value  = true
  searchError.value    = ''
  searchSearched.value = true
  try {
    const res = await fetch(`${API_BASE}/googlebooks/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const data = await res.json()
    const existingIds = new Set(bookList.value.map(b => String(b.externalId)))
    const filtered = []
    for (const result of data) {
      if (existingIds.has(String(result.id))) continue
      filtered.push(result)
      if (filtered.length >= SEARCH_RESULTS_LIMIT) break
    }
    searchResults.value = filtered
  } catch (err) {
    searchError.value = err.message
  } finally {
    searchLoading.value = false
  }
}

async function handleAddFromSearch(result, status) {
  try {
    const newBook = await addBook(result.id, status || activeTab.value, [])
    bookList.value.push(newBook)
    searchResults.value = searchResults.value.filter(r => String(r.id) !== String(result.id))
  } catch (err) {
    searchError.value = err.message
  }
}

function toggleFilter(arr, val) {
  const i = arr.indexOf(val)
  if (i > -1) arr.splice(i, 1); else arr.push(val)
}

function toggleDarkMode() {
  darkMode.value = !darkMode.value
  document.body.classList.toggle('light-mode', !darkMode.value)
}

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    if (showSearchOverlay.value)      closeSearchOverlay()
    else if (showOverlay.value)       showOverlay.value = false
    else if (showFormatEditor.value)  showFormatEditor.value = false
  }
}

watch(isMobileLayout, (mobile) => {
  if (mobile) sidebarOpen.value = false
})

function handleResize() {
  isMobileLayout.value = window.innerWidth <= MOBILE_BREAKPOINT
}

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', handleResize)
  document.body.classList.toggle('light-mode', !darkMode.value)
  loading.value = true
  const [books, readNext] = await Promise.all([
    loadBooks(), loadNext(),
  ])
  bookList.value     = books
  readNextList.value = readNext
  loading.value      = false
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div :class="['app-layout theme-book', { 'light-mode': !darkMode }]">
    <div :class="['main-content', { 'sidebar-closed': !sidebarOpen }]">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list', 'grid-compact': viewMode === 'grid' && gridDensity === 'compact', 'grid-dense': viewMode === 'grid' && gridDensity === 'dense' }">

        <div v-if="loading" class="empty-state">Loading...</div>

        <template v-else>
          <div
            class="tabs-swipe-wrap"
            @touchstart.passive="onSwipeStart"
            @touchend="onSwipeEnd"
          >
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab', { active: activeTab === tab.id }]"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span class="tab-count">{{ statusCounts[tab.id] }}</span>
            </button>
          </div>

          <!-- Read Next (Backlog only) -->
          <div v-if="activeTab === 'backlog' && readNextBooks.length > 0" class="play-next-section">
            <div class="section-label">READ NEXT</div>
            <div class="game-grid play-next-grid">
              <div
                v-for="book in readNextBooks"
                :key="book.id"
                class="game-card"
                @click="openOverlay(book, $event)"
              >
                <div class="card-cover-wrap">
                  <img v-if="book.imageUrl" :src="book.imageUrl" :alt="book.title" class="card-cover" />
                  <div v-else class="card-cover card-cover-placeholder">{{ book.title?.[0] ?? '?' }}</div>
                  <button class="card-pn-btn pn-remove-btn" @click.stop="removeFromReadNext(book.id)" title="Remove from Read Next">✕</button>
                </div>
                <div class="card-info">
                  <p class="card-title">{{ book.title }}</p>
                  <div class="card-row">
                    <div class="card-platform" @click.stop="openFormatEditor(book, $event)">
                      <span v-if="book.formats.length === 0" class="platform-text">No format</span>
                      <span v-for="(f, idx) in book.formats" :key="idx" class="platform-text">{{ getFormatLabel(f.format ?? f) }}</span>
                    </div>
                    <div v-if="book.pageCount" class="card-time-wrap">
                      <span class="card-time">{{ book.pageCount }} p</span>
                    </div>
                  </div>
                  <div class="card-row" v-if="book.seriesName || book.authors?.length">
                    <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                    <span v-else-if="book.authors?.length" class="card-time">{{ book.authors[0] }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-if="activeTab === 'backlog' && readNextBooks.length > 0" class="list-separator"></div>

          <!-- Main List -->
          <div class="game-grid">
            <div
              v-for="book in filteredBooks"
              :key="book.id"
              class="game-card"
              @click="openOverlay(book, $event)"
            >
              <div class="card-cover-wrap">
                <img v-if="book.imageUrl" :src="book.imageUrl" :alt="book.title" class="card-cover" />
                <div v-else class="card-cover card-cover-placeholder">{{ book.title?.[0] ?? '?' }}</div>
                <button
                  v-if="activeTab === 'backlog' && !readNextList.includes(String(book.id)) && readNextList.length < 6"
                  class="card-pn-btn"
                  @click.stop="addToReadNext(book)"
                  title="Add to Read Next"
                >›</button>
              </div>
              <div class="card-info">
                <p class="card-title">{{ book.title }}</p>
                <div class="card-row">
                  <div class="card-platform" @click.stop="openFormatEditor(book, $event)">
                    <button v-if="book.formats.length === 0" class="add-first-platform-btn">+</button>
                    <template v-else>
                      <span v-for="(f, idx) in book.formats" :key="idx" class="platform-text">{{ getFormatLabel(f.format ?? f) }}</span>
                    </template>
                  </div>
                  <div v-if="book.pageCount" class="card-time-wrap">
                    <span class="card-time">{{ book.pageCount }} p</span>
                  </div>
                </div>
                <div class="card-row" v-if="book.seriesName || book.authors?.length || book.rating != null">
                  <div class="card-row-left">
                    <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                    <span v-else-if="book.authors?.length" class="card-time">{{ book.authors[0] }}</span>
                  </div>
                  <span v-if="book.rating != null" class="card-rating">{{ book.rating }}★</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Shelved Section -->
          <template v-if="activeTab === 'started' && shelvedBooks.length > 0">
            <div class="list-separator"></div>
            <div class="section-label">SHELVED</div>
            <div class="game-grid">
              <div
                v-for="book in shelvedBooks"
                :key="book.id"
                class="game-card"
                @click="openOverlay(book, $event)"
              >
                <div class="card-cover-wrap">
                  <img v-if="book.imageUrl" :src="book.imageUrl" :alt="book.title" class="card-cover" />
                  <div v-else class="card-cover card-cover-placeholder">{{ book.title?.[0] ?? '?' }}</div>
                </div>
                <div class="card-info">
                  <p class="card-title">{{ book.title }}</p>
                  <div class="card-row">
                    <div class="card-platform" @click.stop="openFormatEditor(book, $event)">
                      <span v-for="(f, idx) in book.formats" :key="idx" class="platform-text">{{ getFormatLabel(f.format ?? f) }}</span>
                    </div>
                    <div v-if="book.pageCount" class="card-time-wrap">
                      <span class="card-time">{{ book.pageCount }} p</span>
                    </div>
                  </div>
                  <div class="card-row" v-if="book.seriesName || book.authors?.length">
                    <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                    <span v-else-if="book.authors?.length" class="card-time">{{ book.authors[0] }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <p v-if="filteredBooks.length === 0 && (activeTab !== 'backlog' || readNextBooks.length === 0)" class="empty-state">No books found</p>
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="sidebarOpen && isMobileLayout"
      class="sidebar-backdrop"
      @click="sidebarOpen = false"
    ></div>

    <button
      :class="['sidebar-toggle-external', { 'sidebar-closed': !sidebarOpen }]"
      @click="sidebarOpen = !sidebarOpen"
    >{{ sidebarOpen ? '›' : '‹' }}</button>

    <aside :class="['sidebar', { collapsed: !sidebarOpen }]">
      <div v-show="sidebarOpen">
        <BookFilters
          :mediaType="mediaType"
          :activeTab="activeTab"
          :sortBy="sortBy"
          :sortDirection="sortDirection"
          :formatFilter="formatFilter"
          :noRatingFilter="noRatingFilter"
          :availableFormats="availableFormats"
          :filterSectionsOpen="filterSectionsOpen"
          :viewMode="viewMode"
          :gridDensity="gridDensity"
          :darkMode="darkMode"
          :searchQuery="searchQuery"
          @switch-media="(value) => emit('switch-media', value)"
          @open-search-overlay="openSearchOverlay"
          @update:searchQuery="searchQuery = $event"
          @toggle-filter="(type, val) => toggleFilter(formatFilter, val)"
          @toggle-no-rating="noRatingFilter = !noRatingFilter"
          @toggle-filter-section="(sec) => filterSectionsOpen[sec] = !filterSectionsOpen[sec]"
          @sort-title="toggleTitleSort"
          @sort-rating="toggleRatingSort"
          @sort-pages="togglePagesSort"
          @set-view-mode="(m) => viewMode = m"
          @set-grid-density="(d) => gridDensity = d"
          @toggle-dark-mode="toggleDarkMode"
        />
      </div>
    </aside>

    <!-- Status Overlay -->
    <BookStatusOverlay
      v-if="showOverlay"
      :book="overlayBook"
      :statusOptions="statusOptions"
      :deleteConfirm="deleteConfirm"
      :inReadNext="overlayBook ? readNextList.includes(String(overlayBook.id)) : false"
      :readNextAtLimit="overlayBook ? (!readNextList.includes(String(overlayBook.id)) && readNextList.length >= 6) : false"
      @close="showOverlay = false"
      @change-status="changeStatus"
      @toggle-read-next="overlayBook && (readNextList.includes(String(overlayBook.id)) ? removeFromReadNext(overlayBook.id) : addToReadNext(overlayBook))"
      @clear-cache="clearBookCache"
      @delete-trigger="deleteConfirm = true"
      @delete-confirm="handleDeleteBook"
      @delete-cancel="deleteConfirm = false"
      @update-completion-date="handleCompletionDateUpdate"
      @update-user-rating="setBookUserRating"
    />

    <!-- Format Editor Overlay -->
    <div v-if="showFormatEditor" class="overlay" @click="showFormatEditor = false">
      <div class="editor-content" @click.stop>
        <div class="overlay-title">{{ formatEditor?.title }}</div>
        <div class="overlay-subtitle">Manage Formats</div>

        <div class="platform-editor">
          <div
            v-for="(fmt, index) in formatEditor?.formats"
            :key="index"
            class="platform-editor-item"
          >
            <span class="platform-text" style="flex:1; font-size:12px">{{ getFormatLabel(fmt.format ?? fmt) }}</span>
            <button class="remove-btn" @click="removeFormat(index)">✕</button>
          </div>
          <div class="add-platform-section">
            <select
              @change="addFormat($event.target.value); $event.target.value = ''"
              class="add-platform-select"
            >
              <option value="">+ Add format</option>
              <option v-for="f in availableFormats" :key="f.id" :value="f.id">{{ f.label }}</option>
            </select>
          </div>
        </div>

        <button class="close-btn" @click="saveFormatEditor">Done</button>
      </div>
    </div>

    <!-- Search Overlay -->
    <BookSearchOverlay
      v-if="showSearchOverlay"
      :searchQuery="overlaySearchQuery"
      :results="searchResults"
      :loading="searchLoading"
      :tabs="tabs"
      :statusOptions="statusOptions"
      :activeTab="activeTab"
      @update:searchQuery="overlaySearchQuery = $event"
      @search="searchGBooks"
      @add="({ result, status }) => handleAddFromSearch(result, status)"
      @close="closeSearchOverlay"
    />
  </div>
</template>
