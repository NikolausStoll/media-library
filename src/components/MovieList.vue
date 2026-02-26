<script setup>
import { ref, computed, onMounted } from 'vue'
import MediaCard from './shared/MediaCard.vue'
import StatusOverlay from './shared/StatusOverlay.vue'
import {
  loadMovies, addMovie, updateMovie, updateMovieProviders,
  deleteMovie, searchTmdb
} from '../services/mediaStorage.js'
import { loadNext, saveNext, removeFromNext } from '../services/gameStorage.js'

// ─── State ────────────────────────────────────────────────────────────────────
const movieList   = ref([])
const nextList    = ref([])
const loading     = ref(true)
const activeTab   = ref('watchlist')
const searchQuery = ref('')
const genreFilter = ref([])
const sortBy      = ref('title')

// Add
const showSearchOverlay  = ref(false)
const tmdbSearchQuery    = ref('')
const tmdbResults        = ref([])
const tmdbLoading        = ref(false)
const tmdbError          = ref('')
const tmdbSearched       = ref(false)
const addStatus          = ref('watchlist')

// Overlay
const overlayMovie   = ref(null)
const showOverlay    = ref(false)
const deleteConfirm  = ref(false)
const showStatusMenu = ref(false)

const STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Watchlist', color: '#6366f1' },
  { value: 'watching',  label: 'Watching',  color: '#f59e0b' },
  { value: 'finished',  label: 'Finished',  color: '#22c55e' },
]

const TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching',  label: 'Watching'  },
  { id: 'finished',  label: 'Finished'  },
  { id: 'all',       label: 'All'       },
]

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    [movieList.value, nextList.value] = await Promise.all([
      loadMovies(),
      loadNext('movie'),
    ])
  } finally {
    loading.value = false
  }
})

// ─── Computed ─────────────────────────────────────────────────────────────────
const statusCounts = computed(() => {
  const counts = { watchlist: 0, watching: 0, finished: 0 }
  for (const m of movieList.value) counts[m.status] = (counts[m.status] ?? 0) + 1
  return counts
})

const allGenres = computed(() => {
  const set = new Set()
  for (const m of movieList.value) for (const g of (m.genres ?? [])) set.add(g)
  return [...set].sort()
})

const filteredMovies = computed(() => {
  let base = activeTab.value === 'all'
    ? movieList.value
    : movieList.value.filter(m => m.status === activeTab.value)

  if (searchQuery.value.trim())
    base = base.filter(m =>
      m.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      m.titleDe?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )

  if (genreFilter.value.length)
    base = base.filter(m => genreFilter.value.every(g => m.genres?.includes(g)))

  return [...base].sort((a, b) =>
    sortBy.value === 'year'   ? (b.year ?? '').localeCompare(a.year ?? '') :
    sortBy.value === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) :
    a.title.localeCompare(b.title)
  )
})

const nextMovies = computed(() =>
  nextList.value
    .map(id => movieList.value.find(m => String(m.id) === String(id)))
    .filter(Boolean)
)

// ─── Actions ──────────────────────────────────────────────────────────────────
async function searchTmdbMovies() {
  const q = tmdbSearchQuery.value.trim()
  if (!q) return
  tmdbLoading.value = true
  tmdbError.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  try {
    tmdbResults.value = await searchTmdb(q, 'movie')
    tmdbSearched.value = true
  } catch (err) {
    tmdbError.value = err.message
  } finally {
    tmdbLoading.value = false
  }
}

async function handleAddMovie(tmdbItem) {
  try {
    const movie = await addMovie({
      externalId: tmdbItem.id,
      status: addStatus.value,
    })
    movieList.value.push(movie)
    tmdbResults.value = tmdbResults.value.filter(r => r.id !== tmdbItem.id)
    if (!tmdbResults.value.length) closeSearchOverlay()
  } catch (err) {
    tmdbError.value = err.message
  }
}

function openOverlay(movie) {
  overlayMovie.value = movie
  showOverlay.value = true
  deleteConfirm.value = false
  showStatusMenu.value = false
}

function closeOverlay() {
  showOverlay.value = false
  overlayMovie.value = null
}

async function handleStatusChange(newStatus) {
  const movie = overlayMovie.value
  if (!movie || movie.status === newStatus) return
  showStatusMenu.value = false
  try {
    const updated = await updateMovie(movie.id, { status: newStatus })
    const idx = movieList.value.findIndex(m => m.id === movie.id)
    if (idx !== -1) movieList.value[idx] = updated
    overlayMovie.value = updated
    // Auto-remove from next wenn nicht mehr watchlist
    if (newStatus !== 'watchlist' && nextList.value.includes(String(movie.id))) {
      await removeFromNext(movie.id, 'movie')
      nextList.value = nextList.value.filter(id => String(id) !== String(movie.id))
    }
  } catch (err) {
    console.error(err)
  }
}

async function handleRatingChange(rating) {
  const movie = overlayMovie.value
  if (!movie) return
  try {
    const updated = await updateMovie(movie.id, { userRating: rating })
    const idx = movieList.value.findIndex(m => m.id === movie.id)
    if (idx !== -1) movieList.value[idx] = updated
    overlayMovie.value = updated
  } catch (err) {
    console.error(err)
  }
}

async function handleDelete() {
  const movie = overlayMovie.value
  if (!movie) return
  if (!deleteConfirm.value) { deleteConfirm.value = true; return }
  try {
    await deleteMovie(movie.id)
    movieList.value = movieList.value.filter(m => m.id !== movie.id)
    nextList.value = nextList.value.filter(id => String(id) !== String(movie.id))
    closeOverlay()
  } catch (err) {
    console.error(err)
  }
}

async function toggleNext(movie) {
  const id = String(movie.id)
  const isNext = nextList.value.includes(id)
  if (isNext) {
    await removeFromNext(movie.id, 'movie')
    nextList.value = nextList.value.filter(i => i !== id)
  } else {
    if (nextList.value.length >= 6) return
    const newList = [...nextList.value, id]
    await saveNext(newList, 'movie')
    nextList.value = newList
  }
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  tmdbSearchQuery.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  tmdbError.value = ''
}

// ESC
function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (showSearchOverlay.value) closeSearchOverlay()
  else if (showStatusMenu.value) showStatusMenu.value = false
  else if (showOverlay.value) closeOverlay()
}
</script>

<template>
  <div class="movie-list" @keydown="onKeydown" tabindex="-1">

    <!-- Header -->
    <div class="list-header">
      <div class="header-left">
        <input
          v-model="searchQuery"
          class="search-input"
          placeholder="Suchen..."
        />
        <select v-model="sortBy" class="sort-select">
          <option value="title">Titel A–Z</option>
          <option value="year">Jahr (neu)</option>
          <option value="rating">Bewertung</option>
        </select>
      </div>
      <button class="btn-primary" @click="showSearchOverlay = true">+ Film hinzufügen</button>
    </div>

    <!-- Genre Filter -->
    <div v-if="allGenres.length" class="genre-filter">
      <button
        v-for="g in allGenres"
        :key="g"
        class="genre-chip"
        :class="{ active: genreFilter.includes(g) }"
        @click="genreFilter.includes(g)
          ? genreFilter.splice(genreFilter.indexOf(g), 1)
          : genreFilter.push(g)"
      >{{ g }}</button>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button
        v-for="tab in TABS"
        :key="tab.id"
        class="tab"
        :class="{ active: activeTab === tab.id }"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.id !== 'all'" class="tab-count">
          {{ statusCounts[tab.id] ?? 0 }}
        </span>
      </button>
    </div>

    <!-- Watch Next -->
    <div v-if="activeTab === 'watchlist' && nextMovies.length" class="next-section">
      <h3 class="next-title">▶ Watch Next</h3>
      <div class="card-grid">
        <MediaCard
          v-for="movie in nextMovies"
          :key="movie.id"
          :title="movie.title"
          :title-de="movie.titleDe"
          :image-url="movie.imageUrl"
          :year="movie.year"
          :rating="movie.rating"
          :is-next="true"
          @click="openOverlay(movie)"
        >
          <template #badge>
            <span class="cert-badge" v-if="movie.certification">{{ movie.certification }}</span>
          </template>
          <template #details>
            <span class="runtime" v-if="movie.runtime">{{ movie.runtime }} min</span>
          </template>
        </MediaCard>
      </div>
    </div>

    <!-- Movie Grid -->
    <div v-if="loading" class="loading">Laden...</div>
    <div v-else-if="!filteredMovies.length" class="empty">Keine Filme gefunden.</div>
    <div v-else class="card-grid">
      <MediaCard
        v-for="movie in filteredMovies"
        :key="movie.id"
        :title="movie.title"
        :title-de="movie.titleDe"
        :image-url="movie.imageUrl"
        :year="movie.year"
        :rating="movie.rating"
        :is-next="nextList.includes(String(movie.id))"
        @click="openOverlay(movie)"
      >
        <template #badge>
          <span class="cert-badge" v-if="movie.certification">{{ movie.certification }}</span>
        </template>
        <template #details>
          <span class="runtime" v-if="movie.runtime">{{ movie.runtime }} min</span>
          <div class="status-pill" :data-status="movie.status">
            {{ STATUS_OPTIONS.find(s => s.value === movie.status)?.label }}
          </div>
        </template>
      </MediaCard>
    </div>

    <!-- Detail Overlay -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="showOverlay && overlayMovie" class="overlay-backdrop" @click.self="closeOverlay">
          <div class="overlay-panel">

            <div class="overlay-top">
              <img v-if="overlayMovie.imageUrl" :src="overlayMovie.imageUrl" class="overlay-poster" />
              <div class="overlay-info">
                <h2 class="overlay-title">{{ overlayMovie.title }}</h2>
                <p v-if="overlayMovie.titleDe && overlayMovie.titleDe !== overlayMovie.title" class="overlay-title-de">
                  {{ overlayMovie.titleDe }}
                </p>
                <div class="overlay-meta">
                  <span v-if="overlayMovie.year">{{ overlayMovie.year }}</span>
                  <span v-if="overlayMovie.runtime">{{ overlayMovie.runtime }} min</span>
                  <span v-if="overlayMovie.certification" class="cert-badge">{{ overlayMovie.certification }}</span>
                  <a v-if="overlayMovie.linkUrl" :href="overlayMovie.linkUrl" target="_blank" class="tmdb-link">
                    TMDB ↗
                  </a>
                </div>
                <div v-if="overlayMovie.genres?.length" class="overlay-genres">
                  <span v-for="g in overlayMovie.genres" :key="g" class="genre-chip small">{{ g }}</span>
                </div>
                <div class="overlay-rating-row">
                  <span class="rating-label">TMDB</span>
                  <span class="rating-value">★ {{ overlayMovie.rating?.toFixed(1) ?? '–' }}</span>
                  <span class="rating-label" style="margin-left:1rem">Meine Wertung</span>
                  <div class="star-rating">
                    <button
                      v-for="n in 10"
                      :key="n"
                      class="star"
                      :class="{ active: n <= (overlayMovie.userRating ?? 0) }"
                      @click="handleRatingChange(overlayMovie.userRating === n ? null : n)"
                    >★</button>
                  </div>
                </div>
              </div>
            </div>

            <div class="overlay-actions">
              <!-- Status -->
              <div class="status-row">
                <button
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  class="status-btn"
                  :class="{ active: overlayMovie.status === opt.value }"
                  :style="`--c: ${opt.color}`"
                  @click="handleStatusChange(opt.value)"
                >{{ opt.label }}</button>
              </div>

              <!-- Watch Next Toggle -->
              <button
                class="btn-secondary"
                :class="{ active: nextList.includes(String(overlayMovie.id)) }"
                @click="toggleNext(overlayMovie)"
                :disabled="!nextList.includes(String(overlayMovie.id)) && nextList.length >= 6"
              >
                {{ nextList.includes(String(overlayMovie.id)) ? '★ Watch Next' : '☆ Watch Next' }}
              </button>

              <!-- Delete -->
              <button class="btn-danger" @click="handleDelete">
                {{ deleteConfirm ? 'Wirklich löschen?' : 'Löschen' }}
              </button>

              <button class="btn-close" @click="closeOverlay">✕ Schließen</button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- TMDB Search Overlay -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="showSearchOverlay" class="overlay-backdrop" @click.self="closeSearchOverlay">
          <div class="overlay-panel search-panel">
            <h2>Film suchen</h2>

            <div class="search-row">
              <input
                v-model="tmdbSearchQuery"
                class="search-input"
                placeholder="Filmtitel..."
                @keydown.enter="searchTmdbMovies"
                autofocus
              />
              <button class="btn-primary" @click="searchTmdbMovies" :disabled="tmdbLoading">
                {{ tmdbLoading ? '...' : 'Suchen' }}
              </button>
            </div>

            <div class="search-status-row">
              <label>Status beim Hinzufügen:</label>
              <select v-model="addStatus" class="sort-select">
                <option v-for="opt in STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
            </div>

            <p v-if="tmdbError" class="error-msg">{{ tmdbError }}</p>
            <p v-if="tmdbSearched && !tmdbResults.length" class="empty">Keine Ergebnisse.</p>

            <div class="search-results">
              <div
                v-for="result in tmdbResults"
                :key="result.id"
                class="search-result"
                :class="{ 'already-added': movieList.some(m => m.externalId === result.id) }"
              >
                <img v-if="result.imageUrl" :src="result.imageUrl" class="result-poster" />
                <div class="result-info">
                  <p class="result-title">{{ result.titleEn }}</p>
                  <p v-if="result.titleDe && result.titleDe !== result.titleEn" class="result-title-de">
                    {{ result.titleDe }}
                  </p>
                  <p class="result-meta">{{ result.year }} · ★ {{ result.rating?.toFixed(1) ?? '–' }}</p>
                </div>
                <button
                  v-if="!movieList.some(m => m.externalId === result.id)"
                  class="btn-primary small"
                  @click="handleAddMovie(result)"
                >+ Add</button>
                <span v-else class="already-label">Bereits vorhanden</span>
              </div>
            </div>

            <button class="btn-close" @click="closeSearchOverlay">✕ Schließen</button>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.movie-list { padding: 1rem; color: #e0e0e0; outline: none; }

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.header-left { display: flex; gap: 0.5rem; flex: 1; }

.search-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  background: #1a1d26;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.9rem;
}

.sort-select {
  padding: 0.5rem 0.75rem;
  background: #1a1d26;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.9rem;
}

.genre-filter { display: flex; flex-wrap: wrap; gap: 0.4rem; margin-bottom: 0.75rem; }

.genre-chip {
  padding: 0.25rem 0.6rem;
  border-radius: 20px;
  border: 1px solid #2a2d3a;
  background: transparent;
  color: #888;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all 0.15s;
}
.genre-chip.active, .genre-chip:hover { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.genre-chip.small { font-size: 0.72rem; padding: 0.15rem 0.4rem; }

.tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid #2a2d3a; }

.tab {
  padding: 0.5rem 1rem;
  border: none;
  background: transparent;
  color: #888;
  cursor: pointer;
  font-size: 0.88rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.tab.active { color: #e0e0e0; border-bottom-color: #3b82f6; }
.tab-count {
  background: #2a2d3a;
  border-radius: 10px;
  padding: 0 0.4rem;
  font-size: 0.75rem;
  color: #aaa;
}

.next-section { margin-bottom: 1.5rem; }
.next-title { font-size: 0.85rem; color: #f59e0b; margin-bottom: 0.5rem; font-weight: 600; }

.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 0.75rem;
}

.cert-badge {
  position: absolute;
  top: 4px; right: 4px;
  background: rgba(0,0,0,0.7);
  color: #e0e0e0;
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.runtime { font-size: 0.78rem; color: #888; }

.status-pill {
  display: inline-block;
  font-size: 0.72rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  margin-top: 0.2rem;
  background: #2a2d3a;
  color: #aaa;
}
.status-pill[data-status="watching"]  { background: #78350f; color: #fcd34d; }
.status-pill[data-status="finished"]  { background: #14532d; color: #86efac; }
.status-pill[data-status="watchlist"] { background: #1e1b4b; color: #a5b4fc; }

/* Overlay */
.overlay-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center;
  z-index: 200;
}

.overlay-panel {
  background: #1a1d26;
  border: 1px solid #2a2d3a;
  border-radius: 14px;
  padding: 1.5rem;
  width: min(560px, 95vw);
  max-height: 90vh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.overlay-top { display: flex; gap: 1rem; }

.overlay-poster {
  width: 100px;
  border-radius: 8px;
  flex-shrink: 0;
  object-fit: cover;
}

.overlay-info { flex: 1; min-width: 0; }

.overlay-title { font-size: 1.15rem; font-weight: 700; margin: 0 0 0.2rem; color: #fff; }
.overlay-title-de { font-size: 0.85rem; color: #666; margin: 0 0 0.5rem; }

.overlay-meta {
  display: flex; flex-wrap: wrap; gap: 0.5rem;
  align-items: center; font-size: 0.85rem; color: #888;
  margin-bottom: 0.5rem;
}

.tmdb-link { color: #3b82f6; text-decoration: none; font-size: 0.82rem; }
.tmdb-link:hover { text-decoration: underline; }

.overlay-genres { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-bottom: 0.5rem; }

.overlay-rating-row {
  display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
  font-size: 0.85rem;
}
.rating-label { color: #888; }
.rating-value { color: #f59e0b; }

.star-rating { display: flex; gap: 0.1rem; }
.star {
  background: none; border: none; color: #2a2d3a;
  font-size: 1.1rem; cursor: pointer; padding: 0;
  transition: color 0.1s;
}
.star.active, .star:hover { color: #f59e0b; }

.overlay-actions { display: flex; flex-direction: column; gap: 0.5rem; }

.status-row { display: flex; gap: 0.5rem; flex-wrap: wrap; }

.status-btn {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  background: transparent;
  color: #aaa;
  cursor: pointer;
  font-size: 0.85rem;
  transition: all 0.15s;
}
.status-btn.active, .status-btn:hover {
  background: var(--c);
  border-color: var(--c);
  color: #fff;
}

.btn-primary {
  padding: 0.5rem 1.2rem;
  background: #3b82f6; border: none;
  border-radius: 6px; color: #fff;
  cursor: pointer; font-size: 0.9rem;
}
.btn-primary:hover { background: #2563eb; }
.btn-primary.small { padding: 0.3rem 0.7rem; font-size: 0.82rem; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

.btn-secondary {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #2a2d3a;
  border-radius: 6px; color: #aaa;
  cursor: pointer; font-size: 0.85rem;
}
.btn-secondary.active { border-color: #f59e0b; color: #f59e0b; }

.btn-danger {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #ef4444;
  border-radius: 6px; color: #ef4444;
  cursor: pointer; font-size: 0.85rem;
}
.btn-danger:hover { background: #ef4444; color: #fff; }

.btn-close {
  padding: 0.5rem 1rem;
  background: transparent;
  border: 1px solid #2a2d3a;
  border-radius: 6px; color: #888;
  cursor: pointer; font-size: 0.85rem;
  align-self: flex-end;
}

/* Search Panel */
.search-panel { width: min(640px, 95vw); }
.search-row { display: flex; gap: 0.5rem; }
.search-status-row { display: flex; align-items: center; gap: 0.75rem; font-size: 0.85rem; color: #888; }

.search-results { display: flex; flex-direction: column; gap: 0.5rem; max-height: 400px; overflow-y: auto; }

.search-result {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem; border-radius: 8px;
  border: 1px solid #2a2d3a; background: #0f1117;
}
.search-result.already-added { opacity: 0.5; }

.result-poster { width: 40px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }

.result-info { flex: 1; min-width: 0; }
.result-title { font-size: 0.9rem; font-weight: 600; color: #e0e0e0; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.result-title-de { font-size: 0.78rem; color: #666; margin: 0; }
.result-meta { font-size: 0.78rem; color: #888; margin: 0.1rem 0 0; }
.already-label { font-size: 0.78rem; color: #555; white-space: nowrap; }

.loading, .empty { color: #555; padding: 2rem; text-align: center; }
.error-msg { color: #ef4444; font-size: 0.85rem; }

.overlay-enter-active, .overlay-leave-active { transition: opacity 0.15s; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
