<script setup>
import { ref, computed, onMounted } from 'vue'
import MediaCard from './shared/MediaCard.vue'
import {
  loadSeries, addSeries, updateSeries, deleteSeries, searchTmdb,
  loadEpisodes, loadEpisodeProgress, toggleEpisode, toggleSeason
} from '../services/mediaStorage.js'
import { loadNext, saveNext, removeFromNext } from '../services/gameStorage.js'

// ─── State ────────────────────────────────────────────────────────────────────
const seriesList  = ref([])
const nextList    = ref([])
const loading     = ref(true)
const activeTab   = ref('watchlist')
const searchQuery = ref('')
const genreFilter = ref([])
const sortBy      = ref('title')

// Add
const showSearchOverlay = ref(false)
const tmdbSearchQuery   = ref('')
const tmdbResults       = ref([])
const tmdbLoading       = ref(false)
const tmdbError         = ref('')
const tmdbSearched      = ref(false)
const addStatus         = ref('watchlist')

// Overlay
const overlayItem    = ref(null)
const showOverlay    = ref(false)
const deleteConfirm  = ref(false)
const overlayTab     = ref('details')

// Episoden
const episodeList     = ref([])
const episodeProgress = ref(new Set())
const episodesLoading = ref(false)

const STATUS_OPTIONS = [
  { value: 'watchlist', label: 'Watchlist', color: '#6366f1' },
  { value: 'watching',  label: 'Watching',  color: '#f59e0b' },
  { value: 'paused',    label: 'Paused',    color: '#8b5cf6' },
  { value: 'finished',  label: 'Finished',  color: '#22c55e' },
  { value: 'dropped',   label: 'Dropped',   color: '#ef4444' },
]

const TABS = [
  { id: 'watchlist', label: 'Watchlist' },
  { id: 'watching',  label: 'Watching'  },
  { id: 'paused',    label: 'Paused'    },
  { id: 'finished',  label: 'Finished'  },
  { id: 'dropped',   label: 'Dropped'   },
  { id: 'all',       label: 'All'       },
]

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    [seriesList.value, nextList.value] = await Promise.all([
      loadSeries(),
      loadNext('series'),
    ])
  } finally {
    loading.value = false
  }
})

// ─── Computed ─────────────────────────────────────────────────────────────────
const statusCounts = computed(() => {
  const counts = { watchlist: 0, watching: 0, paused: 0, finished: 0, dropped: 0 }
  for (const s of seriesList.value) counts[s.status] = (counts[s.status] ?? 0) + 1
  return counts
})

const allGenres = computed(() => {
  const set = new Set()
  for (const s of seriesList.value) for (const g of (s.genres ?? [])) set.add(g)
  return [...set].sort()
})

const filteredSeries = computed(() => {
  let base = activeTab.value === 'all'
    ? seriesList.value
    : seriesList.value.filter(s => s.status === activeTab.value)

  if (searchQuery.value.trim())
    base = base.filter(s =>
      s.title?.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      s.titleDe?.toLowerCase().includes(searchQuery.value.toLowerCase())
    )

  if (genreFilter.value.length)
    base = base.filter(s => genreFilter.value.every(g => s.genres?.includes(g)))

  return [...base].sort((a, b) =>
    sortBy.value === 'year'   ? (b.year ?? '').localeCompare(a.year ?? '') :
    sortBy.value === 'rating' ? (b.rating ?? 0) - (a.rating ?? 0) :
    a.title.localeCompare(b.title)
  )
})

const nextSeries = computed(() =>
  nextList.value
    .map(id => seriesList.value.find(s => String(s.id) === String(id)))
    .filter(Boolean)
)

// ─── Episoden Computed ────────────────────────────────────────────────────────
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

// ─── Actions ──────────────────────────────────────────────────────────────────
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

async function handleAddSeries(tmdbItem) {
  try {
    const series = await addSeries({
      externalId: tmdbItem.id,
      status: addStatus.value,
    })
    seriesList.value.push(series)
    tmdbResults.value = tmdbResults.value.filter(r => r.id !== tmdbItem.id)
    if (!tmdbResults.value.length) closeSearchOverlay()
  } catch (err) {
    tmdbError.value = err.message
  }
}

async function openOverlay(item) {
  overlayItem.value = item
  showOverlay.value = true
  deleteConfirm.value = false
  overlayTab.value = 'details'
  episodeList.value = []
  episodeProgress.value = new Set()
  episodesLoading.value = true
  try {
    const [eps, progress] = await Promise.all([
      loadEpisodes(item.id),
      loadEpisodeProgress(item.id),
    ])
    episodeList.value = eps
    episodeProgress.value = new Set(progress.map(p => `${p.season}-${p.episode}`))
  } finally {
    episodesLoading.value = false
  }
}

function closeOverlay() {
  showOverlay.value = false
  overlayItem.value = null
  episodeList.value = []
  episodeProgress.value = new Set()
}

async function handleStatusChange(newStatus) {
  const item = overlayItem.value
  if (!item || item.status === newStatus) return
  try {
    const updated = await updateSeries(item.id, { status: newStatus })
    const idx = seriesList.value.findIndex(s => s.id === item.id)
    if (idx !== -1) seriesList.value[idx] = updated
    overlayItem.value = updated
    if (newStatus === 'dropped' && nextList.value.includes(String(item.id))) {
      await removeFromNext(item.id, 'series')
      nextList.value = nextList.value.filter(id => String(id) !== String(item.id))
    }
  } catch (err) {
    console.error(err)
  }
}

async function handleRatingChange(rating) {
  const item = overlayItem.value
  if (!item) return
  try {
    const updated = await updateSeries(item.id, { userRating: rating })
    const idx = seriesList.value.findIndex(s => s.id === item.id)
    if (idx !== -1) seriesList.value[idx] = updated
    overlayItem.value = updated
  } catch (err) {
    console.error(err)
  }
}

async function handleDelete() {
  const item = overlayItem.value
  if (!item) return
  if (!deleteConfirm.value) { deleteConfirm.value = true; return }
  try {
    await deleteSeries(item.id)
    seriesList.value = seriesList.value.filter(s => s.id !== item.id)
    nextList.value = nextList.value.filter(id => String(id) !== String(item.id))
    closeOverlay()
  } catch (err) {
    console.error(err)
  }
}

async function toggleNext(item) {
  const id = String(item.id)
  const isNext = nextList.value.includes(id)
  if (isNext) {
    await removeFromNext(item.id, 'series')
    nextList.value = nextList.value.filter(i => i !== id)
  } else {
    if (nextList.value.length >= 6) return
    const newList = [...nextList.value, id]
    await saveNext(newList, 'series')
    nextList.value = newList
  }
}

async function onToggleEpisode(ep) {
  const key = `${ep.season}-${ep.episode}`
  const result = await toggleEpisode(overlayItem.value.id, ep.season, ep.episode)
  const next = new Set(episodeProgress.value)
  if (result.watched) {
    next.add(key)
  } else {
    next.delete(key)
  }
  episodeProgress.value = next
}

async function onToggleSeason(season) {
  const eps = episodeList.value.filter(e => e.season === season)
  const watched = !isSeasonComplete(season)
  const updated = await toggleSeason(
    overlayItem.value.id,
    season,
    eps.map(e => e.episode),
    watched
  )
  episodeProgress.value = new Set(updated.map(p => `${p.season}-${p.episode}`))
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  tmdbSearchQuery.value = ''
  tmdbResults.value = []
  tmdbSearched.value = false
  tmdbError.value = ''
}

function onKeydown(e) {
  if (e.key !== 'Escape') return
  if (showSearchOverlay.value) closeSearchOverlay()
  else if (showOverlay.value) closeOverlay()
}
</script>

<template>
  <div class="series-list" @keydown="onKeydown" tabindex="-1">

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
      <button class="btn-primary" @click="showSearchOverlay = true">+ Serie hinzufügen</button>
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
    <div v-if="activeTab === 'watchlist' && nextSeries.length" class="next-section">
      <h3 class="next-title">▶ Watch Next</h3>
      <div class="card-grid">
        <MediaCard
          v-for="item in nextSeries"
          :key="item.id"
          :title="item.title"
          :title-de="item.titleDe"
          :image-url="item.imageUrl"
          :year="item.year"
          :rating="item.rating"
          :is-next="true"
          @click="openOverlay(item)"
        >
          <template #badge>
            <span class="cert-badge" v-if="item.certification">{{ item.certification }}</span>
          </template>
          <template #details>
            <span class="runtime" v-if="item.seasonCount">
              {{ item.seasonCount }}S · {{ item.episodeCount }}E
            </span>
          </template>
        </MediaCard>
      </div>
    </div>

    <!-- Series Grid -->
    <div v-if="loading" class="loading">Laden...</div>
    <div v-else-if="!filteredSeries.length" class="empty">Keine Serien gefunden.</div>
    <div v-else class="card-grid">
      <MediaCard
        v-for="item in filteredSeries"
        :key="item.id"
        :title="item.title"
        :title-de="item.titleDe"
        :image-url="item.imageUrl"
        :year="item.year"
        :rating="item.rating"
        :is-next="nextList.includes(String(item.id))"
        @click="openOverlay(item)"
      >
        <template #badge>
          <span class="cert-badge" v-if="item.certification">{{ item.certification }}</span>
        </template>
        <template #details>
          <span class="runtime" v-if="item.seasonCount">
            {{ item.seasonCount }}S · {{ item.episodeCount }}E
          </span>
          <div class="status-pill" :data-status="item.status">
            {{ STATUS_OPTIONS.find(s => s.value === item.status)?.label }}
          </div>
        </template>
      </MediaCard>
    </div>

    <!-- Detail Overlay -->
    <Teleport to="body">
      <Transition name="overlay">
        <div v-if="showOverlay && overlayItem" class="overlay-backdrop" @click.self="closeOverlay">
          <div class="overlay-panel">

            <!-- Top: Poster + Info -->
            <div class="overlay-top">
              <img v-if="overlayItem.imageUrl" :src="overlayItem.imageUrl" class="overlay-poster" />
              <div class="overlay-info">
                <h2 class="overlay-title">{{ overlayItem.title }}</h2>
                <p v-if="overlayItem.titleDe && overlayItem.titleDe !== overlayItem.title" class="overlay-title-de">
                  {{ overlayItem.titleDe }}
                </p>
                <div class="overlay-meta">
                  <span v-if="overlayItem.year">{{ overlayItem.year }}</span>
                  <span v-if="overlayItem.seasonCount">{{ overlayItem.seasonCount }} Staffeln</span>
                  <span v-if="overlayItem.episodeCount">{{ overlayItem.episodeCount }} Episoden</span>
                  <span v-if="overlayItem.runtime">{{ overlayItem.runtime }} min / Ep.</span>
                  <span v-if="overlayItem.certification" class="cert-badge-inline">
                    {{ overlayItem.certification }}
                  </span>
                  <a v-if="overlayItem.linkUrl" :href="overlayItem.linkUrl" target="_blank" class="tmdb-link">
                    TMDB ↗
                  </a>
                </div>
                <div v-if="overlayItem.genres?.length" class="overlay-genres">
                  <span v-for="g in overlayItem.genres" :key="g" class="genre-chip small">{{ g }}</span>
                </div>
                <div class="overlay-rating-row">
                  <span class="rating-label">TMDB</span>
                  <span class="rating-value">★ {{ overlayItem.rating?.toFixed(1) ?? '–' }}</span>
                  <span class="rating-label" style="margin-left:1rem">Meine Wertung</span>
                  <div class="star-rating">
                    <button
                      v-for="n in 10"
                      :key="n"
                      class="star"
                      :class="{ active: n <= (overlayItem.userRating ?? 0) }"
                      @click="handleRatingChange(overlayItem.userRating === n ? null : n)"
                    >★</button>
                  </div>
                </div>
                <div v-if="overlayItem.streamingProviders?.length" class="streaming-providers">
                  <img
                    v-for="p in overlayItem.streamingProviders"
                    :key="p.id"
                    :src="p.logo"
                    :alt="p.name"
                    :title="p.name"
                    class="provider-logo"
                  />
                </div>
              </div>
            </div>

            <!-- Overlay Tabs -->
            <div class="overlay-tabs">
              <button
                class="overlay-tab"
                :class="{ active: overlayTab === 'details' }"
                @click="overlayTab = 'details'"
              >Details</button>
              <button
                class="overlay-tab"
                :class="{ active: overlayTab === 'episodes' }"
                @click="overlayTab = 'episodes'"
              >
                Episoden
                <span v-if="episodeList.length" class="tab-count">
                  {{ episodeProgress.size }}/{{ episodeList.length }}
                </span>
              </button>
            </div>

            <!-- Details Tab -->
            <div v-if="overlayTab === 'details'" class="overlay-actions">
              <div class="status-row">
                <button
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  class="status-btn"
                  :class="{ active: overlayItem.status === opt.value }"
                  :style="`--c: ${opt.color}`"
                  @click="handleStatusChange(opt.value)"
                >{{ opt.label }}</button>
              </div>

              <button
                class="btn-secondary"
                :class="{ active: nextList.includes(String(overlayItem.id)) }"
                @click="toggleNext(overlayItem)"
                :disabled="!nextList.includes(String(overlayItem.id)) && nextList.length >= 6"
              >
                {{ nextList.includes(String(overlayItem.id)) ? '★ Watch Next' : '☆ Watch Next' }}
              </button>

              <button class="btn-danger" @click="handleDelete">
                {{ deleteConfirm ? 'Wirklich löschen?' : 'Löschen' }}
              </button>

              <button class="btn-close" @click="closeOverlay">✕ Schließen</button>
            </div>

            <!-- Episoden Tab -->
            <div v-else-if="overlayTab === 'episodes'" class="episodes-tab">
              <div v-if="episodesLoading" class="loading">Episoden laden...</div>
              <div v-else-if="!episodesGrouped.length" class="empty">Keine Episodendaten verfügbar.</div>
              <template v-else>
                <div
                  v-for="{ season, episodes } in episodesGrouped"
                  :key="season"
                  class="season-block"
                >
                  <div class="season-header">
                    <span class="season-title">Staffel {{ season }}</span>
                    <span class="season-progress">
                      {{ seasonProgress(season).watched }}/{{ seasonProgress(season).total }}
                    </span>
                    <button
                      class="season-toggle-btn"
                      :class="{ complete: isSeasonComplete(season) }"
                      @click="onToggleSeason(season)"
                    >
                      {{ isSeasonComplete(season) ? '✓ Alle gesehen' : '○ Alle markieren' }}
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
                        <span v-if="ep.runtime">{{ ep.runtime }}min</span>
                      </span>
                    </label>
                  </div>
                </div>
              </template>
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
            <h2>Serie suchen</h2>

            <div class="search-row">
              <input
                v-model="tmdbSearchQuery"
                class="search-input"
                placeholder="Serientitel..."
                @keydown.enter="searchTmdbSeries"
                autofocus
              />
              <button class="btn-primary" @click="searchTmdbSeries" :disabled="tmdbLoading">
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
                :class="{ 'already-added': seriesList.some(s => s.externalId === result.id) }"
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
                  v-if="!seriesList.some(s => s.externalId === result.id)"
                  class="btn-primary small"
                  @click="handleAddSeries(result)"
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
.series-list { padding: 1rem; color: #e0e0e0; outline: none; }

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

.tabs { display: flex; gap: 0.25rem; margin-bottom: 1rem; border-bottom: 1px solid #2a2d3a; flex-wrap: wrap; }

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

.cert-badge-inline {
  background: #2a2d3a;
  color: #aaa;
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
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
.status-pill[data-status="paused"]    { background: #2e1065; color: #d8b4fe; }
.status-pill[data-status="dropped"]   { background: #450a0a; color: #fca5a5; }

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
  width: min(580px, 95vw);
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

.streaming-providers {
  display: flex; flex-wrap: wrap; gap: 0.4rem;
  margin-top: 0.5rem;
}
.provider-logo {
  width: 32px; height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

/* Overlay Tabs */
.overlay-tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid #2a2d3a;
  margin-bottom: 0.25rem;
}

.overlay-tab {
  padding: 0.4rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #888;
  cursor: pointer;
  font-size: 0.88rem;
  margin-bottom: -1px;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  transition: color 0.15s;
}
.overlay-tab.active { color: #e0e0e0; border-bottom-color: #3b82f6; }

/* Details Tab */
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

/* Episoden Tab */
.episodes-tab { max-height: 55vh; overflow-y: auto; padding-right: 0.25rem; }

.season-block { margin-bottom: 1.25rem; }

.season-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.4rem 0;
  border-bottom: 1px solid #2a2d3a;
  margin-bottom: 0.25rem;
  position: sticky;
  top: 0;
  background: #1a1d26;
  z-index: 1;
}

.season-title { font-weight: 600; color: #e0e0e0; font-size: 0.9rem; }

.season-progress { font-size: 0.8rem; color: #888; flex: 1; }

.season-toggle-btn {
  padding: 0.2rem 0.6rem;
  border: 1px solid #2a2d3a;
  border-radius: 6px;
  background: transparent;
  color: #888;
  font-size: 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.season-toggle-btn.complete { border-color: #22c55e; color: #22c55e; }
.season-toggle-btn:hover { border-color: #3b82f6; color: #3b82f6; }

.episode-list { display: flex; flex-direction: column; }

.episode-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.35rem 0.4rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
  color: #aaa;
  transition: background 0.1s;
}
.episode-row:hover { background: #1e2230; }
.episode-row.watched { color: #555; }
.episode-row.watched .ep-title { text-decoration: line-through; }

.episode-row input[type="checkbox"] {
  cursor: pointer;
  accent-color: #3b82f6;
  flex-shrink: 0;
}

.ep-number {
  color: #555;
  font-size: 0.78rem;
  flex-shrink: 0;
  width: 2.8rem;
  font-variant-numeric: tabular-nums;
}
.ep-title  { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ep-meta   {
  display: flex;
  gap: 0.5rem;
  color: #555;
  font-size: 0.75rem;
  flex-shrink: 0;
}

/* Search Panel */
.search-panel { width: min(640px, 95vw); }
.search-row { display: flex; gap: 0.5rem; }
.search-status-row {
  display: flex; align-items: center; gap: 0.75rem;
  font-size: 0.85rem; color: #888;
}

.search-results {
  display: flex; flex-direction: column; gap: 0.5rem;
  max-height: 400px; overflow-y: auto;
}

.search-result {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem; border-radius: 8px;
  border: 1px solid #2a2d3a; background: #0f1117;
}
.search-result.already-added { opacity: 0.5; }

.result-poster { width: 40px; height: 60px; object-fit: cover; border-radius: 4px; flex-shrink: 0; }

.result-info { flex: 1; min-width: 0; }
.result-title {
  font-size: 0.9rem; font-weight: 600; color: #e0e0e0;
  margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.result-title-de { font-size: 0.78rem; color: #666; margin: 0; }
.result-meta { font-size: 0.78rem; color: #888; margin: 0.1rem 0 0; }
.already-label { font-size: 0.78rem; color: #555; white-space: nowrap; }

.loading, .empty { color: #555; padding: 2rem; text-align: center; }
.error-msg { color: #ef4444; font-size: 0.85rem; }

.overlay-enter-active, .overlay-leave-active { transition: opacity 0.15s; }
.overlay-enter-from, .overlay-leave-to { opacity: 0; }
</style>
