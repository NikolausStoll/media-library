<script setup>
defineProps({
  mediaType: { type: String, required: true },
  variant: { type: String, default: 'sidebar' },
})

const emit = defineEmits(['switch-media'])

const mediaItems = [
  { id: 'game', label: 'Games' },
  { id: 'book', label: 'Books' },
  { id: 'movie', label: 'Movies' },
  { id: 'series', label: 'Series' },
]
</script>

<template>
  <nav
    :class="['media-switcher', `media-switcher--${variant}`]"
    aria-label="Media sections"
  >
    <button
      v-for="item in mediaItems"
      :key="item.id"
      type="button"
      :class="['media-switcher-btn', { active: mediaType === item.id }]"
      :data-media="item.id"
      :aria-current="mediaType === item.id ? 'page' : undefined"
      @click="emit('switch-media', item.id)"
    >
      {{ item.label }}
    </button>
  </nav>
</template>
