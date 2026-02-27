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
    class="game-card"
    :class="{ 'is-next': isNext }"
    @click="$emit('click')"
  >
    <div class="card-cover-wrap">
      <img v-if="imageUrl" :src="imageUrl" :alt="title" class="card-cover" loading="lazy" />
      <div v-else class="card-cover poster-placeholder">
        <span>{{ title.slice(0, 2).toUpperCase() }}</span>
      </div>
      <slot name="corner" />
      <slot name="badge" />
    </div>

    <div class="card-info">
      <p
        class="card-title"
        :title="titleDe && titleDe !== title ? titleDe : null"
      >
        {{ title }}<span v-if="year"> ({{ year }})</span>
      </p>
      <slot name="details" />
    </div>

    <slot name="actions" />
  </div>
</template>

<style scoped>
.poster-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface3);
  color: var(--text-dim);
  font-weight: 700;
  font-size: 12px;
}
</style>
