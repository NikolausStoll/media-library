/** Dense (9-col) grid only makes sense on wider viewports. */
export const DENSE_GRID_MIN_WIDTH = 1400

export function allowsDenseGrid(width = typeof window !== 'undefined' ? window.innerWidth : DENSE_GRID_MIN_WIDTH) {
  return width >= DENSE_GRID_MIN_WIDTH
}

export function clampGridDensity(density, allowDense = allowsDenseGrid()) {
  if (density === 'dense' && !allowDense) return 'compact'
  if (density === 'dense' || density === 'compact') return density
  return 'normal'
}

export function readStoredGridDensity() {
  const clamped = clampGridDensity(localStorage.getItem('gridDensity') || 'normal')
  if (localStorage.getItem('gridDensity') !== clamped)
    localStorage.setItem('gridDensity', clamped)
  return clamped
}
