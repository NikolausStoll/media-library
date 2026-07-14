<script setup>
import { computed, nextTick, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  alternateTitle: { type: String, default: null },
})

const titleRef = ref(null)
const titleNeedsTwoLines = ref(false)
const showAlternate = ref(false)
let resizeObserver = null

const hasAlternate = computed(() => {
  const alt = String(props.alternateTitle ?? '').trim()
  return Boolean(alt && alt !== String(props.title ?? '').trim())
})

const canToggle = computed(() => hasAlternate.value && titleNeedsTwoLines.value)

const showAlternateBelow = computed(() => hasAlternate.value && !titleNeedsTwoLines.value)

const displayTitle = computed(() => {
  if (canToggle.value && showAlternate.value)
    return String(props.alternateTitle ?? '').trim()
  return props.title
})

function measureTitleLines() {
  const el = titleRef.value
  if (!el) {
    titleNeedsTwoLines.value = false
    return
  }

  const width = el.clientWidth
  if (!width) return

  const style = window.getComputedStyle(el)
  const lineHeight = Number.parseFloat(style.lineHeight)
    || Number.parseFloat(style.fontSize) * 1.3

  const probe = document.createElement('span')
  probe.textContent = props.title
  probe.setAttribute('aria-hidden', 'true')
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'normal',
    width: `${width}px`,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontFamily: style.fontFamily,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    display: 'block',
  })

  el.parentElement?.appendChild(probe)
  titleNeedsTwoLines.value = probe.scrollHeight > lineHeight * 1.35
  probe.remove()
}

function setupObserver() {
  teardownObserver()
  const el = titleRef.value
  if (!el) return
  resizeObserver = new ResizeObserver(() => {
    measureTitleLines()
  })
  resizeObserver.observe(el)
}

function teardownObserver() {
  resizeObserver?.disconnect()
  resizeObserver = null
}

async function refreshLayout() {
  showAlternate.value = false
  await nextTick()
  measureTitleLines()
  if (titleRef.value?.clientWidth === 0) {
    requestAnimationFrame(() => {
      measureTitleLines()
    })
  }
  if (hasAlternate.value)
    setupObserver()
  else
    teardownObserver()
}

watch(
  () => [props.title, props.alternateTitle],
  () => {
    refreshLayout()
  },
  { immediate: true },
)

function handleTitleClick(event) {
  if (!canToggle.value) return
  event.stopPropagation()
  showAlternate.value = !showAlternate.value
}

onUnmounted(() => {
  teardownObserver()
})
</script>

<template>
  <div class="book-card-title-block">
    <p
      ref="titleRef"
      :class="[
        'card-title',
        'book-card-title-main',
        {
          'is-toggleable': canToggle,
          'is-alternate-view': canToggle && showAlternate,
          'is-single-line-slot': showAlternateBelow,
        },
      ]"
      @click="handleTitleClick"
    >
      {{ displayTitle }}<span v-if="canToggle" class="book-card-title-hint"> ↔</span>
    </p>
    <p
      v-if="showAlternateBelow"
      class="book-card-alternate-title"
    >
      {{ alternateTitle }}
    </p>
  </div>
</template>

<style scoped>
.book-card-title-block {
  min-width: 0;
  min-height: calc(11px * 1.3 * 2);
  max-height: calc(11px * 1.3 * 2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.book-card-title-main {
  display: -webkit-box;
  margin: 0;
  min-height: 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.book-card-title-main.is-single-line-slot {
  -webkit-line-clamp: 1;
  line-clamp: 1;
}

.book-card-title-main.is-toggleable {
  cursor: pointer;
}

.book-card-title-main.is-toggleable:hover {
  color: var(--accent-light);
}

.book-card-title-main.is-alternate-view {
  font-style: italic;
  color: var(--text-muted);
}

.book-card-title-hint {
  color: var(--text-muted);
  font-style: normal;
  font-weight: 600;
}

.book-card-alternate-title {
  margin: 0;
  color: var(--text-muted);
  font-size: 11px;
  font-style: italic;
  font-weight: 500;
  line-height: 1.3;
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
}
</style>
