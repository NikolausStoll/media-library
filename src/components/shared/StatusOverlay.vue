<script setup>
defineProps({
  show:    { type: Boolean, required: true },
  options: { type: Array, required: true },   // [{ value, label, color? }]
  current: { type: String, default: null },
})
defineEmits(['select', 'close'])
</script>

<template>
  <Transition name="overlay">
    <div v-if="show" class="overlay-backdrop" @click.self="$emit('close')">
      <div class="overlay-panel">
        <button
          v-for="opt in options"
          :key="opt.value"
          class="overlay-option"
          :class="{ active: current === opt.value }"
          :style="opt.color ? `--opt-color: ${opt.color}` : ''"
          @click="$emit('select', opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.overlay-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.overlay-panel {
  background: #1a1d26;
  border: 1px solid #2a2d3a;
  border-radius: 12px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  min-width: 180px;
}

.overlay-option {
  padding: 0.6rem 1rem;
  border: 1px solid #2a2d3a;
  border-radius: 8px;
  background: transparent;
  color: #e0e0e0;
  text-align: left;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background 0.15s;
}

.overlay-option:hover,
.overlay-option.active {
  background: var(--opt-color, #3b82f6);
  border-color: var(--opt-color, #3b82f6);
  color: #fff;
}

.overlay-enter-active,
.overlay-leave-active { transition: opacity 0.15s; }
.overlay-enter-from,
.overlay-leave-to { opacity: 0; }
</style>
