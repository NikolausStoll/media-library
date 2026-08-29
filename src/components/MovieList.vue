<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import AiAssistant from './shared/AiAssistant.vue'
import CompletionDateEditor from './shared/CompletionDateEditor.vue'
import MediaSwitcher from './shared/MediaSwitcher.vue'
import MediaCard from './shared/MediaCard.vue'
import { formatReleaseDate, isFutureRelease } from '../utils/releaseDate.js'
import { allowsCompactGrid, allowsDenseGrid, readStoredGridDensity } from '../utils/gridDensity.js'
import {
  isMobileLayout as checkMobileLayout,
  isSidebarOverlayLayout,
} from '../utils/breakpoints.js'
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

const isMobileLayout = ref(checkMobileLayout())
const isSidebarOverlay = ref(isSidebarOverlayLayout())
const allowCompactGrid = ref(allowsCompactGrid())
const allowDenseGrid = ref(allowsDenseGrid())

// UI
const sidebarOpen = ref(!isSidebarOverlay.value)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')
const viewMode = ref(localStorage.getItem('viewMode') || 'grid')
const gridDensity = ref(readStoredGridDensity())
const showAiAssistant = ref(false)

const configVersionMatch = configText.match(/version:\s*["']([^"']+)["']/)
const configVersion = configVersionMatch?.[1] ?? 'unbekannt'

const activeTab = ref('watchlist')
const searchQuery = ref('')
const genreFilter = ref([])
const providerFilter = ref([])
const noRatingFilter = ref(false)
const sortBy = ref('title') // title | year | rating
const sortDirection = ref('asc')
const sortSectionOpen = ref(true)
const filterSectionOpen = ref(false)

function clampDensityToViewport() {
  allowCompactGrid.value = allowsCompactGrid()
  allowDenseGrid.value = allowsDenseGrid()
  if (!allowCompactGrid.value && gridDensity.value !== 'normal')
    gridDensity.value = 'normal'
  else if (!allowDenseGrid.value && gridDensity.value === 'dense')
    gridDensity.value = 'compact'
}

function handleResize() {
  isMobileLayout.value = checkMobileLayout()
  isSidebarOverlay.value = isSidebarOverlayLayout()
  clampDensityToViewport()
}

// Overlays
const overlayMovie = ref(null)
const showOverlay = ref(false)
const deleteConfirm = ref(false)
const overlayTab = ref('options')
const showPosterLightbox = ref(false)
const overviewExpanded = ref(false)
const overviewRef = ref(null)
const overviewOverflows = ref(false)
let overviewResizeObserver = null

// Collection
const collectionMovies = ref(null)
const collectionLoading = ref(false)
const collectionError = ref(null)

const libraryExternalIds = computed(() => new Set(movieList.value.map(m => String(m.externalId))))

async function fetchCollectionMovies(collectionId) {
  if (collectionMovies.value !== null) return
  collectionLoading.value = true
  collectionError.value = null
  try {
    const res = await fetch(`/api/tmdb/collection/${collectionId}`)
    if (!res.ok) throw new Error(`${res.status}`)
    collectionMovies.value = await res.json()
  } catch (err) {
    collectionError.value = err.message
    collectionMovies.value = { parts: [] }
  } finally {
    collectionLoading.value = false
  }
}

async function addMovieFromCollection(part) {
  try {
    const movie = await addMovie({ externalId: part.id, status: 'watchlist' })
    movieList.value.push(movie)
  } catch (err) {
    console.error('addMovieFromCollection:', err)
  }
}

function measureOverviewOverflow() {
  const el = overviewRef.value
  if (!el || overviewExpanded.value) return
  overviewOverflows.value = el.scrollHeight > el.clientHeight + 1
}

function setupOverviewObserver() {
  if (overviewResizeObserver) { overviewResizeObserver.disconnect(); overviewResizeObserver = null }
  const el = overviewRef.value
  if (!el) return
  overviewResizeObserver = new ResizeObserver(() => measureOverviewOverflow())
  overviewResizeObserver.observe(el)
}

function teardownOverviewObserver() {
  if (overviewResizeObserver) { overviewResizeObserver.disconnect(); overviewResizeObserver = null }
}

async function refreshOverviewOverflow() {
  await nextTick()
  measureOverviewOverflow()
  if (overlayTab.value === 'details' && overlayMovie.value?.overview)
    setupOverviewObserver()
  else
    teardownOverviewObserver()
}

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
watch(isSidebarOverlay, (overlay) => {
  if (overlay) sidebarOpen.value = false
})

watch(overlayMovie, async (movie) => {
  overviewExpanded.value = false
  overviewOverflows.value = false
  showPosterLightbox.value = false
  collectionMovies.value = null
  collectionLoading.value = false
  collectionError.value = null
  if (movie) {
    await refreshOverviewOverflow()
    if (overlayTab.value === 'details' && movie.collection?.id)
      fetchCollectionMovies(movie.collection.id)
  } else {
    teardownOverviewObserver()
  }
})

watch(overlayTab, async (tab) => {
  if (tab === 'details') {
    await refreshOverviewOverflow()
    if (overlayMovie.value?.collection?.id)
      fetchCollectionMovies(overlayMovie.value.collection.id)
  } else {
    teardownOverviewObserver()
  }
})

watch(overviewExpanded, async (expanded) => {
  if (!expanded) await refreshOverviewOverflow()
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
  teardownOverviewObserver()
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
  { id: 1899, name: 'HBO Max', logo: '/streamingProviders/hbomax.webp' },
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

  if (noRatingFilter.value)
    base = base.filter(m => m.userRating == null)

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

// Swipe to change tabs (mobile)
const touchStartX = ref(0)
const touchStartY = ref(0)
const SWIPE_THRESHOLD = 60
function onSwipeStart(e) {
  if (!e.touches?.length || !isMobileLayout.value) return
  touchStartX.value = e.touches[0].clientX
  touchStartY.value = e.touches[0].clientY
}
function onSwipeEnd(e) {
  if (!e.changedTouches?.length || !isMobileLayout.value) return
  const deltaX = e.changedTouches[0].clientX - touchStartX.value
  const deltaY = e.changedTouches[0].clientY - touchStartY.value
  if (Math.abs(deltaX) <= Math.abs(deltaY) || Math.abs(deltaX) < SWIPE_THRESHOLD) return
  const idx = tabs.findIndex(t => t.id === activeTab.value)
  if (deltaX > 0 && idx > 0) activeTab.value = tabs[idx - 1].id
  else if (deltaX < 0 && idx >= 0 && idx < tabs.length - 1) activeTab.value = tabs[idx + 1].id
}

// Sidebar swipe gestures (tablet/mobile)
const SIDEBAR_SWIPE_THRESHOLD = 55
const SIDEBAR_EDGE_ZONE = 30
let sidebarEdgeSwipeStartX = 0
let sidebarEdgeSwipeStartY = 0
let sidebarEdgeSwipeActive = false
let sidebarCloseSwipeStartX = 0
let sidebarCloseSwipeStartY = 0

function onSidebarEdgeTouchStart(e) {
  if (!isSidebarOverlay.value || sidebarOpen.value || !e.touches?.length) return
  const t = e.touches[0]
  if (t.clientX >= window.innerWidth - SIDEBAR_EDGE_ZONE) {
    sidebarEdgeSwipeStartX = t.clientX
    sidebarEdgeSwipeStartY = t.clientY
    sidebarEdgeSwipeActive = true
  }
}
function onSidebarEdgeTouchEnd(e) {
  if (!sidebarEdgeSwipeActive || !e.changedTouches?.length) return
  sidebarEdgeSwipeActive = false
  const deltaX = e.changedTouches[0].clientX - sidebarEdgeSwipeStartX
  const deltaY = e.changedTouches[0].clientY - sidebarEdgeSwipeStartY
  if (deltaX < -SIDEBAR_SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY))
    sidebarOpen.value = true
}
function onSidebarCloseTouchStart(e) {
  if (!isSidebarOverlay.value || !sidebarOpen.value || !e.touches?.length) return
  sidebarCloseSwipeStartX = e.touches[0].clientX
  sidebarCloseSwipeStartY = e.touches[0].clientY
}
function onSidebarCloseTouchEnd(e) {
  if (!isSidebarOverlay.value || !sidebarOpen.value || !e.changedTouches?.length) return
  const deltaX = e.changedTouches[0].clientX - sidebarCloseSwipeStartX
  const deltaY = e.changedTouches[0].clientY - sidebarCloseSwipeStartY
  if (deltaX > SIDEBAR_SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY))
    sidebarOpen.value = false
}

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
    const res = await fetch(`/api/movies/${overlayMovie.value.id}/cache`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`clearCache failed: ${res.status}`)
    closeOverlay()
    movieList.value = await loadMovies()
  } catch (err) {
    console.error('failed to clear movie cache', err)
  }
}

async function refreshMovieImage() {
  if (!overlayMovie.value) return
  try {
    const res = await fetch(`/api/movies/${overlayMovie.value.id}/cache/image`, { method: 'POST' })
    if (!res.ok) throw new Error(`refreshImage failed: ${res.status}`)
    const updated = { ...overlayMovie.value, ...await res.json() }
    const idx = movieList.value.findIndex(m => String(m.id) === String(updated.id))
    if (idx !== -1) movieList.value[idx] = updated
    overlayMovie.value = updated
    closeOverlay()
    movieList.value = await loadMovies()
  } catch (err) {
    console.error('refreshMovieImage:', err)
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
  if (showPosterLightbox.value) { showPosterLightbox.value = false; return }
  if (showSearchOverlay.value) closeSearchOverlay()
  else if (showOverlay.value) closeOverlay()
}
</script>

<template>
  <div
    :class="['app-layout', 'theme-movie', { 'light-mode': !darkMode }]"
    @touchstart.passive="onSidebarEdgeTouchStart"
    @touchend="onSidebarEdgeTouchEnd"
  >
    <div :class="['main-content', { 'sidebar-closed': !sidebarOpen }]">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list', 'grid-compact': viewMode === 'grid' && gridDensity === 'compact', 'grid-dense': viewMode === 'grid' && gridDensity === 'dense' }">
        <div v-if="loading" class="empty-state">Loading...</div>

        <template v-else>
          <div
            class="tabs-swipe-wrap"
            @touchstart.passive="onSwipeStart"
            @touchend="onSwipeEnd"
          >
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
          </div>
        </template>
      </div>
    </div>

    <div
      v-if="sidebarOpen && isSidebarOverlay"
      class="sidebar-backdrop"
      @click="sidebarOpen = false"
    ></div>

    <button
      :class="['sidebar-toggle-external', { 'sidebar-closed': !sidebarOpen }]"
      @click="sidebarOpen = !sidebarOpen"
    ><span class="toggle-handle">{{ sidebarOpen ? '›' : '‹' }}</span></button>

    <aside
      :class="['sidebar', { collapsed: !sidebarOpen }]"
      @touchstart.passive="onSidebarCloseTouchStart"
      @touchend.stop="onSidebarCloseTouchEnd"
    >
      <div v-show="sidebarOpen" class="sidebar-content">
        <MediaSwitcher :media-type="mediaType" @switch-media="emit('switch-media', $event)" />
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
          <div class="sidebar-section-label collapsible" @click="sortSectionOpen = !sortSectionOpen">
            Sort
            <span class="collapse-arrow">{{ sortSectionOpen ? '▲' : '▼' }}</span>
          </div>
          <div v-show="sortSectionOpen" class="filter-options filter-options-single">
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
          <div class="sidebar-section-label collapsible" @click="filterSectionOpen = !filterSectionOpen">
            Filters
            <span class="collapse-arrow">{{ filterSectionOpen ? '▲' : '▼' }}</span>
          </div>
          <div v-show="filterSectionOpen">
            <div class="filter-options" style="margin-bottom: 8px">
              <button
                :class="['filter-btn', { active: noRatingFilter }]"
                @click="noRatingFilter = !noRatingFilter"
              >
                No Rating
              </button>
            </div>
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
          </div>
        </div>

        <div class="sidebar-section">
          <div class="sidebar-section-label">Streaming Providers</div>
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

        <div class="sidebar-footer">
          <!-- AI recommendation (under review, temporarily hidden)
          <div class="sidebar-section-label">AI Assistant</div>
          <button class="ai-assistant-btn" type="button" @click="showAiAssistant = true">
            Recommendation
          </button>
          -->
          <div class="sidebar-section-label">VIEW</div>
          <div class="view-toggle">
            <button :class="['view-btn', { active: viewMode === 'grid' }]" @click="viewMode = 'grid'">Grid</button>
            <button :class="['view-btn', { active: viewMode === 'list' }]" @click="viewMode = 'list'">List</button>
          </div>
          <div v-if="viewMode === 'grid'" class="view-toggle">
            <button :class="['view-btn', { active: gridDensity === 'normal' }]" @click="gridDensity = 'normal'">3 cols</button>
            <button
              v-if="allowCompactGrid"
              :class="['view-btn', { active: gridDensity === 'compact' }]"
              @click="gridDensity = 'compact'"
            >6 cols</button>
            <button
              v-if="allowDenseGrid"
              :class="['view-btn', { active: gridDensity === 'dense' }]"
              @click="gridDensity = 'dense'"
            >9 cols</button>
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
      <div class="overlay-content movie-overlay-content" @click.stop>
        <button type="button" class="movie-overlay-close-btn" aria-label="Close overlay" @click="closeOverlay">×</button>
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
          <span v-if="overlayMovie.releaseDateDe || overlayMovie.year">{{ formatReleaseDate(overlayMovie.releaseDateDe) || overlayMovie.year }}</span>
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
          <div :class="['movie-options-top', { 'with-cover': overlayMovie.imageFullUrl || overlayMovie.imageUrl }]">
            <div v-if="overlayMovie.imageFullUrl || overlayMovie.imageUrl" class="options-poster-col">
              <button
                type="button"
                class="options-poster-btn"
                title="View poster full size"
                @click.stop="showPosterLightbox = true"
              >
                <img :src="overlayMovie.imageFullUrl || overlayMovie.imageUrl" :alt="overlayMovie.title" />
                <span class="options-poster-zoom-hint" aria-hidden="true">⤢</span>
              </button>
            </div>
            <div class="movie-options-actions">
              <div class="overlay-section-label">Status</div>
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
            </div>
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
            class="watch-next-btn"
            :disabled="!nextList.includes(String(overlayMovie.id)) && nextList.length >= 6"
            @click="nextList.includes(String(overlayMovie.id)) ? removeNext(overlayMovie.id) : addToNext(overlayMovie)"
          >
            {{ nextList.includes(String(overlayMovie.id)) ? '★ Watch Next' : '☆ Watch Next' }}
          </button>
          <div class="overlay-danger-zone">
            <div class="cache-actions">
              <button class="clear-cache-btn" @click="clearMovieCache">Clear Cache</button>
              <button class="clear-cache-btn" @click="refreshMovieImage">Refresh Image</button>
            </div>
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
          <div class="media-detail-page">
            <div v-if="overlayMovie.overview" class="media-detail-section">
              <div class="media-detail-section-title">About</div>
              <p
                ref="overviewRef"
                :class="['media-overview-text', { expanded: overviewExpanded }]"
              >{{ overlayMovie.overview }}</p>
              <button
                v-if="overviewOverflows || overviewExpanded"
                class="media-overview-toggle"
                type="button"
                @click="overviewExpanded = !overviewExpanded"
              >
                {{ overviewExpanded ? 'Show less' : 'Show more' }}
              </button>
            </div>
            <div v-if="overlayMovie.genres?.length" class="media-detail-section">
              <div class="media-detail-section-title">Genres</div>
              <p class="media-inline-list">
                <template v-for="(g, i) in overlayMovie.genres" :key="g">{{ g }}<span v-if="i < overlayMovie.genres.length - 1" class="media-sep"> · </span></template>
              </p>
            </div>
            <div v-if="overlayMovie.directors?.length" class="media-detail-section">
              <div class="media-detail-section-title">Director</div>
              <p class="media-inline-list">
                <template v-for="(d, i) in overlayMovie.directors" :key="d">{{ d }}<span v-if="i < overlayMovie.directors.length - 1" class="media-sep"> · </span></template>
              </p>
            </div>
            <div v-if="overlayMovie.cast?.length" class="media-detail-section">
              <div class="media-detail-section-title">Cast</div>
              <p class="media-inline-list">
                <template v-for="(c, i) in overlayMovie.cast" :key="c.name">{{ c.name }}<span v-if="i < overlayMovie.cast.length - 1" class="media-sep"> · </span></template>
              </p>
            </div>
            <div v-if="overlayMovie.videos?.length" class="media-detail-section media-detail-section-videos">
              <div class="media-detail-section-title">Videos</div>
              <div class="media-video-list">
                <a
                  v-for="v in overlayMovie.videos"
                  :key="v.id"
                  :href="v.url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="media-video-item"
                >
                  <span class="media-video-play">▶</span>
                  <span class="media-video-name">{{ v.name }}</span>
                </a>
              </div>
            </div>
            <div v-if="overlayMovie.collection" class="media-detail-section media-detail-section-collection">
              <div class="media-detail-section-title">Collection: {{ overlayMovie.collection.name }}</div>
              <div v-if="collectionLoading" class="collection-loading">Loading...</div>
              <div v-else-if="collectionMovies?.parts?.length" class="collection-grid">
                <div
                  v-for="part in collectionMovies.parts"
                  :key="part.id"
                  :class="['collection-item', {
                    'collection-item-current': part.id === overlayMovie.externalId,
                    'collection-item-addable': !libraryExternalIds.has(part.id) && part.id !== overlayMovie.externalId,
                  }]"
                  @click="!libraryExternalIds.has(part.id) && part.id !== overlayMovie.externalId ? addMovieFromCollection(part) : undefined"
                >
                  <img v-if="part.imageUrl" :src="part.imageUrl" :alt="part.titleEn ?? ''" class="collection-item-img" />
                  <div v-else class="collection-item-img collection-item-no-img"></div>
                  <div v-if="!libraryExternalIds.has(part.id) && part.id !== overlayMovie.externalId" class="collection-item-add-hint">+</div>
                  <div class="collection-item-title">{{ part.titleEn }}</div>
                  <div v-if="part.year" class="collection-item-year">{{ part.year }}</div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="showPosterLightbox && (overlayMovie?.imageFullUrl || overlayMovie?.imageUrl)"
        class="poster-lightbox"
        @click="showPosterLightbox = false"
      >
        <button
          type="button"
          class="poster-lightbox-close"
          aria-label="Close poster view"
          @click.stop="showPosterLightbox = false"
        >✕</button>
        <img
          :src="overlayMovie.imageFullUrl || overlayMovie.imageUrl"
          :alt="overlayMovie.title"
          class="poster-lightbox-img"
          @click.stop
        />
      </div>
    </Teleport>

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
    :existing-external-ids="movieList.map(m => m.externalId)"
    @close="showAiAssistant = false"
    @movie-added="movieList.push($event)"
  />
  </div>
</template>

<style scoped>
/* ── Overlay scroll ── */
.movie-overlay-content {
  position: relative;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  scrollbar-width: none;
}
.movie-overlay-content::-webkit-scrollbar { display: none; }

.movie-overlay-close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--border2);
  border-radius: 2px;
  background: transparent;
  color: var(--text-muted);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.movie-overlay-close-btn:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface2);
}

/* ── Options: poster + controls grid ── */
.movie-options-top { margin-bottom: 16px; }

.movie-options-top.with-cover {
  display: grid;
  grid-template-columns: minmax(120px, 170px) 1fr;
  gap: 18px;
  align-items: start;
}

.options-poster-col { display: flex; flex-direction: column; }

.options-poster-btn {
  padding: 0;
  border: none;
  background: none;
  cursor: zoom-in;
  position: relative;
  text-align: left;
  width: 100%;
}

.options-poster-btn img {
  width: 100%;
  height: auto;
  border-radius: 4px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  display: block;
}

.options-poster-btn:hover img {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55), 0 0 0 1px rgb(var(--accent-rgb) / 0.45);
}

.options-poster-zoom-hint {
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

.options-poster-btn:hover .options-poster-zoom-hint { opacity: 1; }

.movie-options-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.movie-options-actions .status-buttons { margin: 0; }

/* ── Details tab ── */
.media-detail-page {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
}

.media-detail-section {
  margin-bottom: 14px;
}

.media-detail-section-videos {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 4px;
}

.media-detail-section-collection {
  border-top: 1px solid var(--border);
  padding-top: 14px;
  margin-top: 4px;
}

.collection-loading {
  font-size: 0.78rem;
  color: var(--text-muted);
}

.collection-grid {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  scrollbar-width: none;
}
.collection-grid::-webkit-scrollbar { display: none; }

.collection-item {
  flex-shrink: 0;
  width: 80px;
}

.collection-item-current {
  opacity: 0.45;
}

.collection-item-addable {
  cursor: pointer;
  position: relative;
}

.collection-item-addable:hover .collection-item-img {
  filter: brightness(0.55);
}

.collection-item-add-hint {
  position: absolute;
  top: 0;
  left: 0;
  width: 80px;
  height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 300;
  color: #fff;
  opacity: 0;
  transition: opacity 0.15s;
  pointer-events: none;
}

.collection-item-addable:hover .collection-item-add-hint {
  opacity: 1;
}

.collection-item-img {
  width: 80px;
  height: 120px;
  object-fit: cover;
  border-radius: 2px;
  display: block;
}

.collection-item-no-img {
  background: var(--surface3);
}

.collection-item-title {
  font-size: 0.7rem;
  color: var(--text);
  margin-top: 4px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.collection-item-year {
  font-size: 0.68rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.media-detail-section-title {
  margin: 0 0 5px;
  color: var(--text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.media-overview-text {
  max-width: 850px;
  font-size: 0.78rem;
  color: var(--text);
  line-height: 1.65;
  display: -webkit-box;
  -webkit-line-clamp: 7;
  line-clamp: 7;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin: 0 0 8px;
}

.media-overview-text.expanded {
  display: block;
  overflow: visible;
}

.media-overview-toggle {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--accent-light);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 500;
}

.media-inline-list {
  margin: 0;
  font-size: 0.82rem;
  color: var(--text);
  line-height: 1.55;
}

.media-sep {
  color: var(--text-muted);
}

.media-video-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.media-video-item {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  padding: 5px 6px;
  border-radius: 2px;
  transition: background 0.12s;
}

.media-video-item:hover { background: var(--surface2); }

.media-video-play {
  color: var(--accent-light);
  font-size: 9px;
  flex-shrink: 0;
}

.media-video-name {
  color: var(--text);
  font-size: 0.82rem;
}

/* ── Poster Lightbox ── */
.poster-lightbox {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.92);
}

.poster-lightbox-close {
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

.poster-lightbox-close:hover { background: rgba(0, 0, 0, 0.75); }

.poster-lightbox-img {
  max-width: min(600px, 92vw);
  max-height: 92vh;
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 4px;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.6);
}

.watch-next-btn {
  width: 100%;
  padding: 7px;
  margin-bottom: 12px;
  border-radius: 2px;
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.watch-next-btn:hover { background: var(--surface2); color: var(--text); }
.watch-next-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.watch-next-btn:disabled:hover { background: transparent; color: var(--text-muted); }

/* ── Mobile ── */
@media (max-width: 768px) {
  .movie-options-top.with-cover {
    grid-template-columns: 150px 1fr;
    gap: 12px;
  }

  .movie-options-actions .status-buttons {
    grid-template-columns: 1fr;
  }
}
</style>
