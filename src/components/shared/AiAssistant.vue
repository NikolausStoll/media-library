<script setup>
import { computed, ref, watch } from 'vue'
import { searchTmdb, getTmdbDetail, addMovie, addSeries } from '../../services/mediaStorage.js'
import { searchHltb, getHltbDetail, addGame } from '../../services/gameStorage.js'

const MODES = [
  { id: 'whats-next', label: "What's Next" },
  { id: 'new-recommendation', label: 'New Recommendation' },
]

const GAME_SESSION_HINTS = [
  { id: 'short', label: 'Short sessions' },
  { id: 'long', label: 'Long sessions' },
  { id: 'any', label: 'Any' },
]

const EPISODE_LENGTHS = [
  { id: '20-30', label: '20–30 min' },
  { id: '45+', label: '45+ min' },
  { id: 'any', label: 'Any' },
]

const DEFAULT_PLATFORMS = [
  { id: 'pc', label: 'PC' },
  { id: 'xbox', label: 'Xbox' },
  { id: 'switch', label: 'Switch' },
  { id: '3ds', label: '3DS' },
]

const props = defineProps({
  mediaType: { type: String, required: true },
  /** Current platform filter from list (games). Sent to API to restrict pool. */
  platformFilter: { type: Array, default: () => [] },
  /** Platform options for games (e.g. from GameList). */
  availablePlatforms: { type: Array, default: () => [] },
  /** TMDB external IDs already in library (movies/series). Used to filter new-recommendation list. */
  existingExternalIds: { type: Array, default: () => [] },
})

const emit = defineEmits(['close', 'movie-added', 'series-added', 'game-added'])

const mode = ref('whats-next')
const gamePlatforms = ref([]) // local selection for AI (can differ from list filter)
const sessionHint = ref('any')
const episodeLength = ref('any')
const streamingOnly = ref(true)
const providersTooltipVisible = ref(false)
let providersTooltipTimer = null
const loading = ref(false)

function showProvidersTooltip() {
  providersTooltipTimer = setTimeout(() => { providersTooltipVisible.value = true }, 700)
}
function hideProvidersTooltip() {
  if (providersTooltipTimer) clearTimeout(providersTooltipTimer)
  providersTooltipTimer = null
  providersTooltipVisible.value = false
}
const result = ref(null)
const error = ref('')

const platformOptions = computed(() =>
  (props.availablePlatforms?.length ? props.availablePlatforms : DEFAULT_PLATFORMS)
)

watch(() => props.mediaType, () => {
  if (props.mediaType !== 'game') gamePlatforms.value = []
})

const isSubmitDisabled = computed(() => loading.value)
/** Mode that produced the current result (so we don't show Add when user switches to new rec but result is still from what's next). */
const resultMode = ref(null)
/** Only show Add to Watchlist when current result was from new-recommendation. Never for What's Next. */
const showWatchlistButton = computed(() =>
  resultMode.value === 'new-recommendation'
)
/** IDs added in this session so we hide the button immediately. */
const addedExternalIds = ref(new Set())

async function submit() {
  if (isSubmitDisabled.value) return
  loading.value = true
  error.value = ''
  result.value = null
  resultMode.value = null
  addedExternalIds.value = new Set()
  try {
    const body = {
      mediaType: props.mediaType,
      mode: mode.value,
    }
    if (props.mediaType === 'game') {
      if (mode.value === 'whats-next') {
        const platforms = gamePlatforms.value?.length ? gamePlatforms.value : props.platformFilter
        if (platforms?.length) body.platformFilter = platforms
      }
      body.sessionHint = sessionHint.value
    }
    if (props.mediaType === 'series' && mode.value === 'new-recommendation') {
      body.episodeLength = episodeLength.value
    }
    if ((props.mediaType === 'movie' || props.mediaType === 'series') && mode.value === 'whats-next') {
      body.streamingOnly = streamingOnly.value
    }

    const response = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      throw new Error(data?.error ?? response.statusText)
    }

    result.value = await response.json()
    resultMode.value = mode.value
  } catch (err) {
    error.value = err.message ?? 'An unexpected error occurred.'
  } finally {
    loading.value = false
  }
}

function togglePlatform(platformId) {
  const idx = gamePlatforms.value.indexOf(platformId)
  if (idx === -1) gamePlatforms.value = [...gamePlatforms.value, platformId]
  else gamePlatforms.value = gamePlatforms.value.filter((p) => p !== platformId)
}

const resultSuggestions = computed(() => {
  if (!result.value) return []
  if (Array.isArray(result.value.suggestions) && result.value.suggestions.length) {
    return result.value.suggestions
  }
  if (result.value.suggestion) return [result.value.suggestion]
  return []
})

const resultMessage = computed(() => result.value?.message ?? '')
const resultReasoning = computed(() => result.value?.reasoning ?? '')

const addingTitle = ref(null)
const addError = ref('')
const suggestionDetails = ref({})
/** New-recommendation: list of { title, id, imageUrl, rating, runtime? seasons? } after TMDB fetch + filter */
const suggestionDetailsList = ref([])
const detailsLoading = ref(false)

const existingIdsSet = computed(() => new Set((props.existingExternalIds || []).map(String)))

async function addToWatchlist(title, externalId = null) {
  if (!title?.trim() && !externalId) return
  addingTitle.value = title || externalId
  addError.value = ''
  try {
    if (props.mediaType === 'game') {
      const id = externalId ? String(externalId) : null
      if (!id) {
        const results = await searchHltb((title || '').trim())
        const first = results?.[0]
        if (!first?.id) {
          addError.value = `No HLTB match for "${title}".`
          return
        }
        const game = await addGame(String(first.id), 'wishlist', [])
        emit('game-added', game)
        addedExternalIds.value = new Set([...addedExternalIds.value, String(first.id)])
      } else {
        const game = await addGame(id, 'wishlist', [])
        emit('game-added', game)
        addedExternalIds.value = new Set([...addedExternalIds.value, id])
      }
    } else {
      const type = props.mediaType === 'movie' ? 'movie' : 'series'
      let id = externalId
      if (!id) {
        const results = await searchTmdb((title || '').trim(), type)
        const first = results?.[0]
        if (!first?.id) {
          addError.value = `No TMDB match for "${title}".`
          return
        }
        id = String(first.id)
      }
      if (props.mediaType === 'movie') {
        const movie = await addMovie({ externalId: String(id), status: 'watchlist', providers: [] })
        emit('movie-added', movie)
      } else {
        const series = await addSeries({ externalId: String(id), status: 'watchlist', providers: [] })
        emit('series-added', series)
      }
      addedExternalIds.value = new Set([...addedExternalIds.value, String(id)])
    }
    addingTitle.value = null
  } catch (err) {
    addError.value = err.message ?? 'Failed to add to watchlist.'
  } finally {
    addingTitle.value = null
  }
}

async function fetchDetailsForNewRec() {
  const list = resultSuggestions.value
  if (!list?.length || (props.mediaType !== 'movie' && props.mediaType !== 'series' && props.mediaType !== 'game')) {
    suggestionDetailsList.value = []
    return
  }
  const type = props.mediaType
  const idsSet = existingIdsSet.value
  detailsLoading.value = true
  suggestionDetailsList.value = []
  try {
    const out = []
    if (type === 'game') {
      for (const title of list) {
        if (!title?.trim()) continue
        try {
          const results = await searchHltb(title.trim())
          const first = results?.[0]
          if (!first?.id || idsSet.has(String(first.id))) continue
          const detail = await getHltbDetail(first.id)
          out.push({
            title: title,
            id: detail.id,
            imageUrl: detail.imageUrl || null,
            rating: detail.rating != null ? detail.rating : null,
            gameplayMain: detail.gameplayMain != null ? detail.gameplayMain : null,
            gameplayAll: detail.gameplayAll != null ? detail.gameplayAll : null,
          })
        } catch {
          /* skip */
        }
      }
    } else {
      for (const title of list) {
        if (!title?.trim()) continue
        try {
          const results = await searchTmdb(title.trim(), type)
          const first = results?.[0]
          if (!first?.id || idsSet.has(String(first.id))) continue
          const detail = await getTmdbDetail(first.id, type)
          if (type === 'movie') {
            out.push({
              title: title,
              id: detail.id,
              imageUrl: detail.imageUrl || null,
              rating: detail.rating != null ? detail.rating : null,
              runtime: detail.runtime != null ? detail.runtime : null,
            })
          } else {
            out.push({
              title: title,
              id: detail.id,
              imageUrl: detail.imageUrl || null,
              rating: detail.rating != null ? detail.rating : null,
              seasons: detail.seasons != null ? detail.seasons : null,
            })
          }
        } catch {
          /* skip */
        }
      }
    }
    suggestionDetailsList.value = out
  } finally {
    detailsLoading.value = false
  }
}

async function fetchPostersForSuggestions() {
  const list = resultSuggestions.value
  if (!list?.length) return
  const type = props.mediaType
  const next = {}
  if (type === 'game') {
    for (const title of list) {
      if (!title?.trim()) continue
      try {
        const results = await searchHltb(title.trim())
        const first = results?.[0]
        if (!first?.id) continue
        const detail = await getHltbDetail(first.id)
        next[title] = {
          id: detail.id,
          imageUrl: detail.imageUrl || null,
          rating: detail.rating != null ? detail.rating : null,
          gameplayMain: detail.gameplayMain != null ? detail.gameplayMain : null,
          gameplayAll: detail.gameplayAll != null ? detail.gameplayAll : null,
        }
      } catch {
        /* ignore */
      }
    }
  } else {
    for (const title of list) {
      if (!title?.trim()) continue
      try {
        const results = await searchTmdb(title.trim(), type)
        const first = results?.[0]
        if (first?.id) next[title] = { id: first.id, imageUrl: first.imageUrl || null }
      } catch {
        /* ignore */
      }
    }
  }
  suggestionDetails.value = next
}

const isNewRecWithDetails = computed(() =>
  mode.value === 'new-recommendation' && (props.mediaType === 'movie' || props.mediaType === 'series' || props.mediaType === 'game')
)
/** Result was produced for this mode → show it. Otherwise show "wrong mode" hint. */
const resultMatchesMode = computed(() => resultMode.value !== null && resultMode.value === mode.value)
/** How to render current result: by result mode, not current mode. */
const showResultAsNewRec = computed(() =>
  resultMode.value === 'new-recommendation' && (props.mediaType === 'movie' || props.mediaType === 'series' || props.mediaType === 'game')
)
const resultModeLabel = computed(() => resultMode.value === 'whats-next' ? "What's Next" : resultMode.value === 'new-recommendation' ? 'New Recommendation' : '')
const currentModeLabel = computed(() => mode.value === 'whats-next' ? "What's Next" : mode.value === 'new-recommendation' ? 'New Recommendation' : '')

watch([resultSuggestions, () => props.mediaType], (val) => {
  suggestionDetails.value = {}
  suggestionDetailsList.value = []
  if (!val?.[0]?.length) return
  if (isNewRecWithDetails.value) fetchDetailsForNewRec()
  else fetchPostersForSuggestions()
}, { immediate: true })
</script>

<template>
  <div class="ai-assistant-overlay" @click.self="emit('close')">
    <div class="ai-assistant-modal">
      <header class="ai-assistant-header">
        <div>
          <p class="ai-assistant-title">AI Assistant</p>
          <p class="ai-assistant-context">{{ mediaType === 'game' ? 'Games' : mediaType === 'movie' ? 'Movies' : 'Series' }}</p>
        </div>
        <button class="ai-close-btn" type="button" @click="emit('close')">✕</button>
      </header>

      <div class="tabs ai-form-tabs">
        <button :class="['tab', { active: mode === 'whats-next' }]" type="button" @click="mode = 'whats-next'">What's Next</button>
        <button :class="['tab', { active: mode === 'new-recommendation' }]" type="button" @click="mode = 'new-recommendation'">Something New</button>
      </div>

      <div class="ai-form">
        <div v-if="(mediaType === 'movie' || mediaType === 'series') && mode === 'whats-next'" class="ai-field ai-filter-wrap">
          <label class="ai-label">Filter</label>
          <div class="ai-option-group">
            <button
              type="button"
              class="ai-option-btn"
              :class="{ active: streamingOnly }"
              @click="streamingOnly = !streamingOnly"
              @mouseenter="showProvidersTooltip"
              @mouseleave="hideProvidersTooltip"
            >
              With Providers
            </button>
          </div>
          <transition name="ai-tooltip">
            <p v-show="providersTooltipVisible" class="ai-filter-tooltip">
              {{ streamingOnly ? 'Titles without a streaming provider are excluded from recommendations.' : 'Titles with and without a streaming provider are shown.' }}
            </p>
          </transition>
        </div>

        <div v-if="mediaType === 'game' && mode === 'whats-next'" class="ai-field">
          <label class="ai-label">Platform</label>
          <div class="ai-option-group">
            <button
              v-for="p in platformOptions"
              :key="p.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: gamePlatforms.includes(p.id) }"
              @click="togglePlatform(p.id)"
            >
              {{ p.label }}
            </button>
          </div>
        </div>

        <div v-if="mediaType === 'game'" class="ai-field">
          <label class="ai-label">Session</label>
          <div class="ai-option-group">
            <button
              v-for="opt in GAME_SESSION_HINTS"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: sessionHint === opt.id }"
              @click="sessionHint = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div v-if="mediaType === 'series' && mode === 'new-recommendation'" class="ai-field">
          <label class="ai-label">Episode length</label>
          <div class="ai-option-group">
            <button
              v-for="opt in EPISODE_LENGTHS"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: episodeLength === opt.id }"
              @click="episodeLength = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>
      </div>

      <div class="ai-actions">
        <button class="ai-submit-btn" :disabled="isSubmitDisabled" type="button" @click="submit">
          {{ loading ? 'Loading…' : 'Get recommendation' }}
        </button>
      </div>

      <p v-if="error" class="ai-error">{{ error }}</p>

      <section v-if="result" class="ai-result">
        <p class="ai-result-label">Recommendation</p>
        <p v-if="resultMode != null && !resultMatchesMode" class="ai-result-suggestion ai-result-mode-hint">
          This result is for <strong>{{ resultModeLabel }}</strong>. Click "Get recommendation" for <strong>{{ currentModeLabel }}</strong>.
        </p>
        <template v-else-if="showResultAsNewRec">
          <div v-if="detailsLoading" class="ai-details-loading-wrap">
            <span class="ai-details-loading-spinner"></span>
            <p class="ai-details-loading">{{ mediaType === 'game' ? 'Loading HLTB details…' : 'Loading TMDB details…' }}</p>
          </div>
          <ul v-else-if="suggestionDetailsList.length" class="ai-result-list ai-result-list-details">
            <li v-for="(item, i) in suggestionDetailsList" :key="item.id || i" class="ai-result-list-item">
              <img
                v-if="item.imageUrl"
                :src="item.imageUrl"
                :alt="item.title"
                class="ai-result-poster"
              />
              <div class="ai-result-meta">
                <span class="ai-result-title">{{ item.title }}</span>
                <span v-if="item.rating != null" class="ai-result-detail">★ {{ Number(item.rating).toFixed(1) }}</span>
                <span v-if="mediaType === 'movie' && item.runtime != null" class="ai-result-detail">{{ item.runtime }} min</span>
                <span v-if="mediaType === 'series' && item.seasons != null" class="ai-result-detail">{{ item.seasons }} season{{ item.seasons !== 1 ? 's' : '' }}</span>
                <span v-if="mediaType === 'game' && (item.gameplayMain != null || item.gameplayAll != null)" class="ai-result-detail">{{ item.gameplayMain != null ? item.gameplayMain + ' h' : '' }}{{ item.gameplayMain != null && item.gameplayAll != null ? ' / ' : '' }}{{ item.gameplayAll != null ? item.gameplayAll + ' h' : '' }}</span>
              </div>
              <button
                v-if="!addedExternalIds.has(String(item.id))"
                type="button"
                class="ai-watchlist-btn"
                :disabled="addingTitle !== null"
                @click="addToWatchlist(item.title, item.id)"
              >
                {{ addingTitle === item.title ? '…' : (mediaType === 'game' ? 'Add to wishlist' : 'Add to watchlist') }}
              </button>
            </li>
          </ul>
          <p v-else-if="resultSuggestions.length" class="ai-result-suggestion">All 10 suggestions are already in your library or could not be resolved.</p>
        </template>
        <template v-else-if="resultSuggestions.length">
          <ul class="ai-result-list" v-if="resultSuggestions.length > 1">
            <li v-for="(s, i) in resultSuggestions" :key="i" class="ai-result-list-item">
              <img
                v-if="suggestionDetails[s]?.imageUrl"
                :src="suggestionDetails[s].imageUrl"
                :alt="s"
                class="ai-result-poster"
              />
              <div class="ai-result-meta">
                <span class="ai-result-title">{{ s }}</span>
                <template v-if="mediaType === 'game' && suggestionDetails[s]">
                  <span v-if="suggestionDetails[s].rating != null" class="ai-result-detail">★ {{ Number(suggestionDetails[s].rating).toFixed(1) }}</span>
                  <span v-if="suggestionDetails[s].gameplayMain != null || suggestionDetails[s].gameplayAll != null" class="ai-result-detail">{{ suggestionDetails[s].gameplayMain != null ? suggestionDetails[s].gameplayMain + ' h' : '' }}{{ suggestionDetails[s].gameplayMain != null && suggestionDetails[s].gameplayAll != null ? ' / ' : '' }}{{ suggestionDetails[s].gameplayAll != null ? suggestionDetails[s].gameplayAll + ' h' : '' }}</span>
                </template>
              </div>
              <button
                v-if="showWatchlistButton"
                type="button"
                class="ai-watchlist-btn"
                :disabled="addingTitle !== null"
                @click="addToWatchlist(s)"
              >
                {{ addingTitle === s ? '…' : (mediaType === 'game' ? 'Add to wishlist' : 'Add to watchlist') }}
              </button>
            </li>
          </ul>
          <template v-else>
            <div class="ai-result-single">
              <img
                v-if="suggestionDetails[resultSuggestions[0]]?.imageUrl"
                :src="suggestionDetails[resultSuggestions[0]].imageUrl"
                :alt="resultSuggestions[0]"
                class="ai-result-poster"
              />
              <div class="ai-result-meta">
                <p class="ai-result-suggestion">{{ resultSuggestions[0] }}</p>
                <template v-if="mediaType === 'game' && suggestionDetails[resultSuggestions[0]]">
                  <span v-if="suggestionDetails[resultSuggestions[0]].rating != null" class="ai-result-detail">★ {{ Number(suggestionDetails[resultSuggestions[0]].rating).toFixed(1) }}</span>
                  <span v-if="suggestionDetails[resultSuggestions[0]].gameplayMain != null || suggestionDetails[resultSuggestions[0]].gameplayAll != null" class="ai-result-detail">{{ suggestionDetails[resultSuggestions[0]].gameplayMain != null ? suggestionDetails[resultSuggestions[0]].gameplayMain + ' h' : '' }}{{ suggestionDetails[resultSuggestions[0]].gameplayMain != null && suggestionDetails[resultSuggestions[0]].gameplayAll != null ? ' / ' : '' }}{{ suggestionDetails[resultSuggestions[0]].gameplayAll != null ? suggestionDetails[resultSuggestions[0]].gameplayAll + ' h' : '' }}</span>
                </template>
                <button
                  v-if="showWatchlistButton"
                  type="button"
                  class="ai-watchlist-btn"
                  :disabled="addingTitle !== null"
                  @click="addToWatchlist(resultSuggestions[0])"
                >
                  {{ addingTitle === resultSuggestions[0] ? '…' : (mediaType === 'game' ? 'Add to wishlist' : 'Add to watchlist') }}
                </button>
              </div>
            </div>
          </template>
        </template>
        <p v-else-if="resultMatchesMode && !resultSuggestions.length" class="ai-result-suggestion">{{ resultMessage || 'No specific recommendation.' }}</p>
        <p v-if="resultMatchesMode && resultReasoning && !showResultAsNewRec" class="ai-result-reason">Reasoning: {{ resultReasoning }}</p>
        <p v-if="addError" class="ai-error">{{ addError }}</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.ai-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 1rem;
}
.ai-field {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}
.ai-hint {
  font-size: 11px;
  color: var(--text-muted);
  margin: 0;
}
.ai-form-tabs {
  margin-bottom: 12px;
}
.ai-filter-wrap {
  position: relative;
}
.ai-filter-tooltip {
  position: absolute;
  left: 0;
  top: 100%;
  margin: 4px 0 0 0;
  padding: 6px 10px;
  max-width: 260px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 2px;
  z-index: 1;
  pointer-events: none;
}
.ai-tooltip-enter-active,
.ai-tooltip-leave-active {
  transition: opacity 0.15s ease;
}
.ai-tooltip-enter-from,
.ai-tooltip-leave-to {
  opacity: 0;
}
.ai-option-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.ai-option-btn {
  padding: 8px 14px;
  border-radius: 2px;
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 12px;
  transition: all 0.15s;
}
.ai-option-btn:hover {
  background: var(--surface2);
  color: var(--text);
}
.ai-option-btn.active {
  background: rgb(var(--accent-rgb) / 0.1);
  border-color: rgb(var(--accent-rgb) / 0.35);
  color: var(--accent-light);
}
.ai-result-list {
  margin: 0.25rem 0 0 0;
  padding-left: 1.25rem;
}
.ai-result-list li {
  margin-bottom: 0.25rem;
}
.ai-result-list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.ai-result-meta {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}
.ai-result-detail {
  font-size: 11px;
  color: var(--text-muted);
}
.ai-result-list-details .ai-result-list-item {
  align-items: flex-start;
}
.ai-details-loading-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0.5rem 0 0 0;
  padding: 12px 0;
}
.ai-details-loading-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ai-spin 0.7s linear infinite;
}
@keyframes ai-spin {
  to { transform: rotate(360deg); }
}
.ai-details-loading {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}
.ai-result-mode-hint {
  margin: 0.5rem 0 0 0;
  color: var(--text-muted);
  font-size: 13px;
}
.ai-result-mode-hint strong {
  color: var(--text);
}
.ai-result-poster {
  width: 64px;
  height: 96px;
  object-fit: cover;
  border-radius: 2px;
  flex-shrink: 0;
}
.ai-result-title {
  flex: 1;
  min-width: 0;
}
.ai-result-single {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}
.ai-result-single .ai-result-poster {
  width: 112px;
  height: 168px;
}
.ai-watchlist-btn {
  padding: 6px 10px;
  font-size: 11px;
  border-radius: 2px;
  border: 1px solid var(--border2);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}
.ai-watchlist-btn:hover:not(:disabled) {
  background: var(--surface2);
  color: var(--text);
}
.ai-watchlist-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
