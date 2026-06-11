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
  prepareBookDraft,
  searchBookCandidates,
  loadBookEditions,
} from '../services/bookStorage.js'

import BookFilters from './books/BookFilters.vue'
import BookSearchOverlay from './books/BookSearchOverlay.vue'
import BookStatusOverlay from './books/BookStatusOverlay.vue'

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
const showBookEditor     = ref(false)
const formatEditor       = ref(null)
const bookEditor         = ref(null)
const showSearchOverlay  = ref(false)
const overlaySearchQuery = ref('')
const bookPrepareLoading = ref(false)
const bookPrepareWarnings = ref([])
const bookPrepareAnalysis = ref(null)
const bookPrepareAnalysisOpen = ref(false)
const bookSearchResults = ref([])
const bookSearchLoading = ref(false)
const bookSearchError = ref('')
const bookEditionResults = ref([])
const bookEditionLoading = ref(false)
const bookEditionError = ref('')
const bookEditionWorkKey = ref('')
const bookEditionOptions = ref({})
const selectedBookSearchResult = ref(null)

const searchQuery     = ref('')
const formatFilter    = ref([])
const languageFilter  = ref([])
const noRatingFilter  = ref(false)
const sortBy          = ref('title')
const sortDirection   = ref('asc')

const searchError     = ref('')

const viewMode = ref(localStorage.getItem('viewMode') || 'grid')
const gridDensity = ref(localStorage.getItem('gridDensity') || 'normal')

watch(viewMode, val => localStorage.setItem('viewMode', val))
watch(gridDensity, val => localStorage.setItem('gridDensity', val))
watch(darkMode, val => localStorage.setItem('darkMode', val))

watch(showOverlay, val => {
  if (!val) deleteConfirm.value = false
})

watch(overlaySearchQuery, () => {
  searchError.value    = ''
  bookSearchError.value = ''
  clearBookEditions()
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
  { id: 'paperback', label: 'Paperback' },
  { id: 'ebook',     label: 'E-Book' },
  { id: 'audiobook', label: 'Audiobook' },
  { id: 'other',     label: 'Other' },
]

const availableLanguages = [
  { id: 'de', label: 'Deutsch' },
  { id: 'en', label: 'English' },
]

const BOOK_DATE_MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function getFormatLabel(format) {
  const normalized = format === 'kindle' ? 'ebook' : format
  return availableFormats.find(f => f.id === normalized)?.label ?? normalized
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
      if (a.userRating == null && b.userRating == null) return 0
      if (a.userRating == null) return 1
      if (b.userRating == null) return -1
      return (a.userRating - b.userRating) * dir
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

  if (languageFilter.value.length)
    base = base.filter(b => languageFilter.value.includes((b.language ?? '').toLowerCase()))

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

  if (languageFilter.value.length)
    base = base.filter(b => languageFilter.value.includes((b.language ?? '').toLowerCase()))

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

  if (languageFilter.value.length)
    base = base.filter(b => languageFilter.value.includes((b.language ?? '').toLowerCase()))

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

function createBookDraft(result = {}, status = activeTab.value === 'all' ? 'backlog' : activeTab.value) {
  return {
    id: result.id ?? null,
    title: result.title ?? '',
    authorsText: Array.isArray(result.authors) ? result.authors.join(', ') : (result.authors ?? ''),
    description: result.description ?? '',
    imageUrl: result.imageUrl ?? '',
    coverPath: result.coverPath ?? null,
    coverThumbPath: result.coverThumbPath ?? null,
    coverUrl: result.coverUrl ?? result.imageUrl ?? '',
    coverFile: null,
    coverFileName: '',
    coverPreviewUrl: '',
    pageCount: result.pageCount ?? '',
    publishedDate: result.publishedDate ?? '',
    seriesName: result.seriesName ?? '',
    seriesPosition: result.seriesPosition ?? '',
    publisher: result.publisher ?? '',
    isbn: result.isbn ?? '',
    language: result.language ?? '',
    sourceName: result.sourceName ?? 'Manual',
    sourceUrl: result.sourceUrl ?? result.linkUrl ?? '',
    status,
    formats: (result.formats ?? []).map(f => ({ format: (f.format ?? f) === 'kindle' ? 'ebook' : (f.format ?? f) })),
  }
}

function openBookEditor(book = null) {
  searchError.value = ''
  bookPrepareWarnings.value = []
  bookPrepareAnalysis.value = null
  bookPrepareAnalysisOpen.value = false
  bookEditor.value = createBookDraft(
    book
      ? { ...book, coverUrl: '', id: book.id }
      : { title: searchQuery.value, sourceName: 'Manual' },
    book?.status ?? (activeTab.value === 'all' ? 'backlog' : activeTab.value),
  )
  showOverlay.value = false
  showBookEditor.value = true
}

function openDraftFromSearch({ result, status }) {
  searchError.value = ''
  bookPrepareWarnings.value = []
  bookPrepareAnalysis.value = null
  bookPrepareAnalysisOpen.value = false
  bookEditor.value = createBookDraft(
    {
      ...result,
      coverUrl: result.coverUrl ?? result.imageUrl,
      sourceName: result.sourceName ?? 'Manual',
      sourceUrl: result.sourceUrl ?? result.linkUrl,
    },
    status,
  )
  showSearchOverlay.value = false
  showBookEditor.value = true
}

function addDraftFormat(formatId) {
  if (!formatId || !bookEditor.value) return
  if (bookEditor.value.formats.some(f => (f.format ?? f) === formatId)) return
  bookEditor.value.formats.push({ format: formatId })
}

function removeDraftFormat(index) {
  bookEditor.value?.formats.splice(index, 1)
}

function normalizeDraftLanguage(value) {
  const lang = String(value ?? '').trim().toLowerCase()
  if (['de', 'deutsch', 'german'].includes(lang)) return 'de'
  if (['en', 'english', 'englisch'].includes(lang)) return 'en'
  return lang.length === 2 ? lang : ''
}

function padBookDate(value) {
  return String(value).padStart(2, '0')
}

function normalizeEditorPublishedDate(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const iso = raw.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/)
  if (iso) {
    const [, year, month, day] = iso
    if (!month) return year
    if (!day) return `${year}-${padBookDate(month)}`
    return `${year}-${padBookDate(month)}-${padBookDate(day)}`
  }

  const monthDayYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthDayYear) {
    const month = BOOK_DATE_MONTHS[monthDayYear[1].toLowerCase()]
    if (month) return `${monthDayYear[3]}-${padBookDate(month)}-${padBookDate(monthDayYear[2])}`
  }

  const dayMonthYear = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (dayMonthYear) {
    const month = BOOK_DATE_MONTHS[dayMonthYear[2].toLowerCase()]
    if (month) return `${dayMonthYear[3]}-${padBookDate(month)}-${padBookDate(dayMonthYear[1])}`
  }

  const monthYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (monthYear) {
    const month = BOOK_DATE_MONTHS[monthYear[1].toLowerCase()]
    if (month) return `${monthYear[2]}-${padBookDate(month)}`
  }

  return raw
}

function normalizeBookEditorPublishedDate() {
  if (!bookEditor.value) return
  bookEditor.value.publishedDate = normalizeEditorPublishedDate(bookEditor.value.publishedDate)
}

function prepareMethodLabel(method) {
  if (method === 'web-search') return 'Web search'
  if (method === 'llm-normalization') return 'LLM normalization'
  if (method === 'open-library') return 'Open Library only'
  return method || 'Unknown'
}

function prepareFieldLabel(field) {
  const labels = {
    title: 'Title',
    authors: 'Authors',
    description: 'Description',
    coverUrl: 'Cover',
    pageCount: 'Pages',
    publishedDate: 'Published',
    seriesName: 'Series',
    seriesPosition: 'Series position',
    publisher: 'Publisher',
    isbn: 'ISBN',
    language: 'Language',
    sourceName: 'Source',
    sourceUrl: 'Source URL',
  }
  return labels[field] ?? field
}

function prepareTokenSummary(usage) {
  if (!usage) return 'No token usage'
  const input = usage.prompt_tokens ?? usage.input_tokens ?? 0
  const output = usage.completion_tokens ?? usage.output_tokens ?? 0
  const total = usage.total_tokens ?? input + output
  return `${total} tokens (${input} in / ${output} out)`
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function handleCoverFileChange(event) {
  const file = event.target.files?.[0]
  if (!file || !bookEditor.value) return
  if (!file.type.startsWith('image/')) {
    searchError.value = 'Cover file must be an image.'
    event.target.value = ''
    return
  }

  const dataUrl = await readFileAsDataUrl(file)
  bookEditor.value.coverFile = {
    dataUrl,
    name: file.name,
    type: file.type,
  }
  bookEditor.value.coverFileName = file.name
  bookEditor.value.coverPreviewUrl = dataUrl
  event.target.value = ''
}

function clearDraftCover() {
  if (!bookEditor.value) return
  bookEditor.value.coverPath = null
  bookEditor.value.coverThumbPath = null
  bookEditor.value.coverUrl = ''
  bookEditor.value.coverFile = null
  bookEditor.value.coverFileName = ''
  bookEditor.value.coverPreviewUrl = ''
  bookEditor.value.imageUrl = ''
}

function applyPreparedDraft(prepared) {
  if (!bookEditor.value || !prepared) return
  const draft = prepared.draft ?? prepared
  if (draft.title) bookEditor.value.title = draft.title
  if (Array.isArray(draft.authors)) bookEditor.value.authorsText = draft.authors.join(', ')
  if (draft.description) bookEditor.value.description = draft.description
  if (draft.coverUrl) {
    bookEditor.value.coverUrl = draft.coverUrl
    bookEditor.value.coverPath = null
    bookEditor.value.coverThumbPath = null
    bookEditor.value.coverFile = null
    bookEditor.value.coverFileName = ''
    bookEditor.value.coverPreviewUrl = ''
  }
  if (draft.pageCount != null) bookEditor.value.pageCount = draft.pageCount
  if (draft.publishedDate) bookEditor.value.publishedDate = draft.publishedDate
  if (draft.seriesName) bookEditor.value.seriesName = draft.seriesName
  if (draft.seriesPosition) bookEditor.value.seriesPosition = draft.seriesPosition
  if (draft.publisher) bookEditor.value.publisher = draft.publisher
  if (draft.isbn) bookEditor.value.isbn = draft.isbn
  if (draft.language) bookEditor.value.language = normalizeDraftLanguage(draft.language)
  if (draft.sourceName) bookEditor.value.sourceName = draft.sourceName
  if (draft.sourceUrl) bookEditor.value.sourceUrl = draft.sourceUrl
  bookPrepareWarnings.value = prepared.warnings ?? []
  bookPrepareAnalysis.value = prepared.analysis ?? null
  bookPrepareAnalysisOpen.value = false
}

async function prepareCurrentBookDraft() {
  if (!bookEditor.value?.isbn?.trim()) {
    searchError.value = 'ISBN is required for preparation.'
    return
  }

  bookPrepareLoading.value = true
  searchError.value = ''
  bookPrepareWarnings.value = []
  bookPrepareAnalysis.value = null
  bookPrepareAnalysisOpen.value = false
  try {
    const prepared = await prepareBookDraft({
      isbn: bookEditor.value.isbn,
      languageHint: bookEditor.value.language,
    })
    applyPreparedDraft(prepared)
  } catch (err) {
    searchError.value = err.message
  } finally {
    bookPrepareLoading.value = false
  }
}

function bookDraftPayload() {
  const draft = bookEditor.value
  return {
    title: draft.title,
    authors: draft.authorsText,
    description: draft.description,
    imageUrl: draft.imageUrl,
    coverPath: draft.coverPath,
    coverThumbPath: draft.coverThumbPath,
    coverUrl: draft.coverFile ? '' : draft.coverUrl,
    coverFile: draft.coverFile,
    pageCount: draft.pageCount,
    publishedDate: draft.publishedDate,
    seriesName: draft.seriesName,
    seriesPosition: draft.seriesPosition,
    publisher: draft.publisher,
    isbn: draft.isbn,
    language: draft.language,
    sourceName: draft.sourceName,
    sourceUrl: draft.sourceUrl,
    status: draft.status,
    formats: draft.formats,
  }
}

async function saveBookEditor() {
  if (!bookEditor.value?.title?.trim()) return
  searchError.value = ''
  const draftId = bookEditor.value.id
  const payload = bookDraftPayload()
  try {
    if (draftId) {
      const updated = await updateBook(draftId, payload)
      const withFormats = await updateBookFormats(draftId, payload.formats)
      const finalBook = withFormats ?? updated
      const idx = bookList.value.findIndex(b => String(b.id) === String(draftId))
      if (idx !== -1) bookList.value[idx] = finalBook
      overlayBook.value = finalBook
    } else {
      const created = await addBook(payload)
      bookList.value.push(created)
    }
    showBookEditor.value = false
    bookEditor.value = null
  } catch (err) {
    searchError.value = err.message
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
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  overlaySearchQuery.value = ''
  searchError.value    = ''
  bookSearchResults.value = []
  bookSearchError.value = ''
  bookSearchLoading.value = false
  clearBookEditions()
}

function clearBookEditions() {
  bookEditionResults.value = []
  bookEditionError.value = ''
  bookEditionLoading.value = false
  bookEditionWorkKey.value = ''
  bookEditionOptions.value = {}
  selectedBookSearchResult.value = null
}

async function handleAddFromSearch(result, status) {
  openDraftFromSearch({ result, status: status || activeTab.value })
}

function defaultEditorStatus() {
  return activeTab.value === 'all' ? 'backlog' : activeTab.value
}

function normalizeSearchOption(value) {
  const normalized = String(value ?? '').trim()
  return normalized && normalized !== 'any' && normalized !== 'relevance' ? normalized : ''
}

function normalizeSearchOptions(options = {}) {
  return {
    language: normalizeSearchOption(options.language),
    format: normalizeSearchOption(options.format),
    sort: normalizeSearchOption(options.sort),
  }
}

async function searchBooksByTitle(options = {}) {
  const query = overlaySearchQuery.value.trim()
  if (query.length < 2) return
  bookSearchLoading.value = true
  bookSearchError.value = ''
  bookSearchResults.value = []
  bookEditionResults.value = []
  bookEditionError.value = ''
  bookEditionWorkKey.value = ''
  selectedBookSearchResult.value = null
  try {
    bookSearchResults.value = await searchBookCandidates(query, normalizeSearchOptions(options))
  } catch (err) {
    bookSearchError.value = err.message
  } finally {
    bookSearchLoading.value = false
  }
}

function handleUseSearchResult(result) {
  openDraftFromSearch({
    result: {
      title: result.title,
      authors: result.authors ?? [],
      isbn: result.isbnCandidates?.[0] ?? '',
      coverUrl: result.coverUrl,
      imageUrl: result.coverUrl,
      sourceName: 'Open Library search',
      sourceUrl: result.openLibraryWorkKey ? `https://openlibrary.org${result.openLibraryWorkKey}` : '',
    },
    status: defaultEditorStatus(),
  })
  nextTick(() => {
    if (bookEditor.value?.isbn) prepareCurrentBookDraft()
  })
}

function handleIsbnSearch(isbn) {
  openDraftFromSearch({
    result: {
      title: '',
      authors: [],
      isbn,
      sourceName: 'ISBN search',
      sourceUrl: `https://openlibrary.org/isbn/${isbn}`,
    },
    status: defaultEditorStatus(),
  })
  nextTick(() => {
    if (bookEditor.value?.isbn) prepareCurrentBookDraft()
  })
}

async function loadEditionsForSearchResult({ result, options = {} }) {
  if (!result?.openLibraryWorkKey) return
  bookEditionLoading.value = true
  bookEditionError.value = ''
  bookEditionResults.value = []
  bookEditionWorkKey.value = result.openLibraryWorkKey
  bookEditionOptions.value = normalizeSearchOptions(options)
  selectedBookSearchResult.value = result
  try {
    bookEditionResults.value = await loadBookEditions(result.openLibraryWorkKey, bookEditionOptions.value)
  } catch (err) {
    bookEditionError.value = err.message
  } finally {
    bookEditionLoading.value = false
  }
}

function formatFromEdition(edition) {
  const selectedFormat = normalizeSearchOption(bookEditionOptions.value.format)
  if (selectedFormat) return selectedFormat
  const raw = String(edition?.format ?? '').toLowerCase()
  if (raw.includes('paperback')) return 'paperback'
  if (raw.includes('hardcover')) return 'hardcover'
  if (raw.includes('ebook') || raw.includes('e-book')) return 'ebook'
  return ''
}

function handleUseEdition(edition) {
  const work = selectedBookSearchResult.value ?? {}
  const format = formatFromEdition(edition)
  openDraftFromSearch({
    result: {
      title: edition.title || work.title || '',
      authors: work.authors ?? [],
      isbn: edition.isbnCandidates?.[0] ?? '',
      coverUrl: edition.coverUrl ?? work.coverUrl,
      imageUrl: edition.coverUrl ?? work.coverUrl,
      publishedDate: edition.publishedDate ?? '',
      publisher: edition.publisher ?? '',
      pageCount: edition.pageCount ?? '',
      language: edition.language ?? work.languages?.[0] ?? '',
      sourceName: 'Open Library edition',
      sourceUrl: edition.openLibraryEditionKey ? `https://openlibrary.org${edition.openLibraryEditionKey}` : '',
      formats: format ? [format] : [],
    },
    status: defaultEditorStatus(),
  })
  nextTick(() => {
    if (bookEditor.value?.isbn) prepareCurrentBookDraft()
  })
}

function toggleFilter(arr, val) {
  const i = arr.indexOf(val)
  if (i > -1) arr.splice(i, 1); else arr.push(val)
}

function toggleTypedFilter(type, val) {
  if (type === 'language') toggleFilter(languageFilter.value, val)
  else toggleFilter(formatFilter.value, val)
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
    else if (showBookEditor.value)    showBookEditor.value = false
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
                  <div class="book-title-block">
                    <p class="card-title">{{ book.title }}</p>
                    <span v-if="book.authors?.length" class="book-card-author">{{ book.authors[0] }}</span>
                  </div>
                  <div class="card-row">
                    <div class="card-platform" @click.stop="openFormatEditor(book, $event)">
                      <span v-if="book.formats.length === 0" class="platform-text">No format</span>
                      <span v-for="(f, idx) in book.formats" :key="idx" class="platform-text">{{ getFormatLabel(f.format ?? f) }}</span>
                    </div>
                    <div v-if="book.pageCount" class="card-time-wrap">
                      <span class="card-time">{{ book.pageCount }} p</span>
                    </div>
                  </div>
                  <div class="card-row book-meta-row" v-if="book.seriesName || book.language">
                    <div class="book-meta-left">
                      <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                    </div>
                    <span v-if="book.language" class="book-language-badge">{{ book.language.toUpperCase() }}</span>
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
                <div class="book-title-block">
                  <p class="card-title">{{ book.title }}</p>
                  <span v-if="book.authors?.length" class="book-card-author">{{ book.authors[0] }}</span>
                </div>
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
                <div class="card-row book-meta-row" v-if="book.seriesName || book.userRating != null || book.language">
                  <div class="book-meta-left">
                    <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                  </div>
                  <div class="book-meta-right">
                    <span v-if="book.userRating != null" class="card-rating">{{ Number(book.userRating).toFixed(0) }}★</span>
                    <span v-if="book.language" class="book-language-badge">{{ book.language.toUpperCase() }}</span>
                  </div>
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
                  <div class="book-title-block">
                    <p class="card-title">{{ book.title }}</p>
                    <span v-if="book.authors?.length" class="book-card-author">{{ book.authors[0] }}</span>
                  </div>
                  <div class="card-row">
                    <div class="card-platform" @click.stop="openFormatEditor(book, $event)">
                      <span v-for="(f, idx) in book.formats" :key="idx" class="platform-text">{{ getFormatLabel(f.format ?? f) }}</span>
                    </div>
                    <div v-if="book.pageCount" class="card-time-wrap">
                      <span class="card-time">{{ book.pageCount }} p</span>
                    </div>
                  </div>
                  <div class="card-row book-meta-row" v-if="book.seriesName || book.language">
                    <div class="book-meta-left">
                      <span v-if="book.seriesName" class="book-series-badge">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
                    </div>
                    <span v-if="book.language" class="book-language-badge">{{ book.language.toUpperCase() }}</span>
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
          :languageFilter="languageFilter"
          :noRatingFilter="noRatingFilter"
          :availableFormats="availableFormats"
          :availableLanguages="availableLanguages"
          :filterSectionsOpen="filterSectionsOpen"
          :viewMode="viewMode"
          :gridDensity="gridDensity"
          :darkMode="darkMode"
          :searchQuery="searchQuery"
          @switch-media="(value) => emit('switch-media', value)"
          @open-search-overlay="openSearchOverlay"
          @update:searchQuery="searchQuery = $event"
          @toggle-filter="toggleTypedFilter"
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
      @delete-trigger="deleteConfirm = true"
      @delete-confirm="handleDeleteBook"
      @delete-cancel="deleteConfirm = false"
      @update-completion-date="handleCompletionDateUpdate"
      @update-user-rating="setBookUserRating"
      @edit-details="openBookEditor"
    />

    <!-- Local Book Editor Overlay -->
    <div v-if="showBookEditor" class="overlay" @click="showBookEditor = false">
      <div class="editor-content book-editor-content" @click.stop>
        <div class="overlay-title">{{ bookEditor?.id ? 'Edit Book' : 'Add Book' }}</div>
        <div class="overlay-subtitle">Local book data</div>

        <div class="book-editor-grid">
          <label class="book-editor-field wide">
            <span>Title</span>
            <input v-model="bookEditor.title" class="book-editor-input" type="text" />
          </label>

          <label class="book-editor-field wide">
            <span>Authors</span>
            <input v-model="bookEditor.authorsText" class="book-editor-input" type="text" placeholder="Author One, Author Two" />
          </label>

          <label class="book-editor-field">
            <span>Status</span>
            <select v-model="bookEditor.status" class="book-editor-input">
              <option v-for="option in statusOptions" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </label>

          <label class="book-editor-field">
            <span>Language</span>
            <select v-model="bookEditor.language" class="book-editor-input">
              <option value="">Unknown</option>
              <option v-for="lang in availableLanguages" :key="lang.id" :value="lang.id">{{ lang.label }}</option>
            </select>
          </label>

          <div class="book-editor-field">
            <span>ISBN</span>
            <div class="book-editor-inline-row">
              <input v-model="bookEditor.isbn" class="book-editor-input" type="text" />
              <button
                class="book-editor-prepare-btn"
                type="button"
                :disabled="bookPrepareLoading || !bookEditor.isbn?.trim()"
                @click="prepareCurrentBookDraft"
              >
                {{ bookPrepareLoading ? '...' : 'Prepare' }}
              </button>
            </div>
          </div>

          <label class="book-editor-field">
            <span>Pages</span>
            <input v-model="bookEditor.pageCount" class="book-editor-input" type="number" min="0" />
          </label>

          <label class="book-editor-field">
            <span>Published</span>
            <input
              v-model="bookEditor.publishedDate"
              class="book-editor-input"
              type="text"
              placeholder="YYYY-MM-DD, YYYY-MM or YYYY"
              @blur="normalizeBookEditorPublishedDate"
            />
          </label>

          <label class="book-editor-field">
            <span>Publisher</span>
            <input v-model="bookEditor.publisher" class="book-editor-input" type="text" />
          </label>

          <label class="book-editor-field">
            <span>Series</span>
            <input v-model="bookEditor.seriesName" class="book-editor-input" type="text" />
          </label>

          <label class="book-editor-field">
            <span>Position</span>
            <input v-model="bookEditor.seriesPosition" class="book-editor-input" type="text" />
          </label>

          <div class="book-editor-field wide">
            <span>Cover</span>
            <div class="book-editor-cover-row">
              <div class="book-editor-cover-controls">
                <input v-model="bookEditor.coverUrl" class="book-editor-input" type="url" placeholder="Cover URL" />
                <div class="book-editor-file-row">
                  <label class="book-editor-file-btn">
                    Choose Image
                    <input type="file" accept="image/*" @change="handleCoverFileChange" />
                  </label>
                  <span class="book-editor-file-name">{{ bookEditor.coverFileName || 'No local file selected' }}</span>
                  <button
                    v-if="bookEditor.coverPath || bookEditor.coverThumbPath || bookEditor.coverUrl || bookEditor.coverFile || bookEditor.imageUrl"
                    class="clear-cache-btn"
                    type="button"
                    @click="clearDraftCover"
                  >
                    Remove Cover
                  </button>
                </div>
              </div>
              <div class="book-editor-preview inline" v-if="bookEditor.coverPreviewUrl || bookEditor.coverPath || bookEditor.coverThumbPath || bookEditor.coverUrl || bookEditor.imageUrl">
                <img :src="bookEditor.coverPreviewUrl || bookEditor.coverThumbPath || bookEditor.coverPath || bookEditor.coverUrl || bookEditor.imageUrl" alt="" />
                <span>Stored locally when saved.</span>
              </div>
            </div>
          </div>

          <label class="book-editor-field">
            <span>Source</span>
            <input v-model="bookEditor.sourceName" class="book-editor-input" type="text" />
          </label>

          <label class="book-editor-field">
            <span>Source URL</span>
            <input v-model="bookEditor.sourceUrl" class="book-editor-input" type="url" />
          </label>

          <label class="book-editor-field wide">
            <span>Description</span>
            <textarea v-model="bookEditor.description" class="book-editor-input book-editor-textarea"></textarea>
          </label>
        </div>

        <div class="book-editor-formats">
          <div class="overlay-section-label">Formats</div>
          <div class="book-editor-format-row">
            <button
              v-for="(fmt, index) in bookEditor.formats"
              :key="`${fmt.format}-${index}`"
              class="filter-btn active"
              @click="removeDraftFormat(index)"
            >
              {{ getFormatLabel(fmt.format ?? fmt) }} ✕
            </button>
            <select
              class="add-platform-select"
              @change="addDraftFormat($event.target.value); $event.target.value = ''"
            >
              <option value="">+ Add format</option>
              <option v-for="f in availableFormats" :key="f.id" :value="f.id">{{ f.label }}</option>
            </select>
          </div>
        </div>

        <div v-if="bookPrepareWarnings.length" class="book-editor-warnings">
          <div v-for="warning in bookPrepareWarnings" :key="warning" class="book-editor-warning">{{ warning }}</div>
        </div>

        <div v-if="bookPrepareAnalysis" class="book-prepare-analysis">
          <button
            class="book-prepare-analysis-header"
            type="button"
            @click="bookPrepareAnalysisOpen = !bookPrepareAnalysisOpen"
          >
            <span>Prepare analysis</span>
            <span>{{ prepareMethodLabel(bookPrepareAnalysis.method) }}</span>
            <span aria-hidden="true">{{ bookPrepareAnalysisOpen ? '−' : '+' }}</span>
          </button>
          <div v-if="bookPrepareAnalysisOpen" class="book-prepare-analysis-body">
            <div class="book-prepare-analysis-chips">
              <span :class="{ active: bookPrepareAnalysis.webSearchUsed }">
                Web search: {{ bookPrepareAnalysis.webSearchUsed ? bookPrepareAnalysis.webSearchCallCount || 1 : 'no' }}
              </span>
              <span>{{ prepareTokenSummary(bookPrepareAnalysis.tokenUsage) }}</span>
              <span>Open Library fields: {{ bookPrepareAnalysis.openLibraryFieldCount }}</span>
            </div>
            <div
              v-if="bookPrepareAnalysis.fieldComparison?.filled?.length || bookPrepareAnalysis.fieldComparison?.changed?.length"
              class="book-prepare-delta"
            >
              <div
                v-for="item in bookPrepareAnalysis.fieldComparison.filled"
                :key="`filled-${item.field}`"
                class="book-prepare-delta-row"
              >
                <span>Filled {{ prepareFieldLabel(item.field) }}</span>
                <strong>{{ item.to }}</strong>
              </div>
              <div
                v-for="item in bookPrepareAnalysis.fieldComparison.changed"
                :key="`changed-${item.field}`"
                class="book-prepare-delta-row"
              >
                <span>Changed {{ prepareFieldLabel(item.field) }}</span>
                <strong>{{ item.from }} -> {{ item.to }}</strong>
              </div>
            </div>
            <div v-else class="book-prepare-empty-delta">No editable fields were filled or changed.</div>
          </div>
        </div>

        <p v-if="searchError" class="book-editor-error">{{ searchError }}</p>

        <div class="book-editor-actions">
          <button class="close-btn" :disabled="!bookEditor.title?.trim()" @click="saveBookEditor">Save</button>
          <button class="clear-cache-btn" @click="showBookEditor = false">Cancel</button>
        </div>
      </div>
    </div>

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
      :results="bookSearchResults"
      :loading="bookSearchLoading"
      :error="bookSearchError"
      :editions="bookEditionResults"
      :editionsLoading="bookEditionLoading"
      :editionsError="bookEditionError"
      :selectedWorkKey="bookEditionWorkKey"
      :existingBooks="bookList"
      :tabs="tabs"
      :statusOptions="statusOptions"
      :activeTab="activeTab"
      @update:searchQuery="overlaySearchQuery = $event"
      @search-title="searchBooksByTitle"
      @isbn-search="handleIsbnSearch"
      @use-result="handleUseSearchResult"
      @load-editions="loadEditionsForSearchResult"
      @clear-editions="clearBookEditions"
      @use-edition="handleUseEdition"
      @draft="({ result, status }) => handleAddFromSearch(result, status)"
      @close="closeSearchOverlay"
    />
  </div>
</template>

<style scoped>
.theme-book .game-grid {
  align-items: stretch;
  grid-auto-rows: 1fr;
}

.theme-book .game-card {
  min-width: 0;
  height: 100%;
  overflow: hidden;
}

.theme-book .card-cover-wrap {
  flex: 0 0 auto;
  width: 100%;
  aspect-ratio: 2 / 3;
}

.theme-book .card-cover {
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
}

.theme-book .card-info {
  flex: 0 0 116px;
  height: 116px;
  min-height: 116px;
  padding: 6px 8px;
  overflow: hidden;
}

.theme-book .card-row {
  min-height: 18px;
  overflow: hidden;
}

.theme-book .card-platform {
  min-width: 0;
  overflow: hidden;
}

.theme-book .platform-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.book-title-block .card-title {
  display: -webkit-box;
  min-height: calc(11px * 1.3 * 2);
  margin: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.book-card-author {
  color: var(--text-dim);
  font-size: 10px;
  line-height: 1.25;
  min-height: calc(10px * 1.25);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-meta-row {
  align-items: flex-end;
}

.book-meta-left {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
}

.book-meta-right {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.book-meta-row > .book-language-badge {
  margin-left: auto;
}

.book-language-badge {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  border-radius: 2px;
  color: var(--accent-light);
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
}

.book-series-badge {
  flex-shrink: 1;
  display: inline-flex;
  align-items: center;
  min-width: 0;
  max-width: 100%;
  padding: 1px 5px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  border-radius: 2px;
  color: var(--accent-light);
  background: rgb(var(--accent-rgb) / 0.12);
  font-size: 9px;
  font-weight: 700;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-editor-content {
  width: min(680px, calc(100vw - 28px));
  max-width: 680px;
  max-height: calc(100dvh - 28px);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.book-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.book-editor-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.book-editor-field.wide {
  grid-column: 1 / -1;
}

.book-editor-input {
  width: 100%;
  min-height: 34px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: var(--surface2);
  color: var(--text);
  padding: 7px 9px;
  font: inherit;
  font-size: 12px;
  text-transform: none;
  letter-spacing: 0;
}

.book-editor-inline-row {
  display: flex;
  gap: 6px;
  min-width: 0;
}

.book-editor-inline-row .book-editor-input {
  min-width: 0;
}

.book-editor-prepare-btn {
  flex-shrink: 0;
  min-height: 34px;
  border: 1px solid rgb(var(--accent-rgb) / 0.45);
  border-radius: 2px;
  background: rgb(var(--accent-rgb) / 0.18);
  color: var(--accent-light);
  padding: 7px 10px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.book-editor-prepare-btn:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.book-editor-textarea {
  min-height: 96px;
  resize: vertical;
}

.book-editor-file-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.book-editor-cover-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

.book-editor-cover-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.book-editor-file-btn {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 34px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: var(--surface2);
  color: var(--text);
  padding: 7px 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  cursor: pointer;
}

.book-editor-file-btn input {
  display: none;
}

.book-editor-file-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  text-overflow: ellipsis;
  text-transform: none;
  white-space: nowrap;
}

.book-editor-formats {
  margin-top: 14px;
}

.book-editor-format-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}

.book-editor-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 14px;
  color: var(--text-dim);
  font-size: 11px;
}

.book-editor-preview.inline {
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 92px;
  margin-top: 0;
  text-align: center;
}

.book-editor-preview img {
  width: 48px;
  height: 72px;
  object-fit: cover;
  border-radius: 2px;
  border: 1px solid var(--border2);
}

.book-editor-error {
  margin-top: 12px;
  color: #fca5a5;
  font-size: 12px;
  line-height: 1.4;
}

.book-editor-warnings {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
}

.book-editor-warning {
  border: 1px solid rgb(245 158 11 / 0.35);
  border-radius: 2px;
  background: rgb(245 158 11 / 0.12);
  color: #fcd34d;
  padding: 6px 8px;
  font-size: 11px;
  line-height: 1.4;
}

.book-prepare-analysis {
  display: flex;
  flex-direction: column;
  margin-top: 12px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  border-radius: 2px;
  background: rgb(var(--accent-rgb) / 0.08);
  overflow: hidden;
}

.book-prepare-analysis-header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 8px 10px;
  text-align: left;
  text-transform: uppercase;
}

.book-prepare-analysis-header span:nth-child(2) {
  color: var(--accent-light);
  text-align: right;
}

.book-prepare-analysis-header span:last-child {
  color: var(--text-dim);
  font-size: 14px;
  line-height: 1;
}

.book-prepare-analysis-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-top: 1px solid rgb(var(--accent-rgb) / 0.2);
  padding: 10px;
}

.book-prepare-analysis-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.book-prepare-analysis-chips span {
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: var(--surface2);
  color: var(--text-dim);
  padding: 4px 6px;
  font-size: 11px;
  line-height: 1.2;
}

.book-prepare-analysis-chips span.active {
  border-color: rgb(var(--accent-rgb) / 0.55);
  color: var(--accent-light);
}

.book-prepare-delta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.book-prepare-delta-row {
  display: grid;
  grid-template-columns: 120px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 1.35;
}

.book-prepare-delta-row strong {
  min-width: 0;
  color: var(--text);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.book-prepare-empty-delta {
  color: var(--text-dim);
  font-size: 11px;
}

.book-editor-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.book-editor-actions.compact {
  margin-top: 8px;
}

@media (max-width: 640px) {
  .book-editor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .book-editor-file-row {
    align-items: stretch;
    flex-direction: column;
  }

  .book-editor-cover-row {
    grid-template-columns: 1fr;
  }

  .book-editor-preview.inline {
    align-items: flex-start;
    flex-direction: row;
    width: auto;
    text-align: left;
  }

  .book-prepare-delta-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }

  .book-editor-file-name {
    white-space: normal;
  }

  .book-editor-inline-row {
    flex-direction: column;
  }
}

@media (max-width: 360px) {
  .book-editor-grid {
    grid-template-columns: 1fr;
  }
}
</style>
