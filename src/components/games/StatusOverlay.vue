<!-- src/components/games/StatusOverlay.vue -->
<script setup>
import { computed, ref, watch, toRefs } from 'vue'
import { formatReleaseDate } from '../../utils/releaseDate.js'
import CompletionDateEditor from '../shared/CompletionDateEditor.vue'
import MediaImageViewer from '../shared/MediaImageViewer.vue'

const props = defineProps({
  game: { type: Object, default: null },
  statusOptions: { type: Array, required: true },
  deleteConfirm: { type: Boolean, default: false },
  inPlayNext: { type: Boolean, default: false },
  playNextAtLimit: { type: Boolean, default: false },
})
const { game } = toRefs(props)

const releaseDateLabel = computed(() => {
  const value = game?.value?.releaseDateEu
  if (!value) return 'Release Date'
  const formatted = formatReleaseDate(value)
  return formatted || value
})

const emit = defineEmits([
  'close',
  'change-status',
  'toggle-tag',
  'toggle-play-next',
  'clear-cache',
  'refresh-image',
  'delete-trigger',
  'delete-confirm',
  'delete-cancel',
  'update-completion-date',
  'update-user-rating',
])

const overlayTab = ref('options')
watch(
  game,
  (value) => {
    if (value) overlayTab.value = 'options'
  },
  { immediate: true },
)

const dlcGameTimesText = (dlc) => {
  if (dlc?.gameplayAll == null) return '—'
  return `${dlc.gameplayAll} h`
}

const formatDlcRating = (rating) => (rating == null ? '—' : `${rating}%`)

const formatHours = (value) => (value == null ? '—' : `${value} h`)
const formatFetchedAt = (value) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div class="overlay-content game-overlay-content" @click.stop>
      <button
        type="button"
        class="game-overlay-close-btn"
        aria-label="Close overlay"
        @click="emit('close')"
      >
        ×
      </button>
      <div class="overlay-title">
        <template v-if="game?.externalId">
          <a
            class="hltb-title-link"
            :href="`https://howlongtobeat.com/game/${game.externalId}`"
            target="_blank"
            rel="noopener noreferrer"
          >
            {{ game?.name }}
          </a>
        </template>
        <span v-else>{{ game?.name }}</span>
      </div>
      <div class="overlay-subtitle">
        <span>EU {{ releaseDateLabel }}</span>
        <CompletionDateEditor
          v-if="game && (game.completedAt || game.status === 'completed')"
          label=" · Completed"
          :value="game.completedAt"
          @save="(date) => emit('update-completion-date', { id: game.id, completedAt: date })"
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
        <div class="game-options-top">
          <div v-if="game?.imageFullUrl || game?.imageUrl" class="options-cover">
            <MediaImageViewer :src="game.imageFullUrl || game.imageUrl" :alt="game?.name" />
          </div>
          <div class="game-options-actions">
            <div class="overlay-section-label">Status</div>
            <div class="status-buttons">
              <button
                v-for="option in statusOptions"
                :key="option.id"
                :class="['status-btn', { active: game?.status === option.id }]"
                @click="emit('change-status', option.id)"
              >
                {{ option.label }}
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
              :class="['tag-btn', { active: n === (game?.userRating ?? 0) }]"
              @click="emit('update-user-rating', (game?.userRating ?? 0) === n ? null : n)"
            >{{ n }}</button>
          </div>
        </div>

        <!-- Tags -->
        <div class="overlay-tags">
          <div class="overlay-section-label">TAGS</div>
          <div class="tag-buttons">
            <button
              v-for="tag in ['physical', '100%']"
              :key="tag"
              :class="['tag-btn', { active: game?.tags?.includes(tag) }]"
              @click="emit('toggle-tag', tag)"
            >
              {{ tag.charAt(0).toUpperCase() + tag.slice(1) }}
            </button>
          </div>
        </div>

        <div v-if="game?.status === 'backlog'">
          <button
            class="clear-cache-btn"
            :disabled="playNextAtLimit"
            @click="emit('toggle-play-next', game)"
          >
            {{ inPlayNext ? '★ Play Next' : '☆ Play Next' }}
          </button>
        </div>

        <!-- Danger Zone -->
        <div class="overlay-danger-zone">
          <div class="cache-actions">
            <button class="clear-cache-btn" @click="emit('clear-cache', game)">Clear Cache</button>
            <button class="clear-cache-btn" @click="emit('refresh-image', game)">Refresh Image</button>
          </div>

          <template v-if="!deleteConfirm">
            <button class="delete-trigger-btn" @click="emit('delete-trigger')">Delete</button>
          </template>
          <template v-else>
            <p class="delete-confirm-text">Are you sure?</p>
            <div class="delete-confirm-actions">
              <button class="delete-confirm-btn" @click="emit('delete-confirm', game.id)">Delete</button>
              <button class="delete-cancel-btn" @click="emit('delete-cancel')">Cancel</button>
            </div>
          </template>
        </div>
      </template>

      <template v-else>
        <div class="overlay-detail-page">
          <div class="detail-info">
            <section class="detail-section hltb-section">
              <h3 class="detail-section-title">HowLongToBeat</h3>
              <div class="metric-row">
                <div class="metric-box metric-box-all">
                  <span class="metric-label">Average</span>
                  <span class="metric-value">{{ formatHours(game?.gameplayAll) }}</span>
                </div>
                <div class="metric-box">
                  <span class="metric-label">Main Story</span>
                  <span class="metric-value">{{ formatHours(game?.gameplayMain) }}</span>
                </div>
                <div class="metric-box">
                  <span class="metric-label">Main + Sides</span>
                  <span class="metric-value">{{ formatHours(game?.gameplayExtra) }}</span>
                </div>
                <div class="metric-box">
                  <span class="metric-label">Completionist</span>
                  <span class="metric-value">{{ formatHours(game?.gameplayComplete) }}</span>
                </div>
              </div>
            </section>
            <section v-if="game?.summary" class="detail-section about-section">
              <h3 class="detail-section-title">About</h3>
              <p class="hltb-description">{{ game.summary }}</p>
            </section>
            <section v-if="game?.platform || game?.genre || game?.developer || game?.publisher || game?.hltbFetchedAt" class="detail-section">
              <h3 class="detail-section-title">Game information</h3>
              <div class="hltb-fields">
                <div v-if="game?.platform" class="hltb-field"><strong>Platforms</strong><span>{{ game.platform }}</span></div>
                <div v-if="game?.genre" class="hltb-field"><strong>Genres</strong><span>{{ game.genre }}</span></div>
                <div v-if="game?.developer" class="hltb-field"><strong>Developer</strong><span>{{ game.developer }}</span></div>
                <div v-if="game?.publisher" class="hltb-field"><strong>Publisher</strong><span>{{ game.publisher }}</span></div>
                <div v-if="game?.hltbFetchedAt" class="hltb-field"><strong>HLTB abgerufen</strong><span>{{ formatFetchedAt(game.hltbFetchedAt) }}</span></div>
              </div>
            </section>
            <section v-if="game?.dlcs?.length" class="detail-section dlc-section">
              <h3 class="detail-section-title">DLCs</h3>
              <div class="dlc-list">
                <a
                  v-for="dlc in game.dlcs"
                  :key="dlc.id"
                  class="dlc-row"
                  :href="`https://howlongtobeat.com/game/${dlc.id}`"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span class="dlc-name">{{ dlc.name }}</span>
                  <span class="dlc-time">{{ dlcGameTimesText(dlc) }}</span>
                  <span class="dlc-rating">{{ formatDlcRating(dlc.rating) }}</span>
                  <span class="dlc-chevron" aria-hidden="true">›</span>
                </a>
              </div>
            </section>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>

.game-options-top {
  display: grid;
  grid-template-columns: minmax(130px, 190px) 1fr;
  gap: 18px;
  align-items: center;
  margin-bottom: 16px;
}

.game-overlay-content {
  position: relative;
  max-height: calc(100vh - 40px);
  overflow-y: auto;
  scrollbar-width: none;
}

.game-overlay-content::-webkit-scrollbar {
  display: none;
}

.game-overlay-close-btn {
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

.game-overlay-close-btn:hover {
  border-color: var(--accent);
  color: var(--text);
  background: var(--surface2);
}

.options-cover {
  display: flex;
  align-items: center;
  min-height: 190px;
}

.options-cover :deep(img) {
  width: 100%;
  height: auto;
  min-height: 190px;
  max-height: 100%;
  object-fit: cover;
  border-radius: 2px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.game-options-actions {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.game-options-actions .status-buttons {
  margin: 0;
}

.overlay-detail-page {
  display: flex;
  flex-direction: column;
  padding-top: 4px;
  align-items: stretch;
}

.hltb-title-link {
  color: inherit;
  text-decoration: none;
  font-family: inherit;
  font-size: inherit;
}

.detail-cover {
  width: 100%;
  max-width: 240px;
  display: flex;
  flex-direction: column;
}

.detail-cover img {
  width: 100%;
  max-width: 240px;
  height: 100%;
  border-radius: 2px;
  object-fit: cover;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}

.detail-info {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.detail-section {
  padding: 14px 0;
  border-top: 1px solid var(--border);
}

.detail-section:first-child {
  border-top: 0;
  padding-top: 0;
}

.detail-section-title {
  margin: 0 0 9px;
  color: var(--text);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border: 1px solid rgb(var(--accent-rgb) / 0.2);
  border-radius: 3px;
  overflow: hidden;
  background: rgb(var(--accent-rgb) / 0.07);
}

.metric-box {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 0px;
  padding: 7px 8px;
  min-height: 48px;
  border-left: 1px solid rgb(var(--accent-rgb) / 0.2);
}

.metric-box:first-child {
  border-left: 0;
}

.metric-box-all {
  background: rgb(var(--accent-rgb) / 0.14);
}

.metric-box-all .metric-value {
  font-weight: 600;
}

.hltb-description {
  max-width: 62ch;
  margin: 0;
  color: var(--text);
  font-size: 0.82rem;
  line-height: 1.55;
  white-space: pre-line;
}

.hltb-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 13px 24px;
  font-size: 0.78rem;
}

.hltb-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.hltb-field strong {
  color: var(--text-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.hltb-field span {
  color: var(--text);
  overflow-wrap: anywhere;
}

.dlc-section {
  margin-top: 0;
}

.dlc-list {
  display: flex;
  flex-direction: column;
}

.dlc-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 12px;
  min-height: 24px;
  color: var(--text);
  font-size: 0.78rem;
  text-decoration: none;
}

.dlc-row + .dlc-row {
  border-top: 1px solid var(--border);
}

.dlc-row:hover {
  background: var(--surface2);
  border-radius: 2px;
}

.dlc-name {
  min-width: 0;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dlc-time,
.dlc-rating {
  color: var(--text-muted);
  white-space: nowrap;
}

.dlc-chevron {
  color: var(--text-dim);
  font-size: 1.15rem;
  line-height: 1;
}

@media (max-width: 768px) {
  .game-options-top {
    grid-template-columns: 160px 1fr;
    gap: 12px;
  }

  .options-cover,
  .options-cover :deep(img) {
    min-height: 160px;
  }

  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .metric-box:nth-child(3) {
    border-left: 0;
    border-top: 1px solid rgb(var(--accent-rgb) / 0.2);
  }

  .metric-box:nth-child(4) {
    border-top: 1px solid rgb(var(--accent-rgb) / 0.2);
  }

  .hltb-fields {
    grid-template-columns: 1fr;
  }

  .metric-box {
    min-height: auto;
  }
  
  .game-options-actions .status-buttons {
    grid-template-columns: 1fr;
  }
}

</style>
