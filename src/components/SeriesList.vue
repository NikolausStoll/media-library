<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import MediaCard from './shared/MediaCard.vue'

defineProps({ mediaType: { type: String, default: 'series' } })
const emit = defineEmits(['switch-media'])
import {
  loadSeries,
  addSeries,
  updateSeries,
  deleteSeries,
  searchTmdb,
  loadEpisodes,
  loadEpisodeProgress,
  loadProgressSummary,
  toggleEpisode,
  toggleSeason,
} from '../services/mediaStorage.js'
import { loadNext, saveNext, removeFromNext } from '../services/gameStorage.js'

const seriesList = ref([])
const nextList = ref([])
const loading = ref(true)

const tabs = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching', label: 'Watching' },
  { id: 'finished', label: 'Finished' },
  { id: 'dropped', label: 'Dropped' },
  { id: 'all', label: 'All' },
]

const statusOptions = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching', label: 'Watching' },
  { id: 'paused', label: 'Paused' },
  { id: 'finished', label: 'Finished' },
  { id: 'dropped', label: 'Dropped' },
]

// UI
const sidebarOpen = ref(true)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')
const viewMode = ref(localStorage.getItem('viewMode') || 'grid')

const activeTab = ref('watching')
const searchQuery = ref('')
const genreFilter = ref([])
const providerFilter = ref([])
const sortBy = ref('title') // title | year | rating
const sortDirection = ref('asc')

// Overlay
const overlayItem = ref(null)
const showOverlay = ref(false)
const deleteConfirm = ref(false)
const overlayTab = ref('details') // details | episodes

// Episodes
const episodeList = ref([])
const episodeProgress = ref(new Set())
const episodesLoading = ref(false)

// TMDB Search Overlay
const showSearchOverlay = ref(false)
const tmdbSearchQuery = ref('')
const tmdbResults = ref([])
const tmdbLoading = ref(false)
const tmdbError = ref('')
const tmdbSearched = ref(false)
const searchInputRef = ref(null)

// Card progress per series (lazy, aus Episoden-Overlay befüllt)
const seriesProgress = ref({})

watch(viewMode, val => localStorage.setItem('viewMode', val))
watch(darkMode, val => localStorage.setItem('darkMode', val))

onMounted(async () => {
  document.body.classList.toggle('light-mode', !darkMode.value)
  document.addEventListener('keydown', handleGlobalKeydown)
  try {
    const [series, next, progressSummary] = await Promise.all([
      loadSeries(),
      loadNext('series'),
      loadProgressSummary(),
    ])
    seriesList.value = series
    nextList.value = next
    const nextProgress = {}
    for (const s of series) {
      const id = String(s.id)
      nextProgress[id] = {
        watched: progressSummary[id] ?? 0,
        total: s.episodeCount ?? 0,
      }
    }
    seriesProgress.value = nextProgress
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
})

const statusCounts = computed(() => {
  const counts = {}
  for (const t of tabs) if (t.id !== 'all') counts[t.id] = 0
  for (const s of seriesList.value) {
    if (s.status === 'paused') counts['watching'] = (counts['watching'] ?? 0) + 1
    else counts[s.status] = (counts[s.status] ?? 0) + 1
  }
  counts.all = seriesList.value.length
  return counts
})

const allGenres = computed(() => {
  const set = new Set()
  for (const s of seriesList.value) for (const g of (s.genres ?? [])) set.add(g)
  return [...set].sort()
})

const providerDefinitions = [
  { id: 8, name: 'Netflix', logo: '/streamingProviders/netflix.webp' },
  { id: 337, name: 'Disney', logo: '/streamingProviders/disney.webp' },
  { id: 9, name: 'Prime', logo: '/streamingProviders/prime.webp' },
  { id: 30, name: 'Wow', logo: '/streamingProviders/wow.webp' },
  { id: 2, name: 'Apple', logo: '/streamingProviders/apple.webp' },
  { id: 531, name: 'Paramount', logo: '/streamingProviders/paramount.webp' },
]

function applySort(list) {
  const base =
    sortBy.value === 'year'
      ? [...list].sort((a, b) => (a.year ?? '').localeCompare(b.year ?? ''))
      : sortBy.value === 'rating'
        ? [...list].sort((a, b) => (a.rating ?? 0) - (b.rating ?? 0))
        : [...list].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
  return sortDirection.value === 'asc' ? base : base.reverse()
}

function setSort(key) {
  if (sortBy.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = key
    sortDirection.value = key === 'title' ? 'asc' : 'desc'
  }
}

const watchingSeries = computed(() =>
  seriesList.value.filter(s => s.status === 'watching'),
)
const pausedSeries = computed(() => {
  const paused = seriesList.value.filter(s => s.status === 'paused')
  return applySeriesFilters(paused)
})

function applySeriesFilters(list) {
  let base = list

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    base = base.filter(s =>
      (s.title ?? '').toLowerCase().includes(q) || (s.titleDe ?? '').toLowerCase().includes(q),
    )
  }

  if (genreFilter.value.length)
    base = base.filter(s => genreFilter.value.every(g => s.genres?.includes(g)))

  if (providerFilter.value.length)
    base = base.filter(s =>
      (s.streamingProviders ?? []).some(p => providerFilter.value.includes(p.id)),
    )

  return applySort(base)
}

const filteredSeries = computed(() => {
  const base =
    activeTab.value === 'all'
      ? seriesList.value
      : activeTab.value === 'watching'
        ? watchingSeries.value
        : seriesList.value.filter(s => s.status === activeTab.value)

  if (activeTab.value === 'watchlist' && nextList.value.length) {
    const inNext = new Set(nextList.value.map(String))
    return applySeriesFilters(base.filter(s => !inNext.has(String(s.id))))
  }
  return applySeriesFilters(base)
})

const nextSeries = computed(() => {
  const candidates = nextList.value
    .map(id => seriesList.value.find(s => String(s.id) === String(id)))
    .filter(Boolean)
    .filter(s => s.status === 'watchlist')
  return applySeriesFilters(candidates)
})

const addStatusLabel = computed(() => {
  const label = statusOptions.find(o => o.id === activeTab.value)?.label ?? activeTab.value
  return label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : ''
})

// Episodes computed
const episodesGrouped = computed(() => {
  const map = new Map()
  for (const ep of episodeList.value) {
    if (!map.has(ep.season)) map.set(ep.season, [])
    map.get(ep.season).push(ep)
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([season, episodes]) => ({ season, episodes }))
})

function seasonProgress(season) {
  const eps = episodeList.value.filter(e => e.season === season)
  const watched = eps.filter(e => episodeProgress.value.has(`${e.season}-${e.episode}`))
  return { watched: watched.length, total: eps.length }
}

function isSeasonComplete(season) {
  const { watched, total } = seasonProgress(season)
  return total > 0 && watched === total
}

async function openOverlay(item, event, initialTab = 'details') {
  event?.stopPropagation()
  overlayItem.value = item
  showOverlay.value = true
  deleteConfirm.value = false
  overlayTab.value = 'details'
  episodeList.value = []
  episodeProgress.value = new Set()
  episodesLoading.value = true
  try {
    const [eps, progress] = await Promise.all([loadEpisodes(item.id), loadEpisodeProgress(item.id)])
    episodeList.value = eps
    episodeProgress.value = new Set(progress.map(p => `${p.season}-${p.episode}`))
    seriesProgress.value = {
      ...seriesProgress.value,
      [item.id]: { watched: episodeProgress.value.size, total: episodeList.value.length || item.episodeCount || 0 },
    }
    if (initialTab === 'episodes') overlayTab.value = 'episodes'
  } finally {
    episodesLoading.value = false
  }
}

function cardProgress(item) {
  const p = seriesProgress.value[item.id]
  if (p) return p
  return { watched: 0, total: item.episodeCount || 0 }
}

function isProgressStarted(item) {
  const p = cardProgress(item)
  return p.total > 0 && p.watched > 0 && p.watched < p.total
}

function closeOverlay() {
  showOverlay.value = false
  overlayItem.value = null
  episodeList.value = []
  episodeProgress.value = new Set()
  deleteConfirm.value = false
}

async function changeStatus(newStatus) {
  const item = overlayItem.value
  if (!item || item.status === newStatus) return
  const wasInNext = nextList.value.includes(String(item.id))

  item.status = newStatus
  showOverlay.value = false
  overlayItem.value = null

  try {
    await updateSeries(item.id, { status: newStatus })
  } finally {
    if (wasInNext && newStatus !== 'watchlist') {
      await removeFromNext(item.id, 'series')
      nextList.value = nextList.value.filter(id => String(id) !== String(item.id))
    }
  }
}

async function setUserRating(val) {
  const item = overlayItem.value
  if (!item) return
  const updated = await updateSeries(item.id, { userRating: val })
  const idx = seriesList.value.findIndex(s => String(s.id) === String(item.id))
  if (idx !== -1) seriesList.value[idx] = updated
  overlayItem.value = updated
}

async function handleDelete() {
  const item = overlayItem.value
  if (!item) return

  if (!deleteConfirm.value) {
    deleteConfirm.value = true
    return
  }

  await deleteSeries(item.id)
  seriesList.value = seriesList.value.filter(s => String(s.id) !== String(item.id))
  nextList.value = nextList.value.filter(id => String(id) !== String(item.id))
  closeOverlay()
}

async function clearSeriesCache() {
  if (!overlayItem.value) return
  try {
    await fetch(`${import.meta.env.VITE_API_URL ?? 'http://localhost:8787/api'}/series/${overlayItem.value.id}/cache`, { method: 'DELETE' })
  } catch (err) {
    console.error('clear series cache failed', err)
  }
}

async function addToNext(item) {
  if (nextList.value.length >= 6) return
  const id = String(item.id)
  if (nextList.value.includes(id)) return
  const newList = [...nextList.value, id]
  await saveNext(newList, 'series')
  nextList.value = newList
}

async function removeNext(seriesId) {
  await removeFromNext(seriesId, 'series')
  nextList.value = nextList.value.filter(id => String(id) !== String(seriesId))
}

async function onToggleEpisode(ep) {
  if (!overlayItem.value) return
  const key = `${ep.season}-${ep.episode}`
  const result = await toggleEpisode(overlayItem.value.id, ep.season, ep.episode)
  const next = new Set(episodeProgress.value)
  if (result.watched) next.add(key)
  else next.delete(key)
  episodeProgress.value = next
  const item = overlayItem.value
  seriesProgress.value = {
    ...seriesProgress.value,
    [item.id]: { watched: next.size, total: episodeList.value.length || item.episodeCount || 0 },
  }
}

async function onToggleSeason(season) {
  if (!overlayItem.value) return
  const item = overlayItem.value
  const eps = episodeList.value.filter(e => e.season === season)
  const watched = !isSeasonComplete(season)
  const updated = await toggleSeason(
    item.id,
    season,
    eps.map(e => e.episode),
    watched,
  )
  episodeProgress.value = new Set(updated.map(p => `${p.season}-${p.episode}`))
  seriesProgress.value = {
    ...seriesProgress.value,
    [item.id]: { watched: updated.length, total: episodeList.value.length || item.episodeCount || 0 },
  }
}

async function searchTmdbSeries() {
  const q = tmdbSearchQuery.value.trim()
  if (!q) return
  tmdbLoading.value = true
  tmdbError.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  try {
    tmdbResults.value = await searchTmdb(q, 'series')
    tmdbSearched.value = true
  } catch (err) {
    tmdbError.value = err.message
  } finally {
    tmdbLoading.value = false
  }
}

async function handleAddSeries(tmdbItem, statusOverride) {
  try {
    const status = statusOverride ?? activeTab.value
    const series = await addSeries({ externalId: tmdbItem.id, status })
    seriesList.value.push(series)
    tmdbResults.value = tmdbResults.value.filter(r => String(r.id) !== String(tmdbItem.id))
  } catch (err) {
    tmdbError.value = err.message
  }
}

function openSearchOverlay() {
  showSearchOverlay.value = true
  tmdbSearchQuery.value = searchQuery.value.trim()
  if (tmdbSearchQuery.value) {
    nextTick(() => { searchTmdbSeries(); nextTick(() => searchInputRef.value?.focus()) })
  } else {
    nextTick(() => searchInputRef.value?.focus())
  }
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  tmdbSearchQuery.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  tmdbError.value = ''
}

function toggleDarkMode() {
  darkMode.value = !darkMode.value
  document.body.classList.toggle('light-mode', !darkMode.value)
}

function toggleGenre(g) {
  const i = genreFilter.value.indexOf(g)
  if (i > -1) genreFilter.value.splice(i, 1)
  else genreFilter.value.push(g)
}

function toggleProvider(id) {
  const i = providerFilter.value.indexOf(id)
  if (i > -1) providerFilter.value.splice(i, 1)
  else providerFilter.value.push(id)
}

function handleGlobalKeydown(e) {
  if (e.key !== 'Escape') return
  if (showSearchOverlay.value) closeSearchOverlay()
  else if (showOverlay.value) closeOverlay()
}
</script>

<template>
  <div :class="['app-layout', 'theme-series', { 'light-mode': !darkMode }]">
    <div :class="['main-content', { 'sidebar-closed': !sidebarOpen }]">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list' }">
        <div v-if="loading" class="empty-state">Loading...</div>

        <template v-else>
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab', { active: activeTab === tab.id }]"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span class="tab-count">{{ statusCounts[tab.id] ?? 0 }}</span>
            </button>
          </div>

          <div v-if="activeTab === 'watchlist' && nextSeries.length > 0" class="play-next-section">
            <div class="section-label">WATCH NEXT</div>
            <div class="game-grid play-next-grid">
              <MediaCard
                v-for="item in nextSeries"
                :key="item.id"
                :title="item.title"
                :title-de="item.titleDe"
                :image-url="item.imageUrl"
                :year="item.year"
                :is-next="true"
                @click="openOverlay(item, $event)"
              >
                <template #corner>
                  <button
                    class="card-pn-btn pn-remove-btn"
                    title="Remove from Watch Next"
                    @click.stop="removeNext(item.id)"
                  >✕</button>
                </template>
                <template #details>
                  <div class="card-row">
                    <div class="card-platform" @click.stop>
                      <template v-if="item.streamingProviders?.length">
                        <img
                          v-for="p in item.streamingProviders"
                          :key="p.id"
                          :src="p.logo"
                          class="platform-logo-sm"
                          :title="p.name"
                        />
                      </template>
                    </div>
                    <span v-if="item.runtime" class="card-time">{{ item.runtime }} min</span>
                  </div>
                  <div class="card-row">
                    <div class="card-row-left">
                      <span v-if="item.seasonCount != null" class="dlc-count">{{ item.seasonCount }} {{ item.seasonCount === 1 ? 'Season' : 'Seasons' }}</span>
                      <div
                        class="card-tags"
                        style="cursor: pointer"
                        @click.stop="openOverlay(item, $event, 'episodes')"
                      >
                        <span :class="['platform-text', { 'progress-full': cardProgress(item).total > 0 && cardProgress(item).watched === cardProgress(item).total, 'progress-started': isProgressStarted(item) }]">{{ cardProgress(item).watched }}/{{ cardProgress(item).total }}</span>
                      </div>
                    </div>
                    <span v-if="item.rating != null" class="card-rating">★ {{ item.rating.toFixed(1) }}</span>
                  </div>
                </template>
              </MediaCard>
            </div>
          </div>

          <div v-if="activeTab === 'watchlist' && nextSeries.length > 0" class="list-separator"></div>

          <div class="game-grid">
            <MediaCard
              v-for="item in filteredSeries"
              :key="item.id"
              :title="item.title"
              :title-de="item.titleDe"
              :image-url="item.imageUrl"
              :year="item.year"
              :is-next="nextList.includes(String(item.id))"
              @click="openOverlay(item, $event)"
            >
              <template #corner>
                <button
                  v-if="activeTab === 'watchlist' && !nextList.includes(String(item.id)) && nextList.length < 6"
                  class="card-pn-btn"
                  title="Add to Watch Next"
                  @click.stop="addToNext(item)"
                >›</button>
              </template>

              <template #details>
                <!-- Zeile: Streaming (nur Logos) links, Laufzeit rechts -->
                <div class="card-row">
                  <div class="card-platform" @click.stop>
                    <template v-if="item.streamingProviders?.length">
                      <img
                        v-for="p in item.streamingProviders"
                        :key="p.id"
                        :src="p.logo"
                        class="platform-logo-sm"
                        :title="p.name"
                      />
                    </template>
                  </div>
                  <span v-if="item.runtime" class="card-time">{{ item.runtime }} min</span>
                </div>
                <!-- Zeile: Season (DLC-Rahmen) links, Progress Mitte, Rating rechts -->
                <div class="card-row">
                  <div class="card-row-left">
                    <span v-if="item.seasonCount != null" class="dlc-count">{{ item.seasonCount }} {{ item.seasonCount === 1 ? 'Season' : 'Seasons' }}</span>
                    <div
                      class="card-tags"
                      style="cursor: pointer"
                      @click.stop="openOverlay(item, $event, 'episodes')"
                    >
                      <span :class="['platform-text', { 'progress-full': cardProgress(item).total > 0 && cardProgress(item).watched === cardProgress(item).total, 'progress-started': isProgressStarted(item) }]">{{ cardProgress(item).watched }}/{{ cardProgress(item).total }}</span>
                    </div>
                  </div>
                  <span v-if="item.rating != null" class="card-rating">★ {{ item.rating.toFixed(1) }}</span>
                </div>
              </template>
            </MediaCard>
          </div>

          <template v-if="activeTab === 'watching' && pausedSeries.length > 0">
            <div class="list-separator"></div>
            <div class="section-label">PAUSED</div>
            <div class="game-grid">
              <MediaCard
                v-for="item in pausedSeries"
                :key="item.id"
                :title="item.title"
                :title-de="item.titleDe"
                :image-url="item.imageUrl"
                :year="item.year"
                :is-next="nextList.includes(String(item.id))"
                @click="openOverlay(item, $event)"
              >
                <template #details>
                  <div class="card-row">
                    <div class="card-platform" @click.stop>
                      <template v-if="item.streamingProviders?.length">
                        <img
                          v-for="p in item.streamingProviders"
                          :key="p.id"
                          :src="p.logo"
                          class="platform-logo-sm"
                          :title="p.name"
                        />
                      </template>
                    </div>
                    <span v-if="item.runtime" class="card-time">{{ item.runtime }} min</span>
                  </div>
                  <div class="card-row">
                    <div class="card-row-left">
                      <span v-if="item.seasonCount != null" class="dlc-count">{{ item.seasonCount }} {{ item.seasonCount === 1 ? 'Season' : 'Seasons' }}</span>
                      <div
                        class="card-tags"
                        style="cursor: pointer"
                        @click.stop="openOverlay(item, $event, 'episodes')"
                      >
                        <span :class="['platform-text', { 'progress-full': cardProgress(item).total > 0 && cardProgress(item).watched === cardProgress(item).total, 'progress-started': isProgressStarted(item) }]">{{ cardProgress(item).watched }}/{{ cardProgress(item).total }}</span>
                      </div>
                    </div>
                    <span v-if="item.rating != null" class="card-rating">★ {{ item.rating.toFixed(1) }}</span>
                  </div>
                </template>
              </MediaCard>
            </div>
          </template>

          <p v-if="(activeTab === 'watching' ? filteredSeries.length === 0 && pausedSeries.length === 0 : filteredSeries.length === 0) && !(activeTab === 'watchlist' && nextSeries.length > 0)" class="empty-state">No series found</p>
        </template>
      </div>
    </div>

    <button
      :class="['sidebar-toggle-external', { 'sidebar-closed': !sidebarOpen }]"
      @click="sidebarOpen = !sidebarOpen"
    >{{ sidebarOpen ? '›' : '‹' }}</button>

    <aside :class="['sidebar', { collapsed: !sidebarOpen }]">
      <div v-show="sidebarOpen" class="sidebar-content">
        <div class="media-switcher">
          <button type="button" :class="['media-switcher-btn', { active: mediaType === 'game' }]" data-media="game" @click="emit('switch-media', 'game')">Games</button>
          <button type="button" :class="['media-switcher-btn', { active: mediaType === 'movie' }]" data-media="movie" @click="emit('switch-media', 'movie')">Movies</button>
          <button type="button" :class="['media-switcher-btn', { active: mediaType === 'series' }]" data-media="series" @click="emit('switch-media', 'series')">Series</button>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-section-label">Search</div>
          <div class="search-row">
            <input v-model="searchQuery" class="search-input" placeholder="Search..." @keydown.enter="openSearchOverlay" />
          </div>
          <button class="search-open-btn" @click="openSearchOverlay">Add Series</button>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-label">Sort</div>
          <div class="filter-options filter-options-single">
            <button :class="['filter-btn', { active: sortBy === 'title' }]" @click="setSort('title')">
              <span class="filter-label">Title</span>
              <span class="sort-indicator" v-if="sortBy === 'title'">{{ sortDirection === 'asc' ? 'A→Z' : 'Z→A' }}</span>
            </button>
            <button :class="['filter-btn', { active: sortBy === 'year' }]" @click="setSort('year')">
              <span class="filter-label">Year</span>
              <span class="sort-indicator" v-if="sortBy === 'year'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </button>
            <button :class="['filter-btn', { active: sortBy === 'rating' }]" @click="setSort('rating')">
              <span class="filter-label">Rating</span>
              <span class="sort-indicator" v-if="sortBy === 'rating'">{{ sortDirection === 'asc' ? '↑' : '↓' }}</span>
            </button>
          </div>
        </div>

          <div class="sidebar-section">
            <div class="sidebar-section-label">Filters</div>
            <div v-if="allGenres.length">
              <div class="filter-subsection-label">Genres</div>
              <div class="filter-options">
                <button
                  v-for="g in allGenres"
                  :key="g"
                  :class="['filter-btn', { active: genreFilter.includes(g) }]"
                  @click="toggleGenre(g)"
                >
                  <span>{{ g }}</span>
                </button>
              </div>
            </div>
            <div>
              <div class="filter-subsection-label">Streaming Providers</div>
              <div class="provider-grid">
                <button
                  v-for="provider in providerDefinitions"
                  :key="provider.id"
                  :class="['provider-logo-btn', { active: providerFilter.includes(provider.id) }]"
                  @click="toggleProvider(provider.id)"
                >
                  <img :src="provider.logo" :alt="provider.name" />
                </button>
              </div>
            </div>
          </div>

        <div class="sidebar-footer">
          <div class="view-section">
            <div class="sidebar-section-label">View</div>
            <div class="view-toggle">
              <button :class="['view-btn', { active: viewMode === 'grid' }]" @click="viewMode = 'grid'">Grid</button>
              <button :class="['view-btn', { active: viewMode === 'list' }]" @click="viewMode = 'list'">List</button>
            </div>
          </div>
          <button class="theme-toggle-btn" @click="toggleDarkMode">
            {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
          </button>
        </div>
      </div>
    </aside>

    <!-- Series Overlay -->
    <div v-if="showOverlay && overlayItem" class="overlay" @click="closeOverlay">
      <div class="overlay-content series-overlay" @click.stop>
        <div class="overlay-title">
          <a
            v-if="overlayItem.linkUrl"
            :href="overlayItem.linkUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ overlayItem.title }}
          </a>
          <span v-else>{{ overlayItem.title }}</span>
        </div>
        <div class="overlay-subtitle">
          <span v-if="overlayItem.year">{{ overlayItem.year }}</span>
          <span v-if="overlayItem.seasonCount != null"> · {{ overlayItem.seasonCount }} {{ overlayItem.seasonCount === 1 ? 'Season' : 'Seasons' }}</span>
          <span v-if="overlayItem.episodeCount != null"> · {{ overlayItem.episodeCount }} Episodes</span>
          <span v-if="overlayItem.runtime"> · {{ overlayItem.runtime }} min / Ep</span>
        </div>

        <div class="tabs" style="margin-bottom: 12px;">
          <button :class="['tab', { active: overlayTab === 'details' }]" @click="overlayTab = 'details'">
            Details
          </button>
          <button :class="['tab', { active: overlayTab === 'episodes' }]" @click="overlayTab = 'episodes'">
            Episodes
            <span v-if="episodeList.length" class="tab-count">{{ episodeProgress.size }}/{{ episodeList.length }}</span>
          </button>
        </div>

        <template v-if="overlayTab === 'details'">
          <div class="status-buttons">
            <button
              v-for="opt in statusOptions"
              :key="opt.id"
              :class="['status-btn', { active: overlayItem.status === opt.id }]"
              @click="changeStatus(opt.id)"
            >
              {{ opt.label }}
            </button>
          </div>

          <div class="overlay-tags">
            <div class="overlay-section-label">My Rating</div>
            <div class="tag-buttons">
              <button
                v-for="n in 10"
                :key="n"
                :class="['tag-btn', { active: n === (overlayItem.userRating ?? 0) }]"
                @click="setUserRating((overlayItem.userRating ?? 0) === n ? null : n)"
              >{{ n }}</button>
            </div>
          </div>

          <div class="overlay-danger-zone">
            <button class="clear-cache-btn" @click="clearSeriesCache">Clear Cache</button>
            <button
              v-if="overlayItem.status === 'watchlist'"
              class="clear-cache-btn"
              :disabled="!nextList.includes(String(overlayItem.id)) && nextList.length >= 6"
              @click="nextList.includes(String(overlayItem.id)) ? removeNext(overlayItem.id) : addToNext(overlayItem)"
            >
              {{ nextList.includes(String(overlayItem.id)) ? '★ Watch Next' : '☆ Watch Next' }}
            </button>

            <template v-if="!deleteConfirm">
              <button class="delete-trigger-btn" @click="deleteConfirm = true">Delete</button>
            </template>
            <template v-else>
              <p class="delete-confirm-text">Are you sure?</p>
              <div class="delete-confirm-actions">
                <button class="delete-confirm-btn" @click="handleDelete">Delete</button>
                <button class="delete-cancel-btn" @click="deleteConfirm = false">Cancel</button>
              </div>
            </template>
          </div>
        </template>

        <div v-else class="episodes-tab">
          <div v-if="episodesLoading" class="empty-state">Loading episodes...</div>
          <div v-else-if="!episodesGrouped.length" class="empty-state">No episode data available.</div>
          <template v-else>
            <div v-for="{ season, episodes } in episodesGrouped" :key="season" class="season-block">
              <div class="season-header">
                <span class="season-title">Season {{ season }}</span>
                <span class="season-progress">{{ seasonProgress(season).watched }}/{{ seasonProgress(season).total }}</span>
                <button class="season-toggle-btn" :class="{ complete: isSeasonComplete(season) }" @click="onToggleSeason(season)">
                  {{ isSeasonComplete(season) ? '✓ Complete' : '○ Mark all' }}
                </button>
              </div>

              <div class="episode-list">
                <label
                  v-for="ep in episodes"
                  :key="ep.episode"
                  class="episode-row"
                  :class="{ watched: episodeProgress.has(`${ep.season}-${ep.episode}`) }"
                >
                  <input
                    type="checkbox"
                    :checked="episodeProgress.has(`${ep.season}-${ep.episode}`)"
                    @change="onToggleEpisode(ep)"
                  />
                  <span class="ep-number">E{{ String(ep.episode).padStart(2, '0') }}</span>
                  <span class="ep-title">{{ ep.titleEn || `Episode ${ep.episode}` }}</span>
                  <span class="ep-meta">
                    <span v-if="ep.airDate">{{ ep.airDate?.slice(0, 4) }}</span>
                    <span v-if="ep.runtime">{{ ep.runtime }}m</span>
                  </span>
                </label>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- TMDB Search Overlay -->
    <div v-if="showSearchOverlay" class="overlay search-overlay" @click="closeSearchOverlay">
      <div class="search-overlay-content" @click.stop>
        <div class="search-overlay-header">
          <div class="search-input-wrap" style="flex: 1">
            <input
              ref="searchInputRef"
              v-model="tmdbSearchQuery"
              type="text"
              placeholder="Search TMDB..."
              class="search-input"
              @keydown.enter="searchTmdbSeries"
            />
            <button v-if="tmdbSearchQuery" class="search-clear-btn" @click="tmdbSearchQuery = ''">✕</button>
          </div>
          <button class="hltb-search-btn" :disabled="!tmdbSearchQuery.trim() || tmdbLoading" @click="searchTmdbSeries">
            {{ tmdbLoading ? '...' : 'Search' }}
          </button>
          <button
            class="hltb-search-btn"
            style="background: transparent; border: 1px solid var(--border2); color: var(--text-muted)"
            @click="closeSearchOverlay"
          >✕</button>
        </div>

        <div class="search-active-list">
          Add as <strong>{{ addStatusLabel }}</strong>
        </div>

        <p v-if="tmdbError" class="add-game-error">{{ tmdbError }}</p>
        <div v-if="tmdbResults.length === 0 && !tmdbLoading" class="hltb-empty">
          Search for a series to add it to your library
        </div>

        <div v-if="tmdbResults.length > 0" class="search-results-grid">
          <div v-for="result in tmdbResults" :key="result.id" class="search-result-card">
            <img v-if="result.imageUrl" :src="result.imageUrl" :alt="result.titleEn" class="search-result-img" />
            <div v-else class="search-result-img" style="background: var(--surface3);"></div>
            <div class="search-result-info">
              <div class="search-result-name search-result-title-year">{{ result.titleEn }}{{ result.year ? ` (${result.year})` : '' }}</div>
              <div class="search-result-actions">
                <button class="search-result-add-btn primary" @click="handleAddSeries(result)">
                  + {{ addStatusLabel }}
                </button>
                <select
                  class="search-result-status-select"
                  @change="handleAddSeries(result, $event.target.value); $event.target.value = ''"
                >
                  <option value="" disabled selected>+ Other</option>
                  <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Only the episode list needs component-specific layout */
.series-overlay {
  max-width: 560px;
}

.episodes-tab {
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.season-block { margin-bottom: 14px; }

.season-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 6px;
  position: sticky;
  top: 0;
  background: var(--surface);
  z-index: 1;
}

.season-title { font-weight: 600; color: var(--text); font-size: 12px; }
.season-progress { font-size: 11px; color: var(--text-dim); flex: 1; }

.season-toggle-btn {
  padding: 4px 8px;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: transparent;
  color: var(--text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.season-toggle-btn.complete { border-color: #22c55e; color: #22c55e; }
.season-toggle-btn:hover { border-color: var(--accent); color: var(--accent-light); }

.episode-list { display: flex; flex-direction: column; }

.episode-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-muted);
  transition: background 0.1s;
}
.episode-row:hover { background: var(--surface2); }
.episode-row.watched { color: var(--text-dim); }
.episode-row.watched .ep-title { text-decoration: line-through; }

.episode-row input[type="checkbox"] {
  cursor: pointer;
  accent-color: var(--accent);
  flex-shrink: 0;
}

.ep-number {
  color: var(--text-dim);
  font-size: 11px;
  flex-shrink: 0;
  width: 2.8rem;
  font-variant-numeric: tabular-nums;
}
.ep-title  { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-meta   {
  display: flex;
  gap: 8px;
  color: var(--text-dim);
  font-size: 11px;
  flex-shrink: 0;
}
</style>
