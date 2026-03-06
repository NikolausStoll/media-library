<script setup>
import { computed, ref, watch, nextTick } from 'vue'
import { formatDateDDMMYYYY } from '../../utils/dateFormat.js'

const props = defineProps({
  label: { type: String, required: true },
  value: { type: String, default: '' },
})

const emit = defineEmits(['save'])

const editing = ref(false)
const inputValue = ref(props.value ?? '')
const inputRef = ref(null)
const displayValue = computed(() => formatDateDDMMYYYY(props.value))

watch(
  () => props.value,
  (val) => {
    inputValue.value = val ?? ''
  },
)

function startEditing() {
  editing.value = true
  nextTick(() => inputRef.value?.focus())
}

function finishEditing() {
  editing.value = false
  emit('save', inputValue.value || null)
}
</script>

<template>
    <span
      v-if="!editing"
      class="completion-date-label"
      role="button"
      tabindex="0"
      @click="startEditing"
      @keydown.enter.prevent="startEditing"
    >
      {{ props.label }}: {{ displayValue || '-' }}
    </span>
    <input
      v-else
      ref="inputRef"
      type="date"
      class="completion-date-input"
      v-model="inputValue"
      @blur="finishEditing"
      @keydown.enter.prevent="finishEditing"
    />
</template>

<style scoped>

.completion-date-label {
  cursor: pointer;
  text-decoration: none;
}

.completion-date-input {
  background: var(--surface2);
  border: 1px solid var(--border2);
  border-radius: 4px;
  padding: 2px 6px;
  font-size: 0.85rem;
  color: var(--text);
}

</style>
