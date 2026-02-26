<script setup>
defineProps({
  title:    { type: String, required: true },
  titleDe:  { type: String, default: null },
  imageUrl: { type: String, default: null },
  year:     { type: String, default: null },
  rating:   { type: Number, default: null },
  isNext:   { type: Boolean, default: false },
})
defineEmits(['click'])
</script>

<template>
  <div
    class="media-card"
    :class="{ 'is-next': isNext }"
    @click="$emit('click')"
  >
    <div class="card-poster">
      <img v-if="imageUrl" :src="imageUrl" :alt="title" loading="lazy" />
      <div v-else class="poster-placeholder">
        <span>{{ title.slice(0, 2).toUpperCase() }}</span>
      </div>
      <slot name="badge" />
    </div>

    <div class="card-info">
      <p class="card-title">{{ title }}</p>
      <p v-if="titleDe && titleDe !== title" class="card-title-de">{{ titleDe }}</p>
      <div class="card-meta">
        <span v-if="year" class="meta-year">{{ year }}</span>
        <span v-if="rating" class="meta-rating">★ {{ rating.toFixed(1) }}</span>
      </div>
      <slot name="details" />
    </div>

    <slot name="actions" />
  </div>
</template>

<style scoped>
.media-card {
  display: flex;
  gap: 0.75rem;
  padding: 0.75rem;
  border-radius: 10px;
  background: #1a1d26;
  border: 1px solid #2a2d3a;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.media-card:hover {
  border-color: #3b82f6;
  background: #1e2230;
}

.media-card.is-next {
  border-color: #f59e0b;
}

.card-poster {
  position: relative;
  flex-shrink: 0;
  width: 54px;
  height: 80px;
  border-radius: 6px;
  overflow: hidden;
}

.card-poster img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.poster-placeholder {
  width: 100%;
  height: 100%;
  background: #2a2d3a;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 700;
  color: #555;
}

.card-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.card-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #e0e0e0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.card-title-de {
  font-size: 0.8rem;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin: 0;
}

.card-meta {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.meta-year {
  font-size: 0.8rem;
  color: #888;
}

.meta-rating {
  font-size: 0.8rem;
  color: #f59e0b;
}
</style>
