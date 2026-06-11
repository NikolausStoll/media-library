<!-- src/components/books/BookSearchOverlay.vue -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'

const BarcodeScanner = defineAsyncComponent(() => import('./BarcodeScanner.vue'))

const props = defineProps({
  searchQuery: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  error: { type: String, default: '' },
  editions: { type: Array, default: () => [] },
  editionsLoading: { type: Boolean, default: false },
  editionsError: { type: String, default: '' },
  selectedWorkKey: { type: String, default: '' },
  existingBooks: { type: Array, default: () => [] },
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  statusOptions: { type: Array, required: true },
})

const emit = defineEmits(['update:searchQuery', 'search-title', 'isbn-search', 'use-result', 'load-editions', 'clear-editions', 'use-edition', 'draft', 'close'])

const searchInputRef = ref(null)
const showScanner = ref(false)
const searchLanguage = ref('any')
const searchFormat = ref('any')
const searchSort = ref('relevance')
const MOBILE_BREAKPOINT = 768
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false)

function handleResize() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
  if (!isMobile.value) showScanner.value = false
}

onMounted(() => {
  searchInputRef.value?.focus()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})

const defaultAddStatus = computed(() =>
  props.activeTab === 'all' ? 'backlog' : props.activeTab,
)

const addToLabel = computed(() => {
  const label = props.statusOptions.find(o => o.id === defaultAddStatus.value)?.label ?? defaultAddStatus.value
  return label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : ''
})

const parsedInput = computed(() => parseDraftInput(props.searchQuery))

const selectedResult = computed(() =>
  props.results.find(result => result.openLibraryWorkKey === props.selectedWorkKey) ?? null,
)

const showEditionView = computed(() =>
  Boolean(props.selectedWorkKey || props.editionsLoading || props.editionsError || props.editions.length),
)

const existingInputBook = computed(() =>
  parsedInput.value.isbn ? existingBookForIsbns([parsedInput.value.isbn]) : null,
)

function parseDraftInput(value) {
  const raw = value.trim()
  const isbn = raw.replace(/[^0-9Xx]/g, '')
  const isIsbn = /^(97[89])?\d{9}[\dXx]$/.test(isbn)
  return {
    title: isIsbn ? '' : raw,
    isbn: isIsbn ? isbn : '',
  }
}

function normalizeIsbn(value) {
  return String(value ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
}

function bookIsbns(book) {
  return [book?.isbn, ...(book?.isbnCandidates ?? [])]
    .map(normalizeIsbn)
    .filter(Boolean)
}

function existingBookForIsbns(isbns = []) {
  const normalized = new Set(isbns.map(normalizeIsbn).filter(Boolean))
  if (!normalized.size) return null
  return props.existingBooks.find(book => bookIsbns(book).some(isbn => normalized.has(isbn))) ?? null
}

function editionIsbnRows(edition) {
  const rows = [
    ...((edition.isbn13 ?? []).map(isbn => ({ label: 'ISBN-13', value: isbn }))),
    ...((edition.isbn10 ?? []).map(isbn => ({ label: 'ISBN-10', value: isbn }))),
  ]
  if (rows.length) return rows
  return (edition.isbnCandidates ?? []).map(isbn => ({ label: 'ISBN', value: isbn }))
}

function currentSearchOptions() {
  return {
    language: searchLanguage.value,
    format: searchFormat.value,
    sort: searchSort.value,
  }
}

function emitManualDraft() {
  const parsed = parseDraftInput(props.searchQuery)
  emit('draft', {
    result: {
      title: parsed.title,
      authors: [],
      isbn: parsed.isbn,
      language: '',
      sourceName: 'Manual',
    },
    status: defaultAddStatus.value,
  })
}

function handlePrimaryAction() {
  handleSearchClick()
}

function handleSearchClick() {
  const parsed = parsedInput.value
  if (parsed.isbn) {
    emit('isbn-search', parsed.isbn)
    return
  }
  emit('search-title', currentSearchOptions())
}

function loadEditions(result) {
  emit('load-editions', { result, options: currentSearchOptions() })
}

function editionMeta(edition) {
  return [
    edition.publishedDate,
    edition.publisher,
    edition.languages?.length ? edition.languages.map(l => l.toUpperCase()).join('/') : null,
    edition.format,
    edition.pageCount ? `${edition.pageCount} p` : null,
  ].filter(Boolean).join(' · ')
}

function handleBarcodeScan(code) {
  showScanner.value = false
  const cleaned = code.replace(/[^0-9Xx]/g, '')
  emit('update:searchQuery', cleaned)
  emit('draft', {
    result: {
      title: '',
      authors: [],
      isbn: cleaned,
      language: '',
      sourceName: 'ISBN scan',
    },
    status: defaultAddStatus.value,
  })
}
</script>

<template>
  <div class="overlay search-overlay" @click="emit('close')">
    <div class="search-overlay-content" @click.stop>
      <div class="search-overlay-header">
        <div class="book-search-primary-row">
          <div class="search-input-wrap">
            <input
              ref="searchInputRef"
              :value="searchQuery"
              @input="emit('update:searchQuery', $event.target.value)"
              type="text"
              placeholder="Title or ISBN..."
              class="search-input"
              @keydown.enter="handlePrimaryAction"
            />
            <button v-if="searchQuery" class="search-clear-btn" @click="emit('update:searchQuery', '')">✕</button>
          </div>
          <button class="hltb-search-btn" :disabled="loading || !searchQuery.trim()" @click="handleSearchClick">
            {{ loading ? '...' : (parsedInput.isbn ? 'Prepare' : 'Search') }}
          </button>
          <button class="hltb-search-btn desktop-manual-btn" @click="emitManualDraft">
            Manual
          </button>
          <button class="hltb-search-btn book-search-close-btn" @click="emit('close')">✕</button>
        </div>
        <div class="book-search-secondary-row">
          <button
            class="hltb-search-btn scan-btn"
            :class="{ active: showScanner }"
            @click="showScanner = !showScanner"
            title="Scan ISBN barcode"
          >Barcode</button>
          <button class="hltb-search-btn mobile-manual-btn" @click="emitManualDraft">
            Manual
          </button>
        </div>
      </div>

      <div class="book-search-filters">
        <label class="book-search-filter">
          <span>Language</span>
          <select v-model="searchLanguage">
            <option value="any">Any</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
          </select>
        </label>
        <label class="book-search-filter">
          <span>Format</span>
          <select v-model="searchFormat">
            <option value="any">Any</option>
            <option value="paperback">Paperback</option>
            <option value="hardcover">Hardcover</option>
            <option value="ebook">E-Book</option>
          </select>
        </label>
        <label class="book-search-filter">
          <span>Sort</span>
          <select v-model="searchSort">
            <option value="relevance">Best match</option>
            <option value="new">Newer</option>
          </select>
        </label>
      </div>

      <!-- Barcode Scanner (mobile only) -->
      <BarcodeScanner
        v-if="showScanner && isMobile"
        @scanned="handleBarcodeScan"
        @close="showScanner = false"
      />

      <div class="search-active-list">
        Add to <strong>{{ addToLabel }}</strong>
      </div>

      <div v-if="existingInputBook" class="book-existing-notice">
        Already in library: <strong>{{ existingInputBook.title }}</strong>
      </div>

      <p v-if="error" class="book-search-error">{{ error }}</p>

      <div v-if="!showEditionView && results.length > 0" class="search-results-grid">
        <div v-for="result in results" :key="`${result.openLibraryWorkKey}-${result.isbnCandidates?.[0]}`" class="search-result-card">
          <img v-if="result.coverUrl" :src="result.coverUrl" :alt="result.title" class="search-result-img" />
          <div v-else class="search-result-img search-result-placeholder">{{ result.title?.[0] ?? '?' }}</div>
          <div class="search-result-info">
            <div class="search-result-name">{{ result.title }}</div>
            <div v-if="result.authors?.length" class="search-result-author">{{ result.authors.slice(0, 2).join(', ') }}</div>
            <div class="search-result-meta">
              <span v-if="result.firstPublishYear">{{ result.firstPublishYear }}</span>
              <span v-if="result.languages?.length">{{ result.languages.map(l => l.toUpperCase()).join('/') }}</span>
              <span v-if="result.editionCount">{{ result.editionCount }} editions</span>
            </div>
            <div v-if="result.isbnCandidates?.length" class="search-result-isbn">
              ISBN {{ result.isbnCandidates[0] }}
            </div>
            <div class="search-result-actions">
              <button class="search-result-add-btn primary" @click="emit('use-result', result)">
                Use ISBN
              </button>
              <button
                class="search-result-add-btn"
                :class="{ active: selectedWorkKey === result.openLibraryWorkKey }"
                :disabled="!result.openLibraryWorkKey || editionsLoading"
                @click="loadEditions(result)"
              >
                Editions
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showEditionView" class="book-editions-section">
        <div class="book-editions-header">
          <button class="book-editions-back-btn" type="button" @click="emit('clear-editions')">
            Back to results
          </button>
          <span v-if="editionsLoading">Loading...</span>
          <span v-else>{{ editions.length }}</span>
        </div>
        <div v-if="selectedResult" class="book-editions-context">
          <img v-if="selectedResult.coverUrl" :src="selectedResult.coverUrl" :alt="selectedResult.title" />
          <div>
            <div class="book-editions-title">{{ selectedResult.title }}</div>
            <div v-if="selectedResult.authors?.length" class="book-editions-author">{{ selectedResult.authors.slice(0, 2).join(', ') }}</div>
          </div>
        </div>
        <p v-if="editionsError" class="book-search-error">{{ editionsError }}</p>
        <div v-else class="book-editions-list">
          <div
            v-for="edition in editions"
            :key="`${edition.openLibraryEditionKey}-${edition.isbnCandidates?.[0]}`"
            class="book-edition-row"
            :class="{ owned: existingBookForIsbns(edition.isbnCandidates) }"
          >
            <img v-if="edition.coverUrl" :src="edition.coverUrl" :alt="edition.title" class="book-edition-cover" />
            <div v-else class="book-edition-cover search-result-placeholder">{{ edition.title?.[0] ?? '?' }}</div>
            <div class="book-edition-info">
              <div class="book-edition-title">{{ edition.title }}</div>
              <div v-if="editionMeta(edition)" class="book-edition-meta">{{ editionMeta(edition) }}</div>
              <div v-if="editionIsbnRows(edition).length" class="book-edition-isbns">
                <span v-for="row in editionIsbnRows(edition)" :key="`${row.label}-${row.value}`">
                  {{ row.label }} {{ row.value }}
                </span>
              </div>
              <div v-if="existingBookForIsbns(edition.isbnCandidates)" class="book-edition-owned">
                Already in library: {{ existingBookForIsbns(edition.isbnCandidates).title }}
              </div>
            </div>
            <button class="search-result-add-btn primary book-edition-use-btn" @click="emit('use-edition', edition)">
              Use edition
            </button>
          </div>
        </div>
      </div>

      <div v-if="!showScanner && !loading && !showEditionView && results.length === 0" class="hltb-empty">
        Search by title, scan/type an ISBN, or continue manually.
      </div>
    </div>
  </div>
</template>

<style scoped>
.search-result-author {
  font-size: 10px;
  color: var(--text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-series {
  font-size: 9px;
  color: #10b981;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.search-result-meta,
.search-result-isbn {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: var(--text-dim);
  font-size: 9px;
}

.search-result-isbn {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}

.book-search-error {
  margin-bottom: 10px;
  color: #fca5a5;
  font-size: 12px;
}

.search-result-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface3);
  color: var(--text-dim);
  font-size: 24px;
  font-weight: 700;
}

.scan-btn {
  display: none;
  background: var(--surface3) !important;
  border: 1px solid var(--border2) !important;
  color: var(--text-muted) !important;
  padding: 4px 10px !important;
  min-width: 36px;
  transition: all 0.15s;
}

.scan-btn:hover {
  color: var(--accent) !important;
  border-color: var(--accent) !important;
}

.scan-btn.active {
  background: rgb(var(--accent-rgb) / 0.15) !important;
  border-color: var(--accent) !important;
  color: var(--accent) !important;
}

.book-search-primary-row,
.book-search-secondary-row {
  display: contents;
}

.book-search-close-btn {
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text-muted);
}

.mobile-manual-btn {
  display: none;
}

.book-existing-notice {
  padding: 7px 9px;
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 2px;
  background: rgba(16, 185, 129, 0.1);
  color: var(--text);
  font-size: 11px;
}

.book-search-filters {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.book-search-filter {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.book-search-filter span {
  color: var(--text-dim);
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.book-search-filter select {
  min-width: 0;
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: var(--surface2);
  color: var(--text);
  font-size: 11px;
}

.search-result-add-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.search-result-add-btn.active {
  border-color: var(--accent);
  color: var(--accent-light);
}

.book-editions-section {
  border-top: 1px solid var(--border2);
  padding-top: 12px;
}

.book-editions-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--text-dim);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.book-editions-back-btn {
  padding: 5px 8px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
}

.book-editions-back-btn:hover {
  background: var(--surface3);
  color: var(--text);
}

.book-editions-context {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface2);
}

.book-editions-context img {
  width: 34px;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 2px;
}

.book-editions-title {
  color: var(--text);
  font-size: 12px;
  font-weight: 700;
}

.book-editions-author {
  color: var(--text-dim);
  font-size: 10px;
}

.book-editions-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.book-edition-row {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 2px;
  background: var(--surface2);
}

.book-edition-row.owned {
  border-color: rgba(16, 185, 129, 0.45);
  background: rgba(16, 185, 129, 0.08);
}

.book-edition-cover {
  width: 42px;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 2px;
}

.book-edition-info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.book-edition-title {
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-edition-meta {
  color: var(--text-dim);
  font-size: 10px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-edition-isbns {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.book-edition-isbns span {
  padding: 1px 4px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  color: var(--text-dim);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 9px;
}

.book-edition-owned {
  color: #10b981;
  font-size: 10px;
  font-weight: 600;
}

.book-edition-use-btn {
  min-width: 88px;
}

@media (max-width: 768px) {
  .search-overlay-header {
    align-items: stretch;
    flex-direction: column;
    gap: 8px;
  }

  .book-search-primary-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto 36px;
    gap: 8px;
    align-items: center;
  }

  .book-search-primary-row .hltb-search-btn {
    min-height: 36px;
    padding-inline: 10px;
  }

  .desktop-manual-btn {
    display: none;
  }

  .mobile-manual-btn {
    display: inline-flex;
  }

  .book-search-secondary-row {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .book-search-secondary-row .hltb-search-btn {
    align-items: center;
    justify-content: center;
    min-height: 36px;
    width: 100%;
  }

  .scan-btn {
    display: inline-flex;
    min-width: 0;
  }

  .book-search-filters {
    grid-template-columns: 1fr;
  }

  .book-edition-row {
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .book-edition-cover {
    width: 36px;
  }

  .book-edition-use-btn {
    grid-column: 1 / -1;
    width: 100%;
  }
}
</style>
