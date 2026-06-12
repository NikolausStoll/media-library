<!-- src/components/books/BookStatusOverlay.vue -->
<script setup>
import { computed, ref, watch, toRefs } from 'vue'
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
watch(
  book,
  (value) => {
    if (value) {
      overlayTab.value = 'options'
      descriptionExpanded.value = false
    }
  },
  { immediate: true },
)

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
    <div class="overlay-content" @click.stop>
      <button class="book-edit-icon-btn" title="Edit details" aria-label="Edit details" @click="emit('edit-details', book)">
        <span aria-hidden="true">✎</span>
      </button>

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
            class="clear-cache-btn"
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
        <div class="overlay-detail-page">
          <div v-if="book?.coverPath || book?.imageUrl" class="detail-cover">
            <img :src="book.coverPath || book.imageUrl" :alt="book?.title" />
          </div>
          <div class="detail-info">
            <div class="detail-metrics">
              <div v-if="book?.pageCount" class="metric-box metric-box-all">
                <span class="metric-label">Pages</span>
                <span class="metric-value">{{ book.pageCount }}</span>
              </div>
              <div v-if="book?.publisher" class="metric-box">
                <span class="metric-label">Publisher</span>
                <span class="metric-value">{{ book.publisher }}</span>
              </div>
              <div v-if="detailFormats" class="metric-box">
                <span class="metric-label">Formats</span>
                <span class="metric-value">{{ detailFormats }}</span>
              </div>
              <div v-for="row in isbnDetails" :key="row.label" class="metric-box">
                <span class="metric-label">{{ row.label }}</span>
                <span class="metric-value isbn-value">{{ row.value }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="book?.seriesName || book?.language" class="book-detail-meta-row">
          <div class="book-detail-series">
            <span v-if="book?.seriesName" class="book-series-badge-lg">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
          </div>
          <span v-if="book?.language" class="book-language-badge-lg">{{ book.language.toUpperCase() }}</span>
        </div>
        <div v-if="book?.description" class="book-detail-description">
          <div class="overlay-section-label">Description</div>
          <p
            :class="['book-description-text', { expanded: descriptionExpanded }]"
            v-html="book.description"
          ></p>
          <button
            class="book-description-toggle"
            type="button"
            @click="descriptionExpanded = !descriptionExpanded"
          >
            {{ descriptionExpanded ? 'Show less' : 'Show more' }}
          </button>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay-content {
  position: relative;
}

.book-overlay-header {
  padding-right: 34px;
}

.book-edit-icon-btn {
  position: absolute;
  top: 18px;
  right: 18px;
  width: 28px;
  height: 28px;
  border: 1px solid rgb(var(--accent-rgb) / 0.45);
  border-radius: 2px;
  background: rgb(var(--accent-rgb) / 0.14);
  color: var(--accent-light);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
}

.book-edit-icon-btn span {
  display: inline-block;
  transform: scaleX(-1) rotate(5deg);
}

.book-edit-icon-btn:hover {
  background: rgb(var(--accent-rgb) / 0.24);
}

.overlay-detail-page {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding-top: 8px;
  align-items: stretch;
}

.book-title-link {
  color: inherit;
  text-decoration: none;
  font-family: inherit;
  font-size: inherit;
}

.detail-cover {
  width: 100%;
  max-width: 200px;
  display: flex;
  flex-direction: column;
}

.detail-cover img {
  width: 100%;
  max-width: 200px;
  height: 100%;
  border-radius: 2px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.detail-info {
  display: flex;
  flex-direction: column;
  gap: 12px;
  flex: 1;
}

.detail-metrics {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
}

.metric-box {
  flex: 1;
  min-width: 0;
  border-radius: 2px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  background: rgb(var(--accent-rgb) / 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 3px;
  padding: 5px 7px;
  min-height: 54px;
}

.metric-box-all {
  background: rgb(var(--accent-rgb) / 0.28);
  border-color: rgb(var(--accent-rgb) / 0.45);
}

.metric-box-all .metric-label,
.metric-box-all .metric-value {
  font-weight: 700;
}

.metric-label {
  font-size: 10px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.metric-value {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.25;
}

.isbn-value {
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  word-break: break-all;
}

.book-detail-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 12px;
}

.book-detail-series {
  min-width: 0;
  display: flex;
  align-items: center;
}

.book-series-badge-lg {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 2px;
  padding: 3px 8px;
}

.book-language-badge-lg {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: auto;
  padding: 3px 8px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  border-radius: 2px;
  color: var(--accent-light);
  font-size: 11px;
  font-weight: 700;
  line-height: 1.3;
}

.book-detail-description {
  margin-top: 12px;
}

.book-description-text {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 6px;
}

.book-description-text.expanded {
  display: block;
  overflow: visible;
}

.book-description-toggle {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-light);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
}

.book-detail-categories {
  margin-top: 10px;
}

.book-category-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.book-category-chip {
  font-size: 10px;
  color: var(--text-muted);
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 2px;
  padding: 2px 6px;
}

@media (max-width: 768px) {
  .metric-box {
    min-height: auto;
  }

  .metric-label {
    font-size: 9px;
  }

  .metric-value {
    font-size: 11px;
  }

  .isbn-value {
    font-size: 10px;
  }
}
</style>
