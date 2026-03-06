<!-- src/components/games/StatusOverlay.vue -->
<script setup>
import { computed, ref, watch, toRefs } from 'vue'
import { formatReleaseDate } from '../../utils/releaseDate.js'
import CompletionDateEditor from '../shared/CompletionDateEditor.vue'

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
  'delete-trigger',
  'delete-confirm',
  'delete-cancel',
  'update-completion-date',
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
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div class="overlay-content" @click.stop>
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
          <button class="clear-cache-btn" @click="emit('clear-cache', game)">Clear Cache</button>

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
          <div v-if="game?.imageUrl" class="detail-cover">
            <img :src="game.imageUrl" :alt="game?.name" />
          </div>
          <div class="detail-info">
            <div class="detail-metrics">
              <div class="metric-box metric-box-all">
                <span class="metric-label">Average</span>
                <span class="metric-value" v-if="game?.gameplayAll != null">{{ game.gameplayAll }} h</span>
                <span class="metric-value" v-else>—</span>
              </div>
              <div class="metric-box" v-if="game?.gameplayMain != null">
                <span class="metric-label">Main Story</span>
                <span class="metric-value">{{ game.gameplayMain }} h</span>
              </div>
              <div class="metric-box" v-if="game?.gameplayExtra != null">
                <span class="metric-label">Main Story & Sides</span>
                <span class="metric-value">{{ game.gameplayExtra }} h</span>
              </div>
              <div class="metric-box" v-if="game?.gameplayComplete != null">
                <span class="metric-label">Completionist</span>
                <span class="metric-value">{{ game.gameplayComplete }} h</span>
              </div>
            </div>
          </div>
        </div>
        <div class="overlay-detail-page-dlc">          
          <div v-if="game?.dlcs?.length" class="dlc-section">
            <div class="dlc-section-title">DLCs</div>
            <table class="dlc-table">
              <tbody>
                <tr v-for="dlc in game.dlcs" :key="dlc.id">
                  <td>
                    <a
                      class="dlc-link"
                      :href="`https://howlongtobeat.com/game/${dlc.id}`"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {{ dlc.name }}
                    </a>
                  </td>
                  <td>{{ dlcGameTimesText(dlc) }}</td>
                  <td>{{ formatDlcRating(dlc.rating) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.overlay-detail-page {
  display: flex;
  flex-direction: row;
  gap: 16px;
  padding-top: 8px;
  align-items: stretch;
}
.overlay-detail-page-dlc {
  display: block;
  flex-direction: row;
  gap: 16px;
  padding-top: 8px;
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
  gap: 12px;
  flex: 1;
}

.detail-metrics {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
}

.metric-box {
  flex: 1;
  min-width: 0;
  border-radius: 2px;
  border: 1px solid rgb(var(--accent-rgb) / 0.35);
  background: rgb(var(--accent-rgb) / 0.15);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: 4px;
  padding: 6px 8px;
  min-height: 90px;
}

.metric-box-all {
  background: rgb(var(--accent-rgb) / 0.28);
  border-color: rgb(var(--accent-rgb) / 0.45);
}

.metric-box-all .metric-label {
  font-weight: 700;
}

.metric-box-all .metric-value {
  font-weight: 700;
}

.dlc-section {
  margin-top: 18px;
  display: block;
}

.dlc-section-title {
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.dlc-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
  table-layout: fixed;
}

.dlc-table td {
  text-align: left;
  padding: 4px 0;
  vertical-align: top;
}

.dlc-table tbody tr + tr td {
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.dlc-table td:nth-child(1) {
  width: 55%;
}

.dlc-table td:nth-child(2) {
  width: 6%;
  color: var(--text-muted);
  font-weight: 400;
}

.dlc-table td:nth-child(3) {
  width: 6%;
  color: var(--text-muted);
  font-weight: 400;
  text-align: right;
  ;
}

.dlc-link {
  color: inherit;
  font-weight: 400;
  text-decoration: none;
}

@media (max-width: 768px) {
  .metric-box {
    min-height: auto;
  }
}

</style>
