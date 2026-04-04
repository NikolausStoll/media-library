<!-- src/components/books/BookFilters.vue -->
<script setup>
import configText from '../../../media-library/config.yaml?raw'

defineProps({
  mediaType: { type: String, default: 'book' },
  activeTab: { type: String, required: true },
  sortBy: { type: String, required: true },
  sortDirection: { type: String, required: true },
  formatFilter: { type: Array, default: () => [] },
  noRatingFilter: { type: Boolean, default: false },
  availableFormats: { type: Array, required: true },
  filterSectionsOpen: { type: Object, required: true },
  viewMode: { type: String, required: true },
  gridDensity: { type: String, default: 'normal' },
  darkMode: { type: Boolean, required: true },
  searchQuery: { type: String, default: '' },
})

const emit = defineEmits([
  'switch-media',
  'open-search-overlay',
  'update:searchQuery',
  'toggle-filter',
  'toggle-filter-section',
  'sort-title',
  'sort-rating',
  'sort-pages',
  'set-view-mode',
  'set-grid-density',
  'toggle-dark-mode',
  'toggle-no-rating',
])

const configVersionMatch = configText.match(/version:\s*["']([^"']+)["']/)
const configVersion = configVersionMatch?.[1] ?? 'unbekannt'
</script>

<template>
  <div class="sidebar-content">
    <div class="media-switcher">
      <button type="button" :class="['media-switcher-btn', { active: mediaType === 'game' }]" data-media="game" @click="emit('switch-media', 'game')">Games</button>
      <button type="button" :class="['media-switcher-btn', { active: mediaType === 'book' }]" data-media="book" @click="emit('switch-media', 'book')">Books</button>
      <button type="button" :class="['media-switcher-btn', { active: mediaType === 'movie' }]" data-media="movie" @click="emit('switch-media', 'movie')">Movies</button>
      <button type="button" :class="['media-switcher-btn', { active: mediaType === 'series' }]" data-media="series" @click="emit('switch-media', 'series')">Series</button>
    </div>

    <!-- Search -->
    <div class="sidebar-section">
      <div class="sidebar-section-label">SEARCH</div>
      <div class="search-row">
        <div class="search-input-wrap" style="flex: 1">
          <input
            :value="searchQuery"
            @input="emit('update:searchQuery', $event.target.value)"
            type="text"
            placeholder="Search..."
            class="search-input"
            @keydown.enter="emit('open-search-overlay')"
            @keydown.esc="emit('update:searchQuery', '')"
          />
          <button v-if="searchQuery" class="search-clear-btn" @click="emit('update:searchQuery', '')">✕</button>
        </div>
      </div>
      <button class="search-open-btn" @click="emit('open-search-overlay')">Add Books</button>
    </div>

    <!-- Sort -->
    <div class="sidebar-section">
      <div
        class="sidebar-section-label collapsible"
        @click="emit('toggle-filter-section', 'sort')"
      >
        SORT
        <span class="collapse-arrow">{{ filterSectionsOpen.sort ? '▲' : '▼' }}</span>
      </div>
      <div v-show="filterSectionsOpen.sort" class="filter-options filter-options-single">
        <button :class="['filter-btn', { active: sortBy === 'title' }]" @click="emit('sort-title')">
          Title <span v-if="sortBy === 'title'" class="sort-dir">{{ sortDirection === 'asc' ? 'A→Z' : 'Z→A' }}</span>
        </button>
        <button :class="['filter-btn', { active: sortBy === 'rating' }]" @click="emit('sort-rating')">
          Rating <span v-if="sortBy === 'rating'" class="sort-dir">{{ sortDirection === 'desc' ? '↓' : '↑' }}</span>
        </button>
        <button :class="['filter-btn', { active: sortBy === 'pages' }]" @click="emit('sort-pages')">
          Pages <span v-if="sortBy === 'pages'" class="sort-dir">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>
    </div>

    <!-- Format Filter -->
    <div class="sidebar-section">
      <div
        class="sidebar-section-label collapsible"
        @click="emit('toggle-filter-section', 'formatFilter')"
      >
        Filters
        <span class="collapse-arrow">{{ filterSectionsOpen.formatFilter ? '▲' : '▼' }}</span>
      </div>
      <div v-show="filterSectionsOpen.formatFilter">
        <div class="filter-subsection-label">Rating</div>
        <div class="filter-options">
          <button
            :class="['filter-btn', { active: noRatingFilter }]"
            @click="emit('toggle-no-rating')"
          >
            No Rating
          </button>
        </div>

        <div class="filter-subsection-label">Format</div>
        <div class="filter-options">
          <button
            v-for="fmt in availableFormats"
            :key="fmt.id"
            :class="['filter-btn', { active: formatFilter.includes(fmt.id) }]"
            @click="emit('toggle-filter', 'format', fmt.id)"
          >
            {{ fmt.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- View & Theme -->
    <div class="sidebar-footer">
      <div class="sidebar-section-label" style="margin-top: 12px">VIEW</div>
      <div class="view-toggle">
        <button :class="['view-btn', { active: viewMode === 'grid' }]" @click="emit('set-view-mode', 'grid')">Grid</button>
        <button :class="['view-btn', { active: viewMode === 'list' }]" @click="emit('set-view-mode', 'list')">List</button>
      </div>
      <div v-if="viewMode === 'grid'" class="view-toggle">
        <button :class="['view-btn', { active: gridDensity === 'normal' }]" @click="emit('set-grid-density', 'normal')">3 cols</button>
        <button :class="['view-btn', { active: gridDensity === 'compact' }]" @click="emit('set-grid-density', 'compact')">6 cols</button>
        <button :class="['view-btn', { active: gridDensity === 'dense' }]" @click="emit('set-grid-density', 'dense')">9 cols</button>
      </div>
      <button class="theme-toggle-btn" @click="emit('toggle-dark-mode')" style="margin-top: 8px">
        {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
      </button>
      <div class="sidebar-version">Version {{ configVersion }}</div>
    </div>
  </div>
</template>
