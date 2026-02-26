<!-- src/components/games/GameCard.vue -->
<script setup>
defineProps({
  game: { type: Object, required: true },
  activeTab: { type: String, required: true },
  playNextList: { type: Array, default: () => [] },
  formatRating: { type: Function, required: true },
  resolveLogo: { type: Function, required: true },
  getPlatformLabel: { type: Function, required: true },
  viewMode: { type: String, default: 'grid' },
})

const emit = defineEmits(['open-overlay', 'open-platform-editor', 'add-to-play-next', 'remove-from-play-next'])
</script>

<template>
  <div class="game-card" @click="(e) => emit('open-overlay', game, e)">
    <div class="card-cover-wrap">
      <img :src="game.imageUrl" :alt="game.name" class="card-cover" />
      <button
        v-if="activeTab === 'backlog' && !playNextList.includes(String(game.id)) && playNextList.length < 6"
        class="card-pn-btn"
        @click.stop="emit('add-to-play-next', game)"
        title="Add to Play Next"
      >›</button>
      <img
        v-if="game.tags?.includes('100%')"
        src="/tags/100percent.png"
        class="card-tag-overlay"
      />
    </div>

    <div class="card-info">
      <p class="card-title">{{ game.name }}</p>

      <div class="card-row">
        <div class="card-platform" @click.stop="(e) => emit('open-platform-editor', game, e)">
          <button v-if="game.platforms.length === 0" class="add-first-platform-btn">+</button>
          <template v-else>
            <span class="platform-primary">
              <img :src="resolveLogo(game.platforms[0])" class="platform-logo-sm" :title="getPlatformLabel(game.platforms[0])" />
              <span class="platform-text">{{ getPlatformLabel(game.platforms[0]) }}</span>
            </span>
            <img
              v-for="(plat, idx) in game.platforms.slice(1)"
              :key="idx"
              :src="resolveLogo(plat)"
              class="platform-logo-sm"
              :title="getPlatformLabel(plat)"
            />
          </template>
        </div>

        <div v-if="game.gameplayAll != null" class="card-time-wrap" @click.stop>
          <span class="card-time">{{ game.gameplayAll }} h</span>
          <div class="gameplay-tooltip">
            <div v-if="game.gameplayMain != null" class="tooltip-row">
              <span class="tooltip-label">Main</span>
              <span class="tooltip-value">{{ game.gameplayMain }} h</span>
            </div>
            <div v-if="game.gameplayExtra != null" class="tooltip-row">
              <span class="tooltip-label">Extra</span>
              <span class="tooltip-value">{{ game.gameplayExtra }} h</span>
            </div>
            <div v-if="game.gameplayComplete != null" class="tooltip-row">
              <span class="tooltip-label">Complete</span>
              <span class="tooltip-value">{{ game.gameplayComplete }} h</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card-row" v-if="game.rating != null || game.dlcs?.length || game.tags?.length">
        <div class="card-row-left">
          <div v-if="game.dlcs?.length" class="dlc-wrap" @click.stop>
            <span class="dlc-count">{{ game.dlcs.length }} DLC</span>
            <div class="dlc-tooltip">
              <div v-for="dlc in game.dlcs" :key="dlc.id" class="dlc-name">{{ dlc.name }}</div>
            </div>
          </div>
          <div v-if="game.tags?.length" class="card-tags" @click.stop>
            <img v-if="game.tags.includes('physical')" src="/tags/physical.png" title="Physical" class="card-tag-icon" />
            <span v-if="game.tags.includes('100%')" class="card-tag-100" title="100%">100%</span>
          </div>
        </div>
        <span v-if="game.rating != null" class="card-rating">{{ formatRating(game.rating) }}</span>
      </div>
    </div>
  </div>
</template>
