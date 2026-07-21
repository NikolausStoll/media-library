/**
 * Layout breakpoints (viewport width).
 *
 * Keep CSS `@media` values in sync with these constants:
 * - max-width: MOBILE_MAX_WIDTH          → mobile chrome / 1-col list / 2-col grid
 * - max-width: SIDEBAR_OVERLAY_MAX_WIDTH → overlay sidebar / list 2-col / no 6–9 grid
 * - max-width: (DENSE_GRID_MIN_WIDTH-1)  → no 9-col dense
 *
 * See AGENTS.md → "Layout Breakpoints".
 */

/** ≤ this: bottom nav, swipe tabs, 1-col list, 2-col grid, hide density toggles */
export const MOBILE_MAX_WIDTH = 768

/**
 * ≤ this: sidebar overlays the content (no margin push).
 * Also: list uses 2 columns; grid density capped to 3 cols.
 */
export const SIDEBAR_OVERLAY_MAX_WIDTH = 1079

/** ≥ this: 6-col compact grid is allowed */
export const COMPACT_GRID_MIN_WIDTH = 1080

/** ≥ this: 9-col dense grid is allowed */
export const DENSE_GRID_MIN_WIDTH = 1400

/** ≥ this: list view uses 3 columns (below: 2, mobile: 1) */
export const LIST_THREE_COL_MIN_WIDTH = 1080

export function currentViewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : COMPACT_GRID_MIN_WIDTH
}

export function isMobileLayout(width = currentViewportWidth()) {
  return width <= MOBILE_MAX_WIDTH
}

export function isSidebarOverlayLayout(width = currentViewportWidth()) {
  return width <= SIDEBAR_OVERLAY_MAX_WIDTH
}

export function allowsCompactGrid(width = currentViewportWidth()) {
  return width >= COMPACT_GRID_MIN_WIDTH
}

export function allowsDenseGrid(width = currentViewportWidth()) {
  return width >= DENSE_GRID_MIN_WIDTH
}
