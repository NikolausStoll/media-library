<!-- src/components/books/BookSearchOverlay.vue -->
<script setup>
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent } from 'vue'

const BarcodeScanner = defineAsyncComponent(() => import('./BarcodeScanner.vue'))

const props = defineProps({
  searchQuery: { type: String, default: '' },
  results: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  tabs: { type: Array, required: true },
  activeTab: { type: String, required: true },
  statusOptions: { type: Array, required: true },
})

const emit = defineEmits(['update:searchQuery', 'search', 'add', 'close'])

const searchInputRef = ref(null)
const showScanner = ref(false)
const MOBILE_BREAKPOINT = 768
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false)

function handleResize() {
  isMobile.value = window.innerWidth <= MOBILE_BREAKPOINT
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

function handleBarcodeScan(code) {
  showScanner.value = false
  const cleaned = code.replace(/[^0-9Xx]/g, '')
  const isIsbn = /^(97[89])?\d{9}[\dXx]$/.test(cleaned)
  const query = isIsbn ? `isbn:${cleaned}` : cleaned
  emit('update:searchQuery', query)
  emit('search')
}
</script>

<template>
  <div class="overlay search-overlay" @click="emit('close')">
    <div class="search-overlay-content" @click.stop>
      <div class="search-overlay-header">
        <div class="search-input-wrap" style="flex: 1">
          <input
            ref="searchInputRef"
            :value="searchQuery"
            @input="emit('update:searchQuery', $event.target.value)"
            type="text"
            placeholder="Search Google Books..."
            class="search-input"
            @keydown.enter="emit('search')"
          />
          <button v-if="searchQuery" class="search-clear-btn" @click="emit('update:searchQuery', '')">✕</button>
        </div>
        <button
          v-if="isMobile"
          class="hltb-search-btn scan-btn"
          :class="{ active: showScanner }"
          @click="showScanner = !showScanner"
          title="Scan ISBN barcode"
        >⌖</button>
        <button class="hltb-search-btn" :disabled="!searchQuery.trim() || loading" @click="emit('search')">
          {{ loading ? '...' : 'Search' }}
        </button>
        <button class="hltb-search-btn" style="background: transparent; border: 1px solid var(--border2); color: var(--text-muted)" @click="emit('close')">✕</button>
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

      <div v-if="results.length === 0 && !loading && !showScanner" class="hltb-empty">
        Search for a book to add it to your library
      </div>

      <div v-if="results.length > 0" class="search-results-grid">
        <div v-for="result in results" :key="result.id" class="search-result-card">
          <img v-if="result.imageUrl" :src="result.imageUrl" :alt="result.title" class="search-result-img" />
          <div v-else class="search-result-img search-result-placeholder">{{ result.title?.[0] ?? '?' }}</div>
          <div class="search-result-info">
            <div class="search-result-name">{{ result.title }}</div>
            <div v-if="result.authors?.length" class="search-result-author">{{ result.authors.join(', ') }}</div>
            <div v-if="result.seriesName" class="search-result-series">{{ result.seriesName }}{{ result.seriesPosition ? ` #${result.seriesPosition}` : '' }}</div>
            <div class="search-result-actions">
              <button
                class="search-result-add-btn primary"
                @click="emit('add', { result, status: defaultAddStatus })"
                :title="`Add to ${statusOptions.find(o => o.id === defaultAddStatus)?.label}`"
              >+ {{ statusOptions.find(o => o.id === defaultAddStatus)?.label }}</button>
              <select
                class="search-result-status-select"
                @change="emit('add', { result, status: $event.target.value }); $event.target.value = ''"
              >
                <option value="" disabled selected></option>
                <option
                  v-for="option in statusOptions"
                  :key="option.id"
                  :value="option.id"
                >{{ option.label }}</option>
              </select>
            </div>
          </div>
        </div>
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
  background: var(--surface3) !important;
  border: 1px solid var(--border2) !important;
  color: var(--text-muted) !important;
  font-size: 16px !important;
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
</style>
