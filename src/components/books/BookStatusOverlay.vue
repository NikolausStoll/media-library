<!-- src/components/books/BookStatusOverlay.vue -->
<script setup>
import { computed, nextTick, onUnmounted, ref, watch, toRefs } from 'vue'
import CompletionDateEditor from '../shared/CompletionDateEditor.vue'

const props = defineProps({
  book: { type: Object, default: null },
  statusOptions: { type: Array, required: true },
  deleteConfirm: { type: Boolean, default: false },
  inReadNext: { type: Boolean, default: false },
  readNextAtLimit: { type: Boolean, default: false },
})
const { book } = toRefs(props)

const emit = defineEmits([
  'close',
  'change-status',
  'toggle-read-next',
  'delete-trigger',
  'delete-confirm',
  'delete-cancel',
  'update-completion-date',
  'update-user-rating',
  'edit-details',
])

const overlayTab = ref('options')
const descriptionExpanded = ref(false)
const descriptionRef = ref(null)
const descriptionOverflows = ref(false)
const showCoverLightbox = ref(false)
let descriptionResizeObserver = null

const coverFullSrc = computed(() => book.value?.coverPath || book.value?.imageUrl || null)

const alternateTitleDisplay = computed(() => {
  const alt = String(book.value?.alternateTitle ?? '').trim()
  const title = String(book.value?.title ?? '').trim()
  if (!alt || alt === title) return ''
  return alt
})

function measureDescriptionOverflow() {
  const el = descriptionRef.value
  if (!el || descriptionExpanded.value) return
  descriptionOverflows.value = el.scrollHeight > el.clientHeight + 1
}

function setupDescriptionObserver() {
  teardownDescriptionObserver()
  const el = descriptionRef.value
  if (!el) return
  descriptionResizeObserver = new ResizeObserver(() => {
    measureDescriptionOverflow()
  })
  descriptionResizeObserver.observe(el)
}

function teardownDescriptionObserver() {
  descriptionResizeObserver?.disconnect()
  descriptionResizeObserver = null
}

async function refreshDescriptionOverflow() {
  await nextTick()
  measureDescriptionOverflow()
  if (overlayTab.value === 'details' && book.value?.description)
    setupDescriptionObserver()
  else
    teardownDescriptionObserver()
}

watch(
  book,
  async (value) => {
    if (value) {
      overlayTab.value = 'options'
      descriptionExpanded.value = false
      descriptionOverflows.value = false
      showCoverLightbox.value = false
      await refreshDescriptionOverflow()
    } else {
      teardownDescriptionObserver()
      descriptionOverflows.value = false
    }
  },
  { immediate: true },
)

watch(overlayTab, async (tab) => {
  if (tab === 'details')
    await refreshDescriptionOverflow()
  else
    teardownDescriptionObserver()
})

watch(descriptionExpanded, async (expanded) => {
  if (!expanded)
    await refreshDescriptionOverflow()
})

function handleCoverLightboxKeydown(e) {
  if (e.key === 'Escape' && showCoverLightbox.value) {
    e.stopImmediatePropagation()
    showCoverLightbox.value = false
  }
}

watch(showCoverLightbox, (open) => {
  if (open) document.addEventListener('keydown', handleCoverLightboxKeydown, true)
  else document.removeEventListener('keydown', handleCoverLightboxKeydown, true)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleCoverLightboxKeydown, true)
  teardownDescriptionObserver()
})

const MONTHS = {
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

const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const FORMAT_LABELS = {
  hardcover: 'Hardcover',
  paperback: 'Paperback',
  ebook: 'E-Book',
  audiobook: 'Audiobook',
  other: 'Other',
  kindle: 'E-Book',
}

const detailFormats = computed(() =>
  (book.value?.formats ?? [])
    .map(format => format?.format ?? format)
    .filter(Boolean)
    .map(format => FORMAT_LABELS[format] ?? format)
    .join(', '),
)

const isbnDetails = computed(() => {
  const raw = String(book.value?.isbn ?? '').replace(/[^0-9Xx]/g, '').toUpperCase()
  if (!raw) return []

  const rows = []
  if (raw.length === 13) {
    rows.push({ label: 'ISBN-13', value: raw })
    const isbn10 = isbn13To10(raw)
    if (isbn10) rows.push({ label: 'ISBN-10', value: isbn10 })
  } else if (raw.length === 10) {
    rows.push({ label: 'ISBN-10', value: raw })
    rows.push({ label: 'ISBN-13', value: isbn10To13(raw) })
  } else {
    rows.push({ label: 'ISBN', value: raw })
  }
  return rows
})

function pad2(value) {
  return String(value).padStart(2, '0')
}

function formatDisplayDate(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''

  const isoFull = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoFull) return `${isoFull[3]}.${isoFull[2]}.${isoFull[1]}`

  const isoMonth = raw.match(/^(\d{4})-(\d{2})$/)
  if (isoMonth) return `${MONTH_NAMES[Number(isoMonth[2])] ?? isoMonth[2]} ${isoMonth[1]}`

  const yearOnly = raw.match(/^\d{4}$/)
  if (yearOnly) return raw

  const monthDayYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthDayYear) {
    const month = MONTHS[monthDayYear[1].toLowerCase()]
    if (month) return `${pad2(monthDayYear[2])}.${pad2(month)}.${monthDayYear[3]}`
  }

  const dayMonthYear = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (dayMonthYear) {
    const month = MONTHS[dayMonthYear[2].toLowerCase()]
    if (month) return `${pad2(dayMonthYear[1])}.${pad2(month)}.${dayMonthYear[3]}`
  }

  const monthYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (monthYear) {
    const month = MONTHS[monthYear[1].toLowerCase()]
    if (month) return `${MONTH_NAMES[month]} ${monthYear[2]}`
  }

  return raw
}

function isbn13To10(isbn13) {
  if (!/^978\d{10}$/.test(isbn13)) return ''
  const core = isbn13.slice(3, 12)
  let sum = 0
  for (let i = 0; i < core.length; i++) sum += Number(core[i]) * (10 - i)
  const checkValue = (11 - (sum % 11)) % 11
  const check = checkValue === 10 ? 'X' : String(checkValue)
  return `${core}${check}`
}

function isbn10To13(isbn10) {
  const core = `978${isbn10.slice(0, 9)}`
  let sum = 0
  for (let i = 0; i < core.length; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  const check = (10 - (sum % 10)) % 10
  return `${core}${check}`
}
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div class="overlay-content book-overlay-content" @click.stop>
      <div class="book-overlay-btns">
        <button
          class="book-edit-btn"
          title="Edit details"
          aria-label="Edit details"
          @click="emit('edit-details', book)"
        >
          <span class="book-edit-btn-icon" aria-hidden="true">✎</span>
          <span class="book-edit-btn-label">Edit</span>
        </button>
        <button
          class="book-close-btn"
          aria-label="Close overlay"
          @click="emit('close')"
        >
          ×
        </button>
      </div>

      <div class="book-overlay-header">
        <div class="overlay-title">
          <template v-if="book?.linkUrl">
            <a
              class="book-title-link"
              :href="book.linkUrl"
              target="_blank"
              rel="noopener noreferrer"
            >
              {{ book?.title }}
            </a>
          </template>
          <span v-else>{{ book?.title }}</span>
        </div>
        <div v-if="alternateTitleDisplay" class="book-alternate-title-detail">
          {{ alternateTitleDisplay }}
        </div>
        <div class="overlay-subtitle">
          <span v-if="book?.authors?.length">{{ book.authors.join(', ') }}</span>
          <span v-if="book?.publishedDate"> · {{ formatDisplayDate(book.publishedDate) }}</span>
          <CompletionDateEditor
            v-if="book && (book.completedAt || book.status === 'completed')"
            label=" · Completed"
            :value="book.completedAt"
            @save="(date) => emit('update-completion-date', { id: book.id, completedAt: date })"
          />
        </div>
      </div>

      <div class="tabs" style="margin-bottom: 12px;">
        <button :class="['tab', { active: overlayTab === 'options' }]" @click="overlayTab = 'options'">
          Options
        </button>
        <button :class="['tab', { active: overlayTab === 'details' }]" @click="overlayTab = 'details'">
          Details
        </button>
      </div>

      <template v-if="overlayTab === 'options'">
        <div :class="['book-options-top', { 'with-cover': coverFullSrc }]">
          <div v-if="coverFullSrc" class="options-cover-col">
            <button
              type="button"
              class="options-cover-btn"
              title="View cover full size"
              aria-label="View cover full size"
              @click.stop="showCoverLightbox = true"
            >
              <img :src="coverFullSrc" :alt="book?.title" />
              <span class="options-cover-zoom-hint" aria-hidden="true">⤢</span>
            </button>
          </div>
          <div class="book-options-actions">
            <div class="overlay-section-label">Status</div>
            <div class="status-buttons">
              <button
                v-for="option in statusOptions"
                :key="option.id"
                :class="['status-btn', { active: book?.status === option.id }]"
                @click="emit('change-status', option.id)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>
        </div>

        <div class="overlay-tags">
          <div class="overlay-section-label">My Rating</div>
          <div class="tag-buttons">
            <button
              v-for="n in 10"
              :key="n"
              :class="['tag-btn', { active: n === (book?.userRating ?? 0) }]"
              @click="emit('update-user-rating', (book?.userRating ?? 0) === n ? null : n)"
            >{{ n }}</button>
          </div>
        </div>

        <div v-if="book?.status === 'backlog'">
          <button
            class="read-next-btn"
            :disabled="readNextAtLimit"
            @click="emit('toggle-read-next', book)"
          >
            {{ inReadNext ? '★ Read Next' : '☆ Read Next' }}
          </button>
        </div>

        <div class="overlay-danger-zone">
          <template v-if="!deleteConfirm">
            <button class="delete-trigger-btn" @click="emit('delete-trigger')">Delete</button>
          </template>
          <template v-else>
            <p class="delete-confirm-text">Are you sure?</p>
            <div class="delete-confirm-actions">
              <button class="delete-confirm-btn" @click="emit('delete-confirm', book.id)">Delete</button>
              <button class="delete-cancel-btn" @click="emit('delete-cancel')">Cancel</button>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div class="book-detail-page">
          <div v-if="book?.description" class="book-detail-section">
            <div class="book-detail-section-title">Description</div>
            <p
              ref="descriptionRef"
              :class="['book-description-text', { expanded: descriptionExpanded }]"
              v-html="book.description"
            ></p>
            <button
              v-if="descriptionOverflows || descriptionExpanded"
              class="book-description-toggle"
              type="button"
              @click="descriptionExpanded = !descriptionExpanded"
            >
              {{ descriptionExpanded ? 'Show less' : 'Show more' }}
            </button>
          </div>

          <div
            v-if="book?.pageCount || detailFormats || book?.publisher || isbnDetails.length"
            class="book-detail-section"
          >
            <div class="book-detail-section-title">Book Information</div>
            <div class="book-info-list">
              <div v-if="book?.pageCount" class="book-info-row">
                <span class="book-info-label">Pages</span>
                <span class="book-info-value">{{ book.pageCount }}</span>
              </div>
              <div v-if="detailFormats" class="book-info-row">
                <span class="book-info-label">Format</span>
                <span class="book-info-value">{{ detailFormats }}</span>
              </div>
              <div v-if="book?.publisher" class="book-info-row">
                <span class="book-info-label">Publisher</span>
                <span class="book-info-value">{{ book.publisher }}</span>
              </div>
              <div v-for="row in isbnDetails" :key="row.label" class="book-info-row">
                <span class="book-info-label">{{ row.label }}</span>
                <span class="book-info-value isbn-value">{{ row.value }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="showCoverLightbox && coverFullSrc"
      class="cover-lightbox"
      @click="showCoverLightbox = false"
    >
      <button
        type="button"
        class="cover-lightbox-close"
        aria-label="Close cover view"
        @click.stop="showCoverLightbox = false"
      >
        ✕
      </button>
      <img
        :src="coverFullSrc"
        :alt="book?.title"
        class="cover-lightbox-img"
        @click.stop
      />
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Overlay scrolling ── */

.book-overlay-content {
  position: relative;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  scrollbar-width: none;
}

.book-overlay-content::-webkit-scrollbar {
  display: none;
}

/* ── Header ── */

.book-overlay-header {
  padding-right: 72px;
}

.book-title-link {
  color: inherit;
  text-decoration: none;
  font-family: inherit;
  font-size: inherit;
}

.book-alternate-title-detail {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  font-style: italic;
  line-height: 1.35;
}

/* ── Edit + Close buttons ── */

.book-overlay-btns {
  position: absolute;
  top: 18px;
  right: 18px;
  display: flex;
  gap: 6px;
  align-items: center;
}

.book-edit-btn {
  height: 28px;
  min-width: 28px;
  padding: 0 6px;
  border: 1px solid rgb(var(--accent-rgb) / 0.45);
  border-radius: 2px;
  background: rgb(var(--accent-rgb) / 0.14);
  color: var(--accent-light);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-edit-btn:hover {
  background: rgb(var(--accent-rgb) / 0.24);
}

.book-edit-btn-icon {
  display: inline-block;
  transform: scaleX(-1) rotate(5deg);
}

.book-edit-btn-label {
  display: none;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.book-close-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: transparent;
  color: var(--text-muted);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}

.book-close-btn:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface2);
}

/* ── Options Tab ── */

.book-options-top {
  margin-bottom: 16px;
}

.book-options-top.with-cover {
  display: grid;
  grid-template-columns: minmax(120px, 170px) 1fr;
  gap: 18px;
  align-items: start;
}

.options-cover-col {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.options-cover-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  position: relative;
  text-align: left;
  width: 100%;
}

.options-cover-btn img {
  width: 100%;
  height: auto;
  border-radius: 2px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: block;
}

.options-cover-btn:hover img,
.options-cover-btn:focus-visible img {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 0 1px rgb(var(--accent-rgb) / 0.45);
}

.options-cover-zoom-hint {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 22px;
  height: 22px;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.72);
  color: #fff;
  font-size: 13px;
  line-height: 22px;
  text-align: center;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.options-cover-btn:hover .options-cover-zoom-hint,
.options-cover-btn:focus-visible .options-cover-zoom-hint {
  opacity: 1;
}


.book-options-actions {
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
}

.book-options-actions .status-buttons {
  margin: 0;
}

/* ── Details Tab ── */

.book-detail-page {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}

.book-detail-section {
  padding: 16px 0;
  border-top: 1px solid var(--border);
}

.book-detail-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.book-detail-section-title {
  margin: 0 0 10px;
  color: var(--text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.book-description-text {
  max-width: 850px;
  font-size: 0.78rem;
  color: var(--text);
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 8px;
}

.book-description-text.expanded {
  display: block;
  overflow: visible;
  max-width: 850px;
}

.book-description-toggle {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-light);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
}

.book-info-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px 32px;
}

.book-info-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.book-info-label {
  color: var(--text-muted);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.book-info-value {
  color: var(--text);
  font-size: 0.82rem;
  overflow-wrap: anywhere;
}

.isbn-value {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.78rem;
}

/* ── Lightbox ── */

.cover-lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.92);
}

.cover-lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.cover-lightbox-close:hover {
  background: rgba(0, 0, 0, 0.75);
}

.cover-lightbox-img {
  max-width: min(1200px, 92vw);
  max-height: 92vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 2px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

/* ── Desktop: show Edit label ── */

@media (min-width: 769px) {
  .book-edit-btn-icon {
    display: none;
  }

  .book-edit-btn-label {
    display: inline;
  }

  .book-edit-btn {
    font-size: 12px;
    padding: 0 10px;
  }
}

/* ── Mobile ── */

@media (max-width: 768px) {
  .book-options-top.with-cover {
    grid-template-columns: 150px 1fr;
    gap: 12px;
  }

  .book-options-actions .status-buttons {
    grid-template-columns: 1fr;
  }

  .book-info-list {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>
