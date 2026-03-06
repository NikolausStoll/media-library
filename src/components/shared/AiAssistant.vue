<script setup>
import { computed, nextTick, onMounted, ref } from 'vue'

const props = defineProps({
  mediaType: { type: String, required: true },
  activeTab: { type: String, required: true },
  contextItems: { type: Array, default: () => [] },
})

const emit = defineEmits(['close'])

const prompt = ref('')
const loading = ref(false)
const result = ref(null)
const error = ref('')
const promptRef = ref(null)

const contextPreview = computed(() => props.contextItems.slice(0, 4))
const contextLabel = computed(() => {
  const typeLabel = props.mediaType.charAt(0).toUpperCase() + props.mediaType.slice(1)
  const tabLabel = props.activeTab.charAt(0).toUpperCase() + props.activeTab.slice(1)
  return `${typeLabel} · ${tabLabel}`
})
const isSubmitDisabled = computed(() => loading.value || !prompt.value.trim())

onMounted(() => {
  nextTick(() => promptRef.value?.focus())
})

async function submitPrompt() {
  if (isSubmitDisabled.value) return
  loading.value = true
  error.value = ''
  try {
    const response = await fetch('/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mediaType: props.mediaType,
        activeTab: props.activeTab,
        prompt: prompt.value.trim(),
        contextItems: props.contextItems,
      }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      throw new Error(body?.error ?? response.statusText)
    }

    result.value = await response.json()
  } catch (err) {
    error.value = err.message ?? 'Ein unbekannter Fehler ist aufgetreten'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="ai-assistant-overlay" @click.self="emit('close')">
    <div class="ai-assistant-modal">
      <header class="ai-assistant-header">
        <div>
          <p class="ai-assistant-title">AI-Assistent</p>
          <p class="ai-assistant-context">{{ contextLabel }}</p>
        </div>
        <button class="ai-close-btn" @click="emit('close')" type="button">✕</button>
      </header>

      <div class="ai-context-area" v-if="contextPreview.length">
        <div
          v-for="item in contextPreview"
          :key="`${item.title}-${item.status ?? ''}`"
          class="ai-context-item"
        >
          <span class="ai-context-title">{{ item.title }}</span>
          <span class="ai-context-meta" v-if="item.status || item.metadata">
            {{ item.status }}<span v-if="item.status && item.metadata"> · </span>{{ item.metadata }}
          </span>
        </div>
      </div>
      <p v-else class="ai-context-empty">Keine Kontextdaten verfügbar.</p>

      <label class="ai-label" for="ai-assistant-prompt">Was möchtest du wissen?</label>
      <textarea
        id="ai-assistant-prompt"
        ref="promptRef"
        v-model="prompt"
        class="ai-prompt-input"
        placeholder="Beschreibe, ob du ein neues Spiel, einen unbekannten Film oder eine Serie suchst."
        @keydown.enter.exact.prevent="submitPrompt"
      ></textarea>

      <div class="ai-actions">
        <button class="ai-submit-btn" :disabled="isSubmitDisabled" type="button" @click="submitPrompt">
          {{ loading ? 'Lädt …' : 'Empfehlung anfordern' }}
        </button>
        <button class="ai-secondary-btn" type="button" @click="emit('close')">Schließen</button>
      </div>

      <p v-if="error" class="ai-error">{{ error }}</p>

      <section v-if="result" class="ai-result">
        <p class="ai-result-label">Empfehlung</p>
        <p class="ai-result-suggestion">
          {{ result.suggestion ?? result.message ?? 'Keine spezielle Empfehlung erhalten.' }}
        </p>
        <p v-if="result.reasoning" class="ai-result-reason">
          Begründung: {{ result.reasoning }}
        </p>
        <p v-if="result.contextSummary" class="ai-result-context">
          Kontext: {{ result.contextSummary }}
        </p>
      </section>
    </div>
  </div>
</template>
