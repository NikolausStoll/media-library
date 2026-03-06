<script setup>
import { computed, ref, watch } from 'vue'
import { searchTmdb, addMovie, addSeries } from '../../services/mediaStorage.js'

const LOCATIONS = [
  { id: 'bed', label: 'Bed' },
  { id: 'couch', label: 'Couch' },
  { id: 'desk', label: 'Desk' },
]

const MOODS = [
  { id: 'relaxed', label: 'Relaxed' },
  { id: 'energetic', label: 'Energetic' },
  { id: 'melancholic', label: 'Melancholic' },
  { id: 'sociable', label: 'Sociable' },
  { id: 'focused', label: 'Focused' },
]

const GAME_MODES = [
  { id: 'continue', label: 'Continue playing' },
  { id: 'shelved', label: 'Pick up paused' },
  { id: 'new', label: 'Start something new' },
]

const SERIES_MODES = [
  { id: 'continue', label: 'Continue watching' },
  { id: 'new', label: 'New recommendation' },
]

const TIME_PRESETS = [
  { id: 30, label: '30 min' },
  { id: 60, label: '1h' },
  { id: 120, label: '2h' },
  { id: 180, label: '3h+' },
]

const props = defineProps({
  mediaType: { type: String, required: true },
})

const emit = defineEmits(['close', 'movie-added', 'series-added'])

const location = ref('couch')
const mood = ref('relaxed')
const availableMinutes = ref(30) // one of TIME_PRESETS[].id
const mode = ref('continue')
const loading = ref(false)
const result = ref(null)
const error = ref('')

const locationOptions = computed(() =>
  props.mediaType === 'game' ? LOCATIONS : LOCATIONS.filter((l) => l.id !== 'desk')
)

watch(() => props.mediaType, (mediaType) => {
  if (mediaType === 'series' && mode.value !== 'continue' && mode.value !== 'new') mode.value = 'continue'
})

const isSubmitDisabled = computed(() => loading.value)
const showWatchlistButton = computed(() =>
  props.mediaType === 'movie' || (props.mediaType === 'series' && mode.value !== 'continue')
)

async function submit() {
  if (isSubmitDisabled.value) return
  loading.value = true
  error.value = ''
  result.value = null
  try {
    const body = {
      location: location.value,
      mood: mood.value,
      availableMinutes: Number(availableMinutes.value),
      mediaType: props.mediaType,
    }
    if (props.mediaType === 'game' || props.mediaType === 'series') body.mode = mode.value

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
  } catch (err) {
    error.value = err.message ?? 'An unexpected error occurred.'
  } finally {
    loading.value = false
  }
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
const suggestionDetails = ref({}) // title -> { id, imageUrl }

async function addToWatchlist(title) {
  if (!title?.trim()) return
  addingTitle.value = title
  addError.value = ''
  const type = props.mediaType === 'movie' ? 'movie' : 'series'
  try {
    const results = await searchTmdb(title.trim(), type)
    const first = results?.[0]
    if (!first?.id) {
      addError.value = `No TMDB match for "${title}".`
      return
    }
    if (props.mediaType === 'movie') {
      const movie = await addMovie({ externalId: String(first.id), status: 'watchlist', providers: [] })
      emit('movie-added', movie)
    } else {
      const series = await addSeries({ externalId: String(first.id), status: 'watchlist', providers: [] })
      emit('series-added', series)
    }
    addingTitle.value = null
  } catch (err) {
    addError.value = err.message ?? 'Failed to add to watchlist.'
  } finally {
    addingTitle.value = null
  }
}

async function fetchPostersForSuggestions() {
  const list = resultSuggestions.value
  if (!list?.length || (props.mediaType !== 'movie' && props.mediaType !== 'series')) return
  const type = props.mediaType
  const next = {}
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
  suggestionDetails.value = next
}

watch(resultSuggestions, (val) => {
  suggestionDetails.value = {}
  if (val?.length) fetchPostersForSuggestions()
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

      <div class="ai-form">
        <div class="ai-field">
          <label class="ai-label">Location</label>
          <div class="ai-option-group">
            <button
              v-for="opt in locationOptions"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: location === opt.id }"
              @click="location = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">Mood</label>
          <div class="ai-option-group ai-moods">
            <button
              v-for="opt in MOODS"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: mood === opt.id }"
              @click="mood = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="ai-field" v-if="mediaType === 'game'">
          <label class="ai-label">Mode</label>
          <div class="ai-option-group">
            <button
              v-for="opt in GAME_MODES"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: mode === opt.id }"
              @click="mode = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="ai-field" v-if="mediaType === 'series'">
          <label class="ai-label">Mode</label>
          <div class="ai-option-group">
            <button
              v-for="opt in SERIES_MODES"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: mode === opt.id }"
              @click="mode = opt.id"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <div class="ai-field">
          <label class="ai-label">Available time</label>
          <div class="ai-option-group">
            <button
              v-for="opt in TIME_PRESETS"
              :key="opt.id"
              type="button"
              class="ai-option-btn"
              :class="{ active: availableMinutes === opt.id }"
              @click="availableMinutes = opt.id"
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
        <button class="ai-secondary-btn" type="button" @click="emit('close')">Close</button>
      </div>

      <p v-if="error" class="ai-error">{{ error }}</p>

      <section v-if="result" class="ai-result">
        <p class="ai-result-label">Recommendation</p>
        <template v-if="resultSuggestions.length">
          <ul class="ai-result-list" v-if="resultSuggestions.length > 1">
            <li v-for="(s, i) in resultSuggestions" :key="i" class="ai-result-list-item">
              <img
                v-if="suggestionDetails[s]?.imageUrl"
                :src="suggestionDetails[s].imageUrl"
                :alt="s"
                class="ai-result-poster"
              />
              <span class="ai-result-title">{{ s }}</span>
              <button
                v-if="showWatchlistButton"
                type="button"
                class="ai-watchlist-btn"
                :disabled="addingTitle !== null"
                @click="addToWatchlist(s)"
              >
                {{ addingTitle === s ? '…' : 'Add to watchlist' }}
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
              <div>
                <p class="ai-result-suggestion">{{ resultSuggestions[0] }}</p>
                <button
                  v-if="showWatchlistButton"
                  type="button"
                  class="ai-watchlist-btn"
                  :disabled="addingTitle !== null"
                  @click="addToWatchlist(resultSuggestions[0])"
                >
                  {{ addingTitle === resultSuggestions[0] ? '…' : 'Add to watchlist' }}
                </button>
              </div>
            </div>
          </template>
        </template>
        <p v-else class="ai-result-suggestion">{{ resultMessage || 'No specific recommendation.' }}</p>
        <p v-if="resultReasoning" class="ai-result-reason">Reasoning: {{ resultReasoning }}</p>
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
.ai-option-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}
.ai-option-group.ai-moods {
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
