<!-- src/components/games/GameSearchOverlay.vue -->
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

const addToLabel = computed(() => {
  const label = props.tabs.find(t => t.id === props.activeTab)?.label ?? props.activeTab
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
            placeholder="Search HowLongToBeat..."
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
        Search for a game to add it to your library
      </div>

      <div v-if="results.length > 0" class="search-results-grid">
        <div v-for="result in results" :key="result.id" class="search-result-card">
          <img :src="result.imageUrl" :alt="result.name" class="search-result-img" />
          <div class="search-result-info">
            <div class="search-result-name">{{ result.name }}</div>
            <div class="search-result-actions">
              <button
                class="search-result-add-btn primary"
                @click="emit('add', { result, status: activeTab })"
                :title="`Add to ${tabs.find(t => t.id === activeTab)?.label}`"
              >+ {{ tabs.find(t => t.id === activeTab)?.label }}</button>
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
