<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import AiAssistant from './shared/AiAssistant.vue'
import CompletionDateEditor from './shared/CompletionDateEditor.vue'
import MediaCard from './shared/MediaCard.vue'
import { formatReleaseDate, isFutureRelease } from '../utils/releaseDate.js'
import configText from '../../media-library/config.yaml?raw'

defineProps({ mediaType: { type: String, default: 'movie' } })
const emit = defineEmits(['switch-media'])
import { loadMovies, addMovie, updateMovie, deleteMovie, searchTmdb } from '../services/mediaStorage.js'
import { loadNext, saveNext, removeFromNext } from '../services/gameStorage.js'

const movieList = ref([])
const nextList = ref([])
const loading = ref(true)

const tabs = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'finished', label: 'Finished' },
  { id: 'all', label: 'All' },
]

const statusOptions = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'finished', label: 'Finished' },
]

const MOBILE_BREAKPOINT = 768
const isMobileLayout = ref(typeof window !== 'undefined' ? window.innerWidth <= MOBILE_BREAKPOINT : false)

// UI
const sidebarOpen = ref(!isMobileLayout.value)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')
const viewMode = ref(localStorage.getItem('viewMode') || 'grid')
const gridDensity = ref(localStorage.getItem('gridDensity') || 'normal')
const showAiAssistant = ref(false)

const configVersionMatch = configText.match(/version:\s*["']([^"']+)["']/)
const configVersion = configVersionMatch?.[1] ?? 'unbekannt'

const activeTab = ref('watchlist')
const searchQuery = ref('')
const genreFilter = ref([])
const providerFilter = ref([])
const sortBy = ref('title') // title | year | rating
const sortDirection = ref('asc')

function handleResize() {
  isMobileLayout.value = window.innerWidth <= MOBILE_BREAKPOINT
}

// Overlays
const overlayMovie = ref(null)
const showOverlay = ref(false)
const deleteConfirm = ref(false)
const overlayTab = ref('options')

const sortedTrailerLinks = computed(() => {
  const videos = overlayMovie.value?.videos ?? []
  if (!videos.length) return []
  return [...videos].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
})

// TMDB Search Overlay
const showSearchOverlay = ref(false)
const tmdbSearchQuery = ref('')
const tmdbResults = ref([])
const tmdbLoading = ref(false)
const tmdbError = ref('')
const tmdbSearched = ref(false)
const searchInputRef = ref(null)

watch(viewMode, val => localStorage.setItem('viewMode', val))
watch(gridDensity, val => localStorage.setItem('gridDensity', val))
watch(darkMode, val => localStorage.setItem('darkMode', val))
watch(isMobileLayout, (mobile) => {
  if (mobile) sidebarOpen.value = false
})

onMounted(async () => {
  document.body.classList.toggle('light-mode', !darkMode.value)
  document.addEventListener('keydown', handleGlobalKeydown)
  window.addEventListener('resize', handleResize)
  try {
    const [movies, next] = await Promise.all([loadMovies(), loadNext('movie')])
    movieList.value = movies
    nextList.value = next
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  window.removeEventListener('resize', handleResize)
})

const statusCounts = computed(() => {
  const counts = {}
  for (const t of tabs) if (t.id !== 'all') counts[t.id] = 0
  for (const m of movieList.value) counts[m.status] = (counts[m.status] ?? 0) + 1
  counts.all = movieList.value.length
  return counts
})

const allGenres = computed(() => {
  const set = new Set()
  for (const m of movieList.value) for (const g of (m.genres ?? [])) set.add(g)
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

function applyFilters(list) {
  let base = list

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase()
    base = base.filter(m =>
      (m.title ?? '').toLowerCase().includes(q) || (m.titleDe ?? '').toLowerCase().includes(q),
    )
  }

  if (genreFilter.value.length)
    base = base.filter(m => genreFilter.value.every(g => m.genres?.includes(g)))

  if (providerFilter.value.length)
    base = base.filter(m =>
      (m.streamingProviders ?? []).some(p => providerFilter.value.includes(p.id)),
    )

  return applySort(base)
}

function isNotReleased(movie) {
  return isFutureRelease(movie.releaseDateDe)
}

const baseMovies = computed(() => {
  const base =
    activeTab.value === 'all'
      ? movieList.value
      : movieList.value.filter(m => m.status === activeTab.value)

  if (activeTab.value === 'watchlist' && nextList.value.length) {
    const inNext = new Set(nextList.value.map(String))
    return base.filter(m => !inNext.has(String(m.id)))
  }
  return base
})

const filteredReleasedMovies = computed(() =>
  applyFilters(baseMovies.value.filter(m => !isNotReleased(m))),
)

const filteredNotReleasedMovies = computed(() =>
  applyFilters(baseMovies.value.filter(isNotReleased)),
)

const nextMovies = computed(() => {
  const candidates = nextList.value
    .map(id => movieList.value.find(m => String(m.id) === String(id)))
    .filter(Boolean)
    .filter(m => m.status === 'watchlist')
  return applyFilters(candidates)
})

const effectiveAddStatus = computed(() =>
  activeTab.value === 'all' ? 'watchlist' : activeTab.value,
)

const aiContextItems = computed(() => {
  const seen = new Set()
  const entries = []
  const pushMovie = (movie, note) => {
    if (!movie) return
    const id = String(movie.id)
    if (seen.has(id)) return
    seen.add(id)
    const metadata = [
      movie.year ? String(movie.year) : null,
      movie.rating != null ? `★ ${movie.rating.toFixed(1)}` : null,
      movie.streamingProviders?.length ? movie.streamingProviders.map(p => p.name).slice(0, 3).join(', ') : null,
    ]
      .filter(Boolean)
      .join(' · ')
    entries.push({
      title: movie.title ?? movie.titleDe ?? 'Unbekannter Film',
      status: note ?? movie.status,
      metadata: metadata || 'Keine Details',
    })
  }

  filteredReleasedMovies.value.slice(0, 5).forEach(movie => pushMovie(movie))
  filteredNotReleasedMovies.value.slice(0, 3).forEach(movie => pushMovie(movie, 'Not Released'))

  if (entries.length < 4) {
    nextMovies.value.slice(0, 4).forEach(movie => pushMovie(movie, 'Watch Next'))
  }

  return entries
})

const addStatusLabel = computed(() => {
  const label = statusOptions.find(o => o.id === effectiveAddStatus.value)?.label ?? effectiveAddStatus.value
  return label ? label.charAt(0).toUpperCase() + label.slice(1).toLowerCase() : ''
})

function openOverlay(movie, event) {
  event?.stopPropagation()
  overlayMovie.value = movie
  overlayTab.value = 'options'
  showOverlay.value = true
  deleteConfirm.value = false
}

function closeOverlay() {
  showOverlay.value = false
  overlayMovie.value = null
  deleteConfirm.value = false
  overlayTab.value = 'options'
}

async function changeStatus(newStatus) {
  const movie = overlayMovie.value
  if (!movie || movie.status === newStatus) return
  const wasInNext = nextList.value.includes(String(movie.id))

  showOverlay.value = false
  overlayMovie.value = null

  try {
    const updated = await updateMovie(movie.id, { status: newStatus })
    const idx = movieList.value.findIndex(m => String(m.id) === String(movie.id))
    if (idx !== -1) movieList.value[idx] = updated
  } finally {
    if (wasInNext && newStatus !== 'watchlist') {
      await removeFromNext(movie.id, 'movie')
      nextList.value = nextList.value.filter(id => String(id) !== String(movie.id))
    }
  }
}

async function setUserRating(val) {
  const movie = overlayMovie.value
  if (!movie) return
  const updated = await updateMovie(movie.id, { userRating: val })
  const idx = movieList.value.findIndex(m => String(m.id) === String(movie.id))
  if (idx !== -1) movieList.value[idx] = updated
  overlayMovie.value = updated
}

async function handleDelete() {
  const movie = overlayMovie.value
  if (!movie) return

  if (!deleteConfirm.value) {
    deleteConfirm.value = true
    return
  }

  await deleteMovie(movie.id)
  movieList.value = movieList.value.filter(m => String(m.id) !== String(movie.id))
  nextList.value = nextList.value.filter(id => String(id) !== String(movie.id))
  closeOverlay()
}

async function clearMovieCache() {
  if (!overlayMovie.value) return
  try {
    await fetch(`/api/movies/${overlayMovie.value.id}/cache`, { method: 'DELETE' })
  } catch (err) {
    console.error('failed to clear movie cache', err)
  }
}

async function handleMovieCompletionDateSave(date) {
  if (!overlayMovie.value) return
  try {
    const updated = await updateMovie(overlayMovie.value.id, { completedAt: date })
    const idx = movieList.value.findIndex(m => String(m.id) === String(updated.id))
    if (idx !== -1) movieList.value[idx] = updated
    overlayMovie.value = updated
  } catch (err) {
    console.error('Failed to update movie completion date', err)
  }
}

async function addToNext(movie) {
  if (isNotReleased(movie)) return
  if (nextList.value.length >= 6) return
  const id = String(movie.id)
  if (nextList.value.includes(id)) return
  const newList = [...nextList.value, id]
  await saveNext(newList, 'movie')
  nextList.value = newList
}

async function removeNext(movieId) {
  await removeFromNext(movieId, 'movie')
  nextList.value = nextList.value.filter(id => String(id) !== String(movieId))
}

async function searchTmdbMovies() {
  const q = tmdbSearchQuery.value.trim()
  if (!q) return
  tmdbLoading.value = true
  tmdbError.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  try {
    const results = await searchTmdb(q, 'movie')
    const existingIds = new Set(movieList.value.map(m => String(m.externalId)))
    tmdbResults.value = results.filter(r => !existingIds.has(String(r.id)))
    tmdbSearched.value = true
  } catch (err) {
    tmdbError.value = err.message
  } finally {
    tmdbLoading.value = false
  }
}

async function handleAddMovie(tmdbItem, statusOverride) {
  try {
    const status = statusOverride ?? effectiveAddStatus.value
    const movie = await addMovie({ externalId: tmdbItem.id, status })
    movieList.value.push(movie)
    tmdbResults.value = tmdbResults.value.filter(r => String(r.id) !== String(tmdbItem.id))
  } catch (err) {
    tmdbError.value = err.message
  }
}

function openSearchOverlay() {
  showSearchOverlay.value = true
  tmdbSearchQuery.value = searchQuery.value.trim()
  if (tmdbSearchQuery.value) {
    nextTick(() => { searchTmdbMovies(); nextTick(() => searchInputRef.value?.focus()) })
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
  <div :class="['app-layout', 'theme-movie', { 'light-mode': !darkMode }]">
    <div :class="['main-content', { 'sidebar-closed': !sidebarOpen }]">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list', 'grid-compact': viewMode === 'grid' && gridDensity === 'compact', 'grid-dense': viewMode === 'grid' && gridDensity === 'dense' }">
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

          <div v-if="activeTab === 'watchlist' && nextMovies.length > 0" class="play-next-section">
            <div class="section-label">WATCH NEXT</div>
            <div class="game-grid play-next-grid">
              <MediaCard
                v-for="movie in nextMovies"
                :key="movie.id"
                :title="movie.title"
                :title-de="movie.titleDe"
                :image-url="movie.imageUrl"
                :year="movie.year"
                :is-next="true"
                @click="openOverlay(movie, $event)"
              >
                <template #corner>
                  <button
                    class="card-pn-btn pn-remove-btn"
                    title="Remove from Watch Next"
                    @click.stop="removeNext(movie.id)"
                  >✕</button>
                </template>
                <template #details>
                  <div class="card-row">
                    <div class="card-platform" @click.stop>
                      <template v-if="movie.streamingProviders?.length">
                        <span class="platform-primary">
                          <img
                            :src="movie.streamingProviders[0].logo"
                            class="platform-logo-sm"
                            :title="movie.streamingProviders[0].name"
                          />
                        </span>
                        <img
                          v-for="p in movie.streamingProviders.slice(1)"
                          :key="p.id"
                          :src="p.logo"
                          class="platform-logo-sm"
                          :title="p.name"
                        />
                      </template>
                    </div>
                    <span v-if="movie.runtime" class="card-time">{{ movie.runtime }} min</span>
                  </div>
                  <div v-if="movie.rating != null" class="card-row">
                    <span v-if="movie.certification" class="dlc-count">{{ movie.certification }}</span>
                    <span v-else class="platform-text">Rating</span>
                    <span class="card-rating">★ {{ movie.rating.toFixed(1) }}</span>
                  </div>
                </template>
              </MediaCard>
            </div>
          </div>

          <div v-if="activeTab === 'watchlist' && nextMovies.length > 0" class="list-separator"></div>

          <div class="game-grid">
            <MediaCard
              v-for="movie in filteredReleasedMovies"
              :key="movie.id"
              :title="movie.title"
              :title-de="movie.titleDe"
              :image-url="movie.imageUrl"
              :year="movie.year"
              :is-next="nextList.includes(String(movie.id))"
              @click="openOverlay(movie, $event)"
            >
              <template #corner>
                <button
                  v-if="activeTab === 'watchlist' && !nextList.includes(String(movie.id)) && nextList.length < 6 && !isNotReleased(movie)"
                  class="card-pn-btn"
                  title="Add to Watch Next"
                  @click.stop="addToNext(movie)"
                >›</button>
              </template>

              <template #details>
                <div class="card-row">
                  <div class="card-platform" @click.stop>
                    <template v-if="movie.streamingProviders?.length">
                      <span class="platform-primary">
                        <img
                          :src="movie.streamingProviders[0].logo"
                          class="platform-logo-sm"
                          :title="movie.streamingProviders[0].name"
                        />
                      </span>
                      <img
                        v-for="p in movie.streamingProviders.slice(1)"
                        :key="p.id"
                        :src="p.logo"
                        class="platform-logo-sm"
                        :title="p.name"
                      />
                    </template>
                  </div>
                  <span v-if="movie.runtime" class="card-time">{{ movie.runtime }} min</span>
                </div>
                <div v-if="movie.rating != null" class="card-row">
                  <span class="dlc-count">{{ movie.certification }}</span>
                  <span class="card-rating">★ {{ movie.rating.toFixed(1) }}</span>
                </div>
              </template>
            </MediaCard>
          </div>

          <div
            v-if="activeTab === 'watchlist' && filteredNotReleasedMovies.length"
            class="list-separator"
          ></div>
          <div
            v-if="activeTab === 'watchlist' && filteredNotReleasedMovies.length"
            class="section-label"
          >Not Released (DE)</div>
          <div
            v-if="activeTab === 'watchlist' && filteredNotReleasedMovies.length"
            class="game-grid"
          >
            <MediaCard
              v-for="movie in filteredNotReleasedMovies"
              :key="movie.id"
              :title="movie.title"
              :title-de="movie.titleDe"
              :image-url="movie.imageUrl"
              :year="movie.year"
              :is-next="nextList.includes(String(movie.id))"
              @click="openOverlay(movie, $event)"
            >
              <template #details>
                <div class="card-row">
                  <div class="card-platform" @click.stop>
                    <template v-if="movie.streamingProviders?.length">
                      <span class="platform-primary">
                        <img
                          :src="movie.streamingProviders[0].logo"
                          class="platform-logo-sm"
                          :title="movie.streamingProviders[0].name"
                        />
                      </span>
                      <img
                        v-for="p in movie.streamingProviders.slice(1)"
                        :key="p.id"
                        :src="p.logo"
                        class="platform-logo-sm"
                        :title="p.name"
                      />
                    </template>
                  </div>
                  <span v-if="movie.runtime" class="card-time">{{ movie.runtime }} min</span>
                </div>
                <div v-if="movie.rating != null" class="card-row">
                  <span class="dlc-count">{{ movie.certification }}</span>
                  <span class="card-time">{{ formatReleaseDate(movie.releaseDateDe) }}</span>
                </div>
                <div
                  v-else-if="movie.releaseDateDe && isNotReleased(movie)"
                  class="card-row"
                >
                  <span class="platform-text">DE Release</span>
                  <span class="card-time">{{ formatReleaseDate(movie.releaseDateDe) }}</span>
                </div>
              </template>
            </MediaCard>
          </div>

          <p
            v-if="filteredReleasedMovies.length === 0 && (!filteredNotReleasedMovies.length || activeTab !== 'watchlist')"
            class="empty-state"
          >No movies found</p>
        </template>
      </div>
    </div>

    <div
      v-if="sidebarOpen && isMobileLayout"
      class="sidebar-backdrop"
      @click="sidebarOpen = false"
    ></div>

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
            <div class="search-input-wrap" style="flex: 1">
              <input
                v-model="searchQuery"
                class="search-input"
                placeholder="Search..."
                @keydown.enter="openSearchOverlay"
                @keydown.esc="searchQuery = ''"
              />
              <button v-if="searchQuery" class="search-clear-btn" @click="searchQuery = ''">✕</button>
            </div>
          </div>
          <button class="search-open-btn" @click="openSearchOverlay">Add Movies</button>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-label">AI-Assistent</div>
          <button class="ai-assistant-btn" type="button" @click="showAiAssistant = true">
            KI-Empfehlung
          </button>
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
            <div v-if="viewMode === 'grid'" class="view-toggle">
              <button :class="['view-btn', { active: gridDensity === 'normal' }]" @click="gridDensity = 'normal'">3 cols</button>
              <button :class="['view-btn', { active: gridDensity === 'compact' }]" @click="gridDensity = 'compact'">6 cols</button>
              <button :class="['view-btn', { active: gridDensity === 'dense' }]" @click="gridDensity = 'dense'">9 cols</button>
            </div>
          </div>
          <button class="theme-toggle-btn" @click="toggleDarkMode" style="margin-top: 8px">
            {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
          </button>
            <div class="sidebar-version">Version {{ configVersion }}</div>
        </div>
      </div>
    </aside>

    <!-- Movie Overlay -->
    <div v-if="showOverlay && overlayMovie" class="overlay" @click="closeOverlay">
      <div class="overlay-content" @click.stop>
        <div class="overlay-title">
          <a
            v-if="overlayMovie.linkUrl"
            :href="overlayMovie.linkUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ overlayMovie.title }}
          </a>
          <span v-else>{{ overlayMovie.title }}</span>
        </div>
        <div class="overlay-subtitle">
          <span v-if="overlayMovie.year">{{ overlayMovie.year }}</span>
          <span v-if="overlayMovie.runtime"> · {{ overlayMovie.runtime }} min</span>
          <span v-if="overlayMovie.certification"> · {{ overlayMovie.certification }}</span>
          <CompletionDateEditor
            v-if="overlayMovie && (overlayMovie.completedAt || overlayMovie.status === 'finished')"
            label=" · Finished"
            :value="overlayMovie.completedAt"
            @save="handleMovieCompletionDateSave"
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
              v-for="opt in statusOptions"
              :key="opt.id"
              :class="['status-btn', { active: overlayMovie.status === opt.id }]"
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
                :class="['tag-btn', { active: n === (overlayMovie.userRating ?? 0) }]"
                @click="setUserRating((overlayMovie.userRating ?? 0) === n ? null : n)"
              >{{ n }}</button>
            </div>
          </div>
            <button
              v-if="overlayMovie.status === 'watchlist' && !isNotReleased(overlayMovie)"
              class="clear-cache-btn"
              :disabled="!nextList.includes(String(overlayMovie.id)) && nextList.length >= 6"
              @click="nextList.includes(String(overlayMovie.id)) ? removeNext(overlayMovie.id) : addToNext(overlayMovie)"
            >
              {{ nextList.includes(String(overlayMovie.id)) ? '★ Watch Next' : '☆ Watch Next' }}
            </button>
          <div class="overlay-danger-zone">
            <button class="clear-cache-btn" @click="clearMovieCache">Clear Cache</button>
            

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

        <template v-else-if="overlayTab === 'details'">
          <div class="movie-detail-page">
            <div v-if="overlayMovie.imageUrl" class="movie-detail-cover-large">
              <img :src="overlayMovie.imageUrl" :alt="overlayMovie.title" />
            </div>
            <div class="movie-detail-genres">
              <span class="detail-label" v-if="overlayMovie.genres?.length">Genres</span>
              <div class="detail-genres">
                <span v-for="genre in overlayMovie.genres" :key="genre">{{ genre }}</span>
              </div>
            </div>
          </div>
          <div class="movie-detail-page" v-if="sortedTrailerLinks.length">
            <div class="movie-detail-trailers">
              <span class="detail-label">Videos</span>
              <ul>
                <li v-for="video in sortedTrailerLinks" :key="video.id">
                  <a :href="video.url" target="_blank" rel="noopener noreferrer">{{ video.name }}</a>
                </li>
              </ul>
            </div>
          </div>
        </template>
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
              @keydown.enter="searchTmdbMovies"
            />
            <button v-if="tmdbSearchQuery" class="search-clear-btn" @click="tmdbSearchQuery = ''">✕</button>
          </div>
          <button class="hltb-search-btn" :disabled="!tmdbSearchQuery.trim() || tmdbLoading" @click="searchTmdbMovies">
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
          Search for a movie to add it to your library
        </div>

        <div v-if="tmdbResults.length > 0" class="search-results-grid">
          <div v-for="result in tmdbResults" :key="result.id" class="search-result-card">
            <img v-if="result.imageUrl" :src="result.imageUrl" :alt="result.titleEn" class="search-result-img" />
            <div v-else class="search-result-img" style="background: var(--surface3);"></div>
            <div class="search-result-info">
              <div class="search-result-name search-result-title-year">{{ result.titleEn }}{{ result.year ? ` (${result.year})` : '' }}</div>
              <div class="search-result-actions">
                <button class="search-result-add-btn primary" @click="handleAddMovie(result)">
                  + {{ addStatusLabel }}
                </button>
                <select
                  class="search-result-status-select"
                  @change="handleAddMovie(result, $event.target.value); $event.target.value = ''"
                >
                  <option value="" disabled selected></option>
                  <option v-for="opt in statusOptions" :key="opt.id" :value="opt.id">{{ opt.label }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  <AiAssistant
    v-if="showAiAssistant"
    :media-type="mediaType"
    :active-tab="activeTab"
    :context-items="aiContextItems"
    @close="showAiAssistant = false"
  />
  </div>
</template>

<style scoped>
.movie-detail-page {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: 16px;
  padding: 16px 0;
}

.movie-detail-cover-large {
  width: 100%;
  max-width: 240px;
}

.movie-detail-cover-large img {
  width: 100%;
  max-width: 240px;
  border-radius: 6px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.movie-detail-genres {
  width: 100%;
  text-align: left;
}

.detail-label {
  display: block;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.2em;
  color: var(--text-muted);
  margin-bottom: 6px;
}

.detail-genres {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.detail-genres span {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid var(--border2);
  font-size: 11px;
  color: var(--text);
}

.movie-detail-trailers ul {
  margin: 6px 0 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.movie-detail-trailers li {
  font-size: 13px;
}

.movie-detail-trailers a {
  color: var(--accent-light);
  font-weight: 600;
}
</style>
