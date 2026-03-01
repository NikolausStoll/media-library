<!-- src/components/games/GameFilters.vue -->
<script setup>
defineProps({
  mediaType: { type: String, default: 'game' },
  activeTab: { type: String, required: true },
  sortBy: { type: String, required: true },
  sortDirection: { type: String, required: true },
  platformFilter: { type: Array, default: () => [] },
  storefrontFilter: { type: Array, default: () => [] },
  tagFilter: { type: Array, default: () => [] },
  availablePlatforms: { type: Array, required: true },
  storefronts: { type: Array, required: true },
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
  'sort-name',
  'sort-rating',
  'sort-playtime',
  'set-sort-custom',
  'set-view-mode',
  'set-grid-density',
  'toggle-dark-mode',
])
</script>

<template>
  <div class="sidebar-content">
    <div class="media-switcher">
      <button type="button" :class="['media-switcher-btn', { active: mediaType === 'game' }]" data-media="game" @click="emit('switch-media', 'game')">Games</button>
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
      <button class="search-open-btn" @click="emit('open-search-overlay')">Add Games</button>
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
        <button v-if="activeTab === 'started'" :class="['filter-btn', { active: sortBy === 'custom' }]" @click="emit('set-sort-custom')">Custom Order</button>
        <button :class="['filter-btn', { active: sortBy === 'name' }]" @click="emit('sort-name')">
          Name <span v-if="sortBy === 'name'" class="sort-dir">{{ sortDirection === 'asc' ? 'A→Z' : 'Z→A' }}</span>
        </button>
        <button :class="['filter-btn', { active: sortBy === 'rating' }]" @click="emit('sort-rating')">
          Rating <span v-if="sortBy === 'rating'" class="sort-dir">{{ sortDirection === 'desc' ? '↓' : '↑' }}</span>
        </button>
        <button :class="['filter-btn', { active: sortBy === 'playtime' }]" @click="emit('sort-playtime')">
          Playtime <span v-if="sortBy === 'playtime'" class="sort-dir">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
        </button>
      </div>
    </div>

    <!-- Platform / Storefront / Tags -->
    <div class="sidebar-section">
      <div
        class="sidebar-section-label collapsible"
        @click="emit('toggle-filter-section', 'platformStorefront')"
      >
        Filters
        <span class="collapse-arrow">{{ filterSectionsOpen.platformStorefront ? '▲' : '▼' }}</span>
      </div>
      <div v-show="filterSectionsOpen.platformStorefront">
        <div class="filter-subsection-label">Tags</div>
        <div class="filter-options">
          <button
            v-for="tag in ['physical', '100%']"
            :key="tag"
            :class="['filter-btn', { active: tagFilter.includes(tag) }]"
            @click="emit('toggle-filter', 'tag', tag)"
          >
            {{ tag.charAt(0).toUpperCase() + tag.slice(1) }}
          </button>
        </div>

        <div class="filter-subsection-label">Platform</div>
        <div class="filter-options">
          <button
            v-for="plat in availablePlatforms"
            :key="plat.id"
            :class="['filter-btn', { active: platformFilter.includes(plat.id) }]"
            @click="emit('toggle-filter', 'platform', plat.id)"
          >
            {{ plat.label }}
          </button>
          <button
            :class="['filter-btn', { active: platformFilter.includes('none') }]"
            @click="emit('toggle-filter', 'platform', 'none')"
          >
            No Platform
          </button>
        </div>

        <div class="filter-subsection-label" style="margin-top: 8px">Storefront</div>
        <div class="filter-options">
          <button
            v-for="store in storefronts"
            :key="store.id"
            :class="['filter-btn', { active: storefrontFilter.includes(store.id) }]"
            @click="emit('toggle-filter', 'storefront', store.id)"
          >
            {{ store.label }}
          </button>
        </div>
      </div>
    </div>

    <!-- View & Theme -->
    <div class="sidebar-footer">
      <div class="sidebar-section-label">VIEW</div>
      <div class="view-toggle">
        <button :class="['view-btn', { active: viewMode === 'grid' }]" @click="emit('set-view-mode', 'grid')">Grid</button>
        <button :class="['view-btn', { active: viewMode === 'list' }]" @click="emit('set-view-mode', 'list')">List</button>
      </div>
      <div v-if="viewMode === 'grid'" class="view-toggle" style="margin-top: 8px">
        <button :class="['view-btn', { active: gridDensity === 'normal' }]" @click="emit('set-grid-density', 'normal')">3 cols</button>
        <button :class="['view-btn', { active: gridDensity === 'compact' }]" @click="emit('set-grid-density', 'compact')">6 cols</button>
      </div>
      <button class="theme-toggle-btn" @click="emit('toggle-dark-mode')">
        {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
      </button>
    </div>
  </div>
</template>
