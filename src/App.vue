<script setup>
import { ref, computed, watch } from 'vue'
import GameList from './components/GameList.vue'
import MovieList from './components/MovieList.vue'
import SeriesList from './components/SeriesList.vue'

const STORAGE_KEY = 'mediaType'
const mediaType = ref(localStorage.getItem(STORAGE_KEY) ?? 'game')

watch(mediaType, val => localStorage.setItem(STORAGE_KEY, val))

const tabs = [
  { value: 'game',   label: 'Games',  icon: '🎮' },
  { value: 'movie',  label: 'Movies', icon: '🎬' },
  { value: 'series', label: 'Serien', icon: '📺' },
]
</script>

<template>
  <div class="app-shell">
    <nav class="tab-nav">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        class="tab-btn"
        :class="{ active: mediaType === tab.value }"
        @click="mediaType = tab.value"
      >
        <span class="tab-icon">{{ tab.icon }}</span>
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </nav>

    <main class="tab-content">
      <GameList   v-if="mediaType === 'game'" />
      <MovieList  v-else-if="mediaType === 'movie'" />
      <SeriesList v-else />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--color-bg, #0f1117);
}

.tab-nav {
  display: flex;
  gap: 0.25rem;
  padding: 0.75rem 1rem 0;
  background: var(--color-surface, #1a1d26);
  border-bottom: 1px solid var(--color-border, #2a2d3a);
  position: sticky;
  top: 0;
  z-index: 50;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 6px 6px 0 0;
  background: transparent;
  color: var(--color-muted, #888);
  font-size: 0.9rem;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.tab-btn:hover {
  background: var(--color-hover, #2a2d3a);
  color: var(--color-text, #e0e0e0);
}

.tab-btn.active {
  background: var(--color-bg, #0f1117);
  color: var(--color-text, #e0e0e0);
  font-weight: 600;
  border-top: 2px solid var(--color-accent, #3b82f6);
}

.tab-icon {
  font-size: 1rem;
}

.tab-content {
  flex: 1;
}
</style>
