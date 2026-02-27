<script setup>
import { ref, computed, watch } from 'vue'
import GameList from './components/GameList.vue'
import MovieList from './components/MovieList.vue'
import SeriesList from './components/SeriesList.vue'

const STORAGE_KEY = 'mediaType'
const mediaType = ref(localStorage.getItem(STORAGE_KEY) ?? 'game')

watch(mediaType, val => localStorage.setItem(STORAGE_KEY, val))

function switchMedia(value) {
  mediaType.value = value
}
</script>

<template>
  <div class="app-shell">
    <main class="tab-content">
      <GameList
        v-if="mediaType === 'game'"
        :media-type="mediaType"
        @switch-media="switchMedia"
      />
      <MovieList
        v-else-if="mediaType === 'movie'"
        :media-type="mediaType"
        @switch-media="switchMedia"
      />
      <SeriesList
        v-else
        :media-type="mediaType"
        @switch-media="switchMedia"
      />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg);
}

.tab-content {
  flex: 1;
}
</style>
