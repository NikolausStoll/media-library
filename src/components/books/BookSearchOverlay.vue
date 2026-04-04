<!-- src/components/books/BookSearchOverlay.vue -->
<script setup>
import { ref, computed, onMounted } from 'vue'

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
onMounted(() => searchInputRef.value?.focus())

const defaultAddStatus = computed(() =>
  props.activeTab === 'all' ? 'backlog' : props.activeTab,
)

const addToLabel = computed(() => {
  const label = props.statusOptions.find(o => o.id === defaultAddStatus.value)?.label ?? defaultAddStatus.value
  return label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : ''
})
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
        <button class="hltb-search-btn" :disabled="!searchQuery.trim() || loading" @click="emit('search')">
          {{ loading ? '...' : 'Search' }}
        </button>
        <button class="hltb-search-btn" style="background: transparent; border: 1px solid var(--border2); color: var(--text-muted)" @click="emit('close')">✕</button>
      </div>

      <div class="search-active-list">
        Add to <strong>{{ addToLabel }}</strong>
      </div>

      <div v-if="results.length === 0 && !loading" class="hltb-empty">
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
</style>
