import '@testing-library/jest-dom'
import { afterEach, vi } from 'vitest'

// document.body zwischen Tests sauber halten
afterEach(() => {
  document.body.innerHTML = ''
  vi.clearAllMocks()
})

// Transitions deaktivieren (keine CSS-Animationen im JSDOM)
Object.defineProperty(window, 'CSS', { value: null })
Object.defineProperty(document, 'doctype', {
  value: '<!DOCTYPE html>',
})
