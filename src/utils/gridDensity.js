import {
  allowsCompactGrid,
  allowsDenseGrid,
  currentViewportWidth,
} from './breakpoints.js'

export {
  COMPACT_GRID_MIN_WIDTH,
  DENSE_GRID_MIN_WIDTH,
  allowsCompactGrid,
  allowsDenseGrid,
} from './breakpoints.js'

export function clampGridDensity(density, width = currentViewportWidth()) {
  if (!allowsCompactGrid(width)) return 'normal'
  if (density === 'dense' && !allowsDenseGrid(width)) return 'compact'
  if (density === 'dense' || density === 'compact') return density
  return 'normal'
}

export function readStoredGridDensity(width = currentViewportWidth()) {
  const clamped = clampGridDensity(localStorage.getItem('gridDensity') || 'normal', width)
  if (localStorage.getItem('gridDensity') !== clamped)
    localStorage.setItem('gridDensity', clamped)
  return clamped
}
