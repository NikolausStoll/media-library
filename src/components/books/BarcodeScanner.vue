<!-- src/components/books/BarcodeScanner.vue -->
<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'

const emit = defineEmits(['scanned', 'close'])

const scannerRef = ref(null)
const error = ref('')
let html5Qrcode = null
const READER_ID = 'barcode-reader'

onMounted(async () => {
  try {
    html5Qrcode = new Html5Qrcode(READER_ID)
    await html5Qrcode.start(
      { facingMode: 'environment' },
      {
        fps: 10,
        qrbox: { width: 280, height: 120 },
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
      },
      (decodedText) => {
        stopScanner()
        emit('scanned', decodedText)
      },
      () => {},
    )
  } catch (err) {
    error.value = err?.message ?? 'Camera access denied'
  }
})

async function stopScanner() {
  if (html5Qrcode) {
    try {
      const state = html5Qrcode.getState()
      if (state === 2) { // SCANNING
        await html5Qrcode.stop()
      }
    } catch {}
    try { html5Qrcode.clear() } catch {}
    html5Qrcode = null
  }
}

onBeforeUnmount(() => {
  stopScanner()
})

function handleClose() {
  stopScanner()
  emit('close')
}
</script>

<template>
  <div class="scanner-container">
    <div class="scanner-header">
      <span class="scanner-title">Scan ISBN Barcode</span>
      <button class="scanner-close-btn" @click="handleClose">✕</button>
    </div>
    <div :id="READER_ID" ref="scannerRef" class="scanner-viewport"></div>
    <p v-if="error" class="scanner-error">{{ error }}</p>
    <p v-else class="scanner-hint">Point your camera at a book's barcode</p>
  </div>
</template>

<style scoped>
.scanner-container {
  border: 1px solid var(--border2);
  border-radius: 2px;
  overflow: hidden;
  background: var(--surface2);
}

.scanner-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  background: var(--surface);
  border-bottom: 1px solid var(--border2);
}

.scanner-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.scanner-close-btn {
  background: none;
  border: 1px solid var(--border2);
  border-radius: 2px;
  color: var(--text-muted);
  cursor: pointer;
  font-size: 11px;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.scanner-close-btn:hover {
  border-color: var(--danger);
  color: var(--danger);
}

.scanner-viewport {
  width: 100%;
  min-height: 200px;
}

.scanner-viewport :deep(video) {
  width: 100% !important;
  border-radius: 0;
}

.scanner-viewport :deep(#qr-shaded-region) {
  border-color: rgba(16, 185, 129, 0.5) !important;
}

.scanner-error {
  font-size: 11px;
  color: var(--danger);
  text-align: center;
  padding: 8px;
}

.scanner-hint {
  font-size: 10px;
  color: var(--text-dim);
  text-align: center;
  padding: 6px;
}
</style>
