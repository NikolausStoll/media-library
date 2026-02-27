<!-- src/components/games/StatusOverlay.vue -->
<script setup>
defineProps({
  game: { type: Object, default: null },
  statusOptions: { type: Array, required: true },
  deleteConfirm: { type: Boolean, default: false },
  inPlayNext: { type: Boolean, default: false },
  playNextAtLimit: { type: Boolean, default: false },
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
])
</script>

<template>
  <div class="overlay" @click="emit('close')">
    <div class="overlay-content" @click.stop>
      <div class="overlay-title">{{ game?.name }}</div>
      <div class="overlay-subtitle">Move to</div>

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

      <div v-if="game?.status === 'backlog'" class="overlay-tags">
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
    </div>
  </div>
</template>
