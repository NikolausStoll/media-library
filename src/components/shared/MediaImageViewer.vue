<script setup>
import { onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  src: { type: String, default: null },
  alt: { type: String, default: '' },
})

const isOpen = ref(false)

function close() {
  isOpen.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

watch(isOpen, (open) => {
  if (open) document.addEventListener('keydown', onKeydown, true)
  else document.removeEventListener('keydown', onKeydown, true)
})

onUnmounted(() => document.removeEventListener('keydown', onKeydown, true))
</script>

<template>
  <template v-if="src">
    <button
      type="button"
      class="media-image-viewer-trigger"
      :aria-label="`View ${alt} larger`"
      @click.stop="isOpen = true"
    >
      <img :src="src" :alt="alt" />
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="media-image-lightbox" @click="close">
        <button
          type="button"
          class="media-image-lightbox-close"
          aria-label="Close enlarged image"
          @click="close"
        >
          ×
        </button>
        <img
          class="media-image-lightbox-image"
          :src="src"
          :alt="alt"
          @click.stop
        />
      </div>
    </Teleport>
  </template>
</template>

<style scoped>
.media-image-viewer-trigger {
  display: block;
  width: 100%;
  padding: 0;
  border: 0;
  background: transparent;
  cursor: zoom-in;
}

.media-image-viewer-trigger img {
  display: block;
  width: 100%;
}

.media-image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgb(0 0 0 / 85%);
  cursor: zoom-out;
}

.media-image-lightbox-image {
  max-width: min(92vw, 1200px);
  max-height: 92vh;
  object-fit: contain;
  cursor: default;
}

.media-image-lightbox-close {
  position: absolute;
  top: 16px;
  right: 20px;
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  color: white;
  font-size: 32px;
  line-height: 1;
  cursor: pointer;
}
</style>
