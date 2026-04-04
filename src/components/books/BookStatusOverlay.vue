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
  'clear-cache',
  'delete-trigger',
  'delete-confirm',
  'delete-cancel',
  'update-completion-date',
  'update-user-rating',
])

const overlayTab = ref('options')
watch(
  book,
  (value) => {
    if (value) overlayTab.value = 'options'
  },
  { immediate: true },
)

function truncateDescription(text, maxLen = 300) {
  if (!text || text.length <= maxLen) return text
  return text.slice(0, maxLen) + '…'
}
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div class="overlay-content" @click.stop>
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
        <span v-if="book?.publishedDate"> · {{ book.publishedDate }}</span>
        <CompletionDateEditor
          v-if="book && (book.completedAt || book.status === 'completed')"
          label=" · Completed"
          :value="book.completedAt"
          @save="(date) => emit('update-completion-date', { id: book.id, completedAt: date })"
        />
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
          <button class="clear-cache-btn" @click="emit('clear-cache', book)">Clear Cache</button>

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
          <div v-if="book?.imageUrl" class="detail-cover">
            <img :src="book.imageUrl" :alt="book?.title" />
          </div>
          <div class="detail-info">
            <div class="detail-metrics">
              <div v-if="book?.pageCount" class="metric-box metric-box-all">
                <span class="metric-label">Pages</span>
                <span class="metric-value">{{ book.pageCount }}</span>
              </div>
              <div v-if="book?.rating" class="metric-box">
                <span class="metric-label">Google Rating</span>
                <span class="metric-value">{{ book.rating }}★ ({{ book.ratingsCount ?? 0 }})</span>
              </div>
              <div v-if="book?.publisher" class="metric-box">
                <span class="metric-label">Publisher</span>
                <span class="metric-value">{{ book.publisher }}</span>
              </div>
              <div v-if="book?.isbn" class="metric-box">
                <span class="metric-label">ISBN</span>
                <span class="metric-value">{{ book.isbn }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-if="book?.seriesName" class="book-detail-series">
          <span class="book-series-badge-lg">{{ book.seriesName }}{{ book.seriesPosition ? ` #${book.seriesPosition}` : '' }}</span>
        </div>
        <div v-if="book?.description" class="book-detail-description">
          <div class="overlay-section-label">Description</div>
          <p class="book-description-text" v-html="truncateDescription(book.description)"></p>
        </div>
        <div v-if="book?.categories?.length" class="book-detail-categories">
          <div class="overlay-section-label">Categories</div>
          <div class="book-category-chips">
            <span v-for="cat in book.categories" :key="cat" class="book-category-chip">{{ cat }}</span>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
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
  gap: 4px;
  padding: 6px 8px;
  min-height: 60px;
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
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}

.book-detail-series {
  margin-top: 12px;
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

.book-detail-description {
  margin-top: 12px;
}

.book-description-text {
  font-size: 11px;
  color: var(--text-muted);
  line-height: 1.5;
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
}
</style>
