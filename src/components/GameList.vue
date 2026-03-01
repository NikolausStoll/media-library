<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import draggable from 'vuedraggable'

defineProps({ mediaType: { type: String, default: 'game' } })
const emit = defineEmits(['switch-media'])
import { storefronts, availablePlatforms } from '../data/games.js'
import { getPlatformLogo } from '../data/platformLogos.js'
import {
  loadGames,
  addGame,
  updateGame,
  updateGamePlatforms,
  deleteGame,
  loadSortOrder,
  saveSortOrder,
  loadNext,
  saveNext,
  removeFromNext,
  updateGameTags,
} from '../services/gameStorage.js'

import GameCard from './games/GameCard.vue'
import StatusOverlay from './games/StatusOverlay.vue'
import GameSearchOverlay from './games/GameSearchOverlay.vue'
import GameFilters from './games/GameFilters.vue'

const API_BASE = '/api'

// ─── State ────────────────────────────────────────────────────────────────────

const gameList       = ref([])
const startedOrder   = ref([])
const playNextList   = ref([])
const drag           = ref(false)
const activeTab      = ref('started')
const loading        = ref(true)

// Add Game
const newExternalId  = ref('')
const addLoading     = ref(false)
const addError       = ref('')
const addSuccess     = ref(false)

// UI
const sidebarOpen        = ref(true)
const darkMode = ref(localStorage.getItem('darkMode') !== 'false')
const filterSectionsOpen = ref({ platformStorefront: true, sort: true })

// Overlays
const overlayGame        = ref(null)
const showOverlay        = ref(false)
const deleteConfirm      = ref(false)
const platformEditor     = ref(null)
const showPlatformEditor = ref(false)
const showSearchOverlay  = ref(false)
const overlaySearchQuery = ref('')

// Filter & Sort
const searchQuery      = ref('')
const platformFilter   = ref([])
const storefrontFilter = ref([])
const sortBy           = ref('custom')
const sortDirection    = ref('asc')

// HLTB Search
const hltbResults  = ref([])
const hltbLoading  = ref(false)
const hltbError    = ref('')
const hltbSearched = ref(false)

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },  
  { id: 'started',   label: 'Started'   },
  { id: 'completed', label: 'Completed' },
  { id: 'dropped',   label: 'Dropped'   },
  { id: 'all',       label: 'All'       },
]

const statusOptions = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },  
  { id: 'started',   label: 'Started'   },
  { id: 'shelved',   label: 'Shelved'   },
  { id: 'completed', label: 'Completed' },
  { id: 'dropped',   label: 'Dropped'   },
]

const viewMode = ref(localStorage.getItem('viewMode') || 'grid')
const gridDensity = ref(localStorage.getItem('gridDensity') || 'normal')

const tagFilter = ref([])

// Watches zum Speichern
watch(viewMode, val => localStorage.setItem('viewMode', val))
watch(gridDensity, val => localStorage.setItem('gridDensity', val))
watch(darkMode, val => localStorage.setItem('darkMode', val))

watch(activeTab, newTab => {
  if (newTab === 'started') {
    sortBy.value = 'custom'
  } else {
    sortBy.value = 'name'
    sortDirection.value = 'asc'
  }
})

watch(showOverlay, val => {
  if (!val) deleteConfirm.value = false
})

watch(overlaySearchQuery, () => {
  hltbResults.value  = []
  hltbSearched.value = false
  hltbError.value    = ''
})

const isTouchDevice =
  typeof window !== 'undefined' &&
  ('ontouchstart' in window || (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0))
const TOUCH_HOLD_DURATION = 350
const TOUCH_MOVE_THRESHOLD = 10
const allowMobileDrag = ref(!isTouchDevice)
const touchStartPos = ref({ x: 0, y: 0 })
let touchHoldTimer = null

function clearTouchHold() {
  if (touchHoldTimer) {
    clearTimeout(touchHoldTimer)
    touchHoldTimer = null
  }
}

function handleTouchStart(event) {
  if (!isTouchDevice || sortBy.value !== 'custom') return
  const touch = event.touches[0]
  touchStartPos.value = { x: touch.clientX, y: touch.clientY }
  allowMobileDrag.value = false
  clearTouchHold()
  touchHoldTimer = window.setTimeout(() => {
    allowMobileDrag.value = true
    touchHoldTimer = null
  }, TOUCH_HOLD_DURATION)
}

function handleTouchMove(event) {
  if (!touchHoldTimer) return
  const touch = event.touches[0]
  const dx = Math.abs(touch.clientX - touchStartPos.value.x)
  const dy = Math.abs(touch.clientY - touchStartPos.value.y)
  if (dx > TOUCH_MOVE_THRESHOLD || dy > TOUCH_MOVE_THRESHOLD) {
    clearTouchHold()
  }
}

function handleTouchEnd() {
  clearTouchHold()
  allowMobileDrag.value = false
}

function handleDragStart(event) {
  if (isTouchDevice && !allowMobileDrag.value) {
    event?.cancel?.()
    return
  }
  drag.value = true
}

async function handleDragEnd() {
  drag.value = false
  if (isTouchDevice) {
    allowMobileDrag.value = false
    clearTouchHold()
  }
  await onDragEnd()
}

// ─── Add Game ─────────────────────────────────────────────────────────────────

async function handleAddGame() {
  const id = newExternalId.value.trim()
  if (!id) { addError.value = 'Please enter an external ID.'; return; }

  addError.value = ''; addSuccess.value = false; addLoading.value = true

  try {
    const newGame = await addGame(id, activeTab.value, [])
    gameList.value.push(newGame)
    newExternalId.value = ''
    addSuccess.value = true
    setTimeout(() => (addSuccess.value = false), 2500)
  } catch (err) {
    addError.value = err.message
  } finally {
    addLoading.value = false
  }
}

function onAddKeydown(e) {
  if (e.key === 'Enter') handleAddGame()
}

// ─── Logo / Label Helper ──────────────────────────────────────────────────────

function resolveLogo(plat) {
  return getPlatformLogo(plat.platform, plat.storefront)
}

function getPlatformLabel(plat) {
  if (plat.storefront)
    return storefronts.find(s => s.id === plat.storefront)?.label ?? plat.storefront
  return availablePlatforms.find(p => p.id === plat.platform)?.label ?? plat.platform
}

// ─── Rating / Time Format ─────────────────────────────────────────────────────

function formatRating(rating) {
  const val = rating % 1 === 0 ? Math.floor(rating) : rating
  return `${val} %`
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const startedGames = computed(() => {
  const games = gameList.value.filter(g => g.status === 'started')
  if (!startedOrder.value.length) return games
  const map = new Map(games.map(g => [String(g.id), g]))
  const ordered = startedOrder.value.map(id => map.get(String(id))).filter(Boolean)
  const seen = new Set(startedOrder.value.map(String))
  games.filter(g => !seen.has(String(g.id))).forEach(g => ordered.push(g))
  return ordered
})

const shelvedGames = computed(() => {
  let base = gameList.value.filter(g => g.status === 'shelved')

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)))

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0)
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)))

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)))

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value))

  return applySort(base)
})

const playNextGames = computed(() => {
  let base = playNextList.value
    .map(id => gameList.value.find(g => String(g.id) === String(id)))
    .filter(g => g && g.status === 'backlog')

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)))

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0)
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)))

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)))

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value))

  return applySort(base)
})

const normalBacklogGames = computed(() =>
  gameList.value.filter(
    g => g.status === 'backlog' && !playNextList.value.includes(String(g.id)),
  ),
)

function fuzzyMatch(str, query) {
  const s = str.toLowerCase()
  const q = query.toLowerCase().trim()
  if (!q) return true
  let si = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = s.indexOf(q[qi], si)
    if (found === -1) return false
    si = found + 1
  }
  return true
}

function applySort(list) {
  const dir = sortDirection.value === 'asc' ? 1 : -1

  if (sortBy.value === 'name')
    return [...list].sort((a, b) => a.name.localeCompare(b.name) * dir)

  if (sortBy.value === 'rating')
    return [...list].sort((a, b) => {
      if (a.rating == null && b.rating == null) return 0
      if (a.rating == null) return 1
      if (b.rating == null) return -1
      return (a.rating - b.rating) * dir
    })

  if (sortBy.value === 'playtime')
    return [...list].sort((a, b) => {
      if (a.gameplayAll == null && b.gameplayAll == null) return 0
      if (a.gameplayAll == null) return 1
      if (b.gameplayAll == null) return -1
      return (a.gameplayAll - b.gameplayAll) * dir
    })

  return list
}

const filteredGames = computed(() => {
  let base =
    activeTab.value === 'all'     ? gameList.value.filter(g => g.status !== 'wishlist') :
    activeTab.value === 'started' ? startedGames.value :
    activeTab.value === 'backlog' ? normalBacklogGames.value :
    gameList.value.filter(g => g.status === activeTab.value)

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)))

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0)
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)))

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)))

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value))

  if (sortBy.value === 'custom') return base
  return applySort(base)
})

const filteredIds = computed(() => new Set(filteredGames.value.map(g => String(g.id))))

const statusCounts = computed(() => {
  const c = {}
  tabs.forEach(t => { c[t.id] = gameList.value.filter(g => g.status === t.id).length; })
  c['started'] += gameList.value.filter(g => g.status === 'shelved').length
  c['all'] = gameList.value.filter(g => g.status !== 'wishlist').length
  return c
})


async function toggleTag(tag) {
  if (!overlayGame.value) return
  const game = overlayGame.value
  const current = game.tags ?? []
  const updated = current.includes(tag)
    ? current.filter(t => t !== tag)
    : [...current, tag]

  game.tags = updated
  await updateGameTags(game.id, updated)
}


// ─── Sort ─────────────────────────────────────────────────────────────────────

function toggleNameSort() {
  if (sortBy.value !== 'name') {
    sortBy.value = 'name'
    sortDirection.value = 'asc'
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
}

function toggleRatingSort() {
  if (sortBy.value !== 'rating') {
    sortBy.value = 'rating'
    sortDirection.value = 'desc'
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
}

function togglePlaytimeSort() {
  if (sortBy.value !== 'playtime') {
    sortBy.value = 'playtime'
    sortDirection.value = 'asc'
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  }
}

async function onDragEnd() {
  drag.value = false
  if (activeTab.value === 'started') {
    const ids = startedGames.value.map(g => String(g.id))
    startedOrder.value = ids
    await saveSortOrder(ids)
  }
}

// ─── Overlay / Status ─────────────────────────────────────────────────────────

function openOverlay(game, event) {
  event?.stopPropagation()
  overlayGame.value = game
  showOverlay.value = true
}

async function changeStatus(newStatus) {
  if (!overlayGame.value) return
  const game = overlayGame.value
  const gameId = String(game.id)
  const wasInPlayNext = playNextList.value.includes(gameId)
  const wasStarted = game.status === 'started'

  game.status = newStatus
  showOverlay.value = false
  overlayGame.value = null

  if (wasInPlayNext && newStatus !== 'backlog') {
    playNextList.value = playNextList.value.filter(id => String(id) !== gameId)
    await removeFromNext(game.id)
  }

  if (wasStarted && newStatus !== 'started') {
    startedOrder.value = startedOrder.value.filter(id => String(id) !== gameId)
    await saveSortOrder(startedOrder.value)
  }

  await updateGame(game.id, { status: newStatus })
}

async function handleDeleteGame() {
  if (!overlayGame.value) return
  const game = overlayGame.value
  const gameId = String(game.id)
  const wasInPlayNext = playNextList.value.includes(gameId)

  showOverlay.value = false
  overlayGame.value = null
  gameList.value = gameList.value.filter(g => String(g.id) !== gameId)

  if (wasInPlayNext) {
    playNextList.value = playNextList.value.filter(id => String(id) !== gameId)
    await removeFromNext(game.id)
  }

  await deleteGame(game.id)
}

async function clearGameCache(game) {
  try {
    const res = await fetch(`${API_BASE}/hltb/cache/${game.externalId}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`clearCache failed: ${res.status}`)
  } catch (err) {
    console.error('clearGameCache:', err)
  }
}

// ─── Platform Editor ──────────────────────────────────────────────────────────

function openPlatformEditor(game, event) {
  event?.stopPropagation()
  platformEditor.value = { ...game, platforms: game.platforms.map(p => ({ ...p })) }
  showPlatformEditor.value = true
}

async function savePlatformEditor() {
  if (!platformEditor.value) return
  const game = gameList.value.find(g => String(g.id) === String(platformEditor.value.id))
  if (game) game.platforms = platformEditor.value.platforms
  await updateGamePlatforms(platformEditor.value.id, platformEditor.value.platforms)
  showPlatformEditor.value = false
  platformEditor.value = null
}

function removePlatform(index) {
  if (platformEditor.value.platforms.length > 1)
    platformEditor.value.platforms.splice(index, 1)
}

function addPlatform(platformId) {
  if (!platformId) return
  const plat = { platform: platformId }
  if (platformId === 'pc') plat.storefront = 'steam'
  platformEditor.value.platforms.push(plat)
}

function changeStorefront(plat, storefrontId) { plat.storefront = storefrontId; }

function changePlatform(index, newPlatformId) {
  const plat = { platform: newPlatformId }
  if (newPlatformId === 'pc') plat.storefront = 'steam'
  platformEditor.value.platforms[index] = plat
}

// ─── Play Next ────────────────────────────────────────────────────────────────

async function addToPlayNext(game) {
  const gameId = String(game.id)
  if (playNextList.value.length >= 6 || playNextList.value.includes(gameId)) return

  playNextList.value = [...playNextList.value, gameId]

  try {
    await saveNext(playNextList.value)
  } catch (err) {
    playNextList.value = playNextList.value.filter(id => id !== gameId)
    console.error('addToPlayNext failed:', err)
  }
}

async function removeFromPlayNext(gameId) {
  const id = String(gameId)
  playNextList.value = playNextList.value.filter(i => String(i) !== id)
  await removeFromNext(gameId)
}

// ─── Search Overlay ───────────────────────────────────────────────────────────

function openSearchOverlay() {
  overlaySearchQuery.value = searchQuery.value
  showSearchOverlay.value = true
  nextTick(() => {
    if (overlaySearchQuery.value.trim()) searchHltb()
  })
}

function closeSearchOverlay() {
  showSearchOverlay.value = false
  overlaySearchQuery.value = ''
  hltbResults.value  = []
  hltbSearched.value = false
  hltbError.value    = ''
}

async function searchHltb() {
  const q = overlaySearchQuery.value.trim()
  if (q.length < 3) return
  hltbLoading.value  = true
  hltbError.value    = ''
  hltbSearched.value = true
  try {
    const res = await fetch(`${API_BASE}/hltb/search?q=${encodeURIComponent(q)}`)
    if (!res.ok) throw new Error(`Error ${res.status}`)
    const data = await res.json()
    const existingIds = new Set(gameList.value.map(g => String(g.externalId)))
    hltbResults.value = data.filter(r => !existingIds.has(String(r.id)))
  } catch (err) {
    hltbError.value = err.message
  } finally {
    hltbLoading.value = false
  }
}

async function handleAddFromSearch(result, status) {
  try {
    const newGame = await addGame(result.id, status || activeTab.value, [])
    gameList.value.push(newGame)
    hltbResults.value = hltbResults.value.filter(r => String(r.id) !== String(result.id))
  } catch (err) {
    hltbError.value = err.message
  }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function toggleFilter(arr, val) {
  const i = arr.indexOf(val)
  if (i > -1) arr.splice(i, 1); else arr.push(val)
}

function toggleFilterSection(s) {
  filterSectionsOpen.value[s] = !filterSectionsOpen.value[s]
}

// ─── Dark Mode ────────────────────────────────────────────────────────────────

function toggleDarkMode() {
  darkMode.value = !darkMode.value
  document.body.classList.toggle('light-mode', !darkMode.value)
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    if (showSearchOverlay.value)       closeSearchOverlay()
    else if (showOverlay.value)        showOverlay.value = false
    else if (showPlatformEditor.value) showPlatformEditor.value = false
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown)
  document.body.classList.toggle('light-mode', !darkMode.value)
  loading.value = true
  const [games, sortOrder, playNext] = await Promise.all([
    loadGames(), loadSortOrder(), loadNext(),
  ])
  gameList.value     = games
  startedOrder.value = sortOrder
  playNextList.value = playNext
  loading.value      = false
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown)
  clearTouchHold()
})
</script>

<template>
  <div :class="['app-layout', { 'light-mode': !darkMode }]">
    <div :class="['main-content', { 'sidebar-closed': !sidebarOpen }]">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list', 'grid-compact': viewMode === 'grid' && gridDensity === 'compact' }">

        <!-- Loading -->
        <div v-if="loading" class="empty-state">Loading...</div>

        <template v-else>
          <!-- Tabs -->
          <div class="tabs">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              :class="['tab', { active: activeTab === tab.id }]"
              @click="activeTab = tab.id"
            >
              {{ tab.label }}
              <span class="tab-count">{{ statusCounts[tab.id] }}</span>
            </button>
          </div>

          <!-- Play Next (Backlog only) -->
          <div v-if="activeTab === 'backlog' && playNextGames.length > 0" class="play-next-section">
            <div class="section-label">PLAY NEXT</div>
            <div class="game-grid play-next-grid">
              <div
                v-for="game in playNextGames"
                :key="game.id"
                class="game-card"
                @click="openOverlay(game, $event)"
              >
                <div class="card-cover-wrap">
                  <img :src="game.imageUrl" :alt="game.name" class="card-cover" />
                  <button class="card-pn-btn pn-remove-btn" @click.stop="removeFromPlayNext(game.id)" title="Remove from Play Next">✕</button>
                  <img v-if="game.tags?.includes('100%')" src="/tags/100percent.png" class="card-tag-overlay" />
                </div>
                <!-- Play-Next-Karten nutzen noch direkt den Inline-Content,
                     da sie den pn-remove-btn statt den add-btn brauchen -->
                <div class="card-info">
                  <p class="card-title">{{ game.name }}</p>
                  <div class="card-row">
                    <div class="card-platform" @click.stop="openPlatformEditor(game, $event)">
                      <button v-if="game.platforms.length === 0" class="add-first-platform-btn">+</button>
                      <template v-else>
                        <span class="platform-primary">
                          <img :src="resolveLogo(game.platforms[0])" class="platform-logo-sm" :title="getPlatformLabel(game.platforms[0])" />
                          <span class="platform-text">{{ getPlatformLabel(game.platforms[0]) }}</span>
                        </span>
                        <img v-for="(plat, idx) in game.platforms.slice(1)" :key="idx" :src="resolveLogo(plat)" class="platform-logo-sm" :title="getPlatformLabel(plat)" />
                      </template>
                    </div>
                    <div v-if="game.gameplayAll != null" class="card-time-wrap" @click.stop>
                      <span class="card-time">{{ game.gameplayAll }} h</span>
                    </div>
                  </div>
                  <div class="card-row" v-if="game.rating != null || game.dlcs?.length || game.tags?.length">
                    <span v-if="game.rating != null" class="card-rating">{{ formatRating(game.rating) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Separator -->
          <div v-if="activeTab === 'backlog' && playNextGames.length > 0" class="list-separator"></div>

          <!-- Main List -->
          <draggable
            :list="sortBy === 'custom' ? gameList : filteredGames"
            class="game-grid"
            item-key="id"
            :disabled="sortBy !== 'custom' || (isTouchDevice && !allowMobileDrag)"
            @start="handleDragStart"
            @end="handleDragEnd"
            @touchstart="handleTouchStart"
            @touchmove.passive="handleTouchMove"
            @touchend="handleTouchEnd"
            @touchcancel="handleTouchEnd"
          >
            <template #item="{ element }">
              <div v-show="filteredIds.has(String(element.id))">
                <GameCard
                  :game="element"
                  :activeTab="activeTab"
                  :playNextList="playNextList"
                  :formatRating="formatRating"
                  :resolveLogo="resolveLogo"
                  :getPlatformLabel="getPlatformLabel"
                  :viewMode="viewMode"
                  @open-overlay="(game, e) => openOverlay(game, e)"
                  @open-platform-editor="(game, e) => openPlatformEditor(game, e)"
                  @add-to-play-next="addToPlayNext(element)"
                />
              </div>
            </template>
          </draggable>

          <!-- Shelved Section -->
          <template v-if="activeTab === 'started' && shelvedGames.length > 0">
            <div class="list-separator"></div>
            <div class="section-label">SHELVED</div>
            <div class="game-grid">
              <GameCard
                v-for="game in shelvedGames"
                :key="game.id"
                :game="game"
                :activeTab="activeTab"
                :playNextList="playNextList"
                :formatRating="formatRating"
                :resolveLogo="resolveLogo"
                :getPlatformLabel="getPlatformLabel"
                @open-overlay="(game, e) => openOverlay(game, e)"
                @open-platform-editor="(game, e) => openPlatformEditor(game, e)"
              />
            </div>
          </template>

          <p v-if="filteredGames.length === 0 && (activeTab !== 'backlog' || playNextGames.length === 0)" class="empty-state">No games found</p>
        </template>
      </div>
    </div>

    <!-- Sidebar Toggle -->
    <button
      :class="['sidebar-toggle-external', { 'sidebar-closed': !sidebarOpen }]"
      @click="sidebarOpen = !sidebarOpen"
    >{{ sidebarOpen ? '›' : '‹' }}</button>

    <!-- Sidebar -->
    <aside :class="['sidebar', { collapsed: !sidebarOpen }]">
      <div v-show="sidebarOpen">
        <GameFilters
          :mediaType="mediaType"
          :activeTab="activeTab"
          :sortBy="sortBy"
          :sortDirection="sortDirection"
          :platformFilter="platformFilter"
          :storefrontFilter="storefrontFilter"
          :tagFilter="tagFilter"
          :availablePlatforms="availablePlatforms"
          :storefronts="storefronts"
          :filterSectionsOpen="filterSectionsOpen"
          :viewMode="viewMode"
          :gridDensity="gridDensity"
          :darkMode="darkMode"
          :searchQuery="searchQuery"
          @switch-media="(value) => emit('switch-media', value)"
          @open-search-overlay="openSearchOverlay"
          @update:searchQuery="searchQuery = $event"
          @toggle-filter="(type, val) => toggleFilter(type === 'platform' ? platformFilter : type === 'storefront' ? storefrontFilter : tagFilter, val)"
          @toggle-filter-section="(sec) => filterSectionsOpen[sec] = !filterSectionsOpen[sec]"
          @sort-name="toggleNameSort"
          @sort-rating="toggleRatingSort"
          @sort-playtime="togglePlaytimeSort"
          @set-sort-custom="sortBy = 'custom'"
          @set-view-mode="(m) => viewMode = m"
          @set-grid-density="(d) => gridDensity = d"
          @toggle-dark-mode="toggleDarkMode"
        />
      </div>
      <!-- Add Game (versteckt – für API-Tests und Legacy-Fallback) -->
      <div class="add-game-section" v-show="false">
        <div class="sidebar-section-label">ADD GAME</div>
        <p class="add-game-hint">
          Status: <strong>{{ tabs.find(t => t.id === activeTab)?.label }}</strong>
        </p>
        <div class="add-game-row">
          <input
            v-model="newExternalId"
            type="text"
            placeholder="HLTB ID"
            class="add-game-input"
            :disabled="addLoading"
            @keydown="onAddKeydown"
          />
          <button
            class="add-game-btn"
            :disabled="addLoading || !newExternalId.trim()"
            @click="handleAddGame"
          >
            {{ addLoading ? '...' : 'ADD' }}
          </button>
        </div>
        <p v-if="addError" class="add-game-error">{{ addError }}</p>
        <p v-if="addSuccess" class="add-game-success">Game added</p>
      </div>
    </aside>

    <!-- Status Overlay -->
    <StatusOverlay
      v-if="showOverlay"
      :game="overlayGame"
      :statusOptions="statusOptions"
      :deleteConfirm="deleteConfirm"
      :inPlayNext="overlayGame ? playNextList.includes(String(overlayGame.id)) : false"
      :playNextAtLimit="overlayGame ? (!playNextList.includes(String(overlayGame.id)) && playNextList.length >= 6) : false"
      @close="showOverlay = false"
      @change-status="changeStatus"
      @toggle-tag="toggleTag"
      @toggle-play-next="overlayGame && (playNextList.includes(String(overlayGame.id)) ? removeFromPlayNext(overlayGame.id) : addToPlayNext(overlayGame))"
      @clear-cache="clearGameCache"
      @delete-trigger="deleteConfirm = true"
      @delete-confirm="handleDeleteGame"
      @delete-cancel="deleteConfirm = false"
    />

    <!-- Platform Editor Overlay -->
    <!-- (bleibt vorerst inline in GameList.vue – eigene Komponente in Phase 2) -->
    <div v-if="showPlatformEditor" class="overlay" @click="showPlatformEditor = false">
      <div class="editor-content" @click.stop>
        <div class="overlay-title">{{ platformEditor?.name }}</div>
        <div class="overlay-subtitle">Manage Platforms</div>

        <div class="platform-editor">
          <div
            v-for="(plat, index) in platformEditor?.platforms"
            :key="index"
            class="platform-editor-item"
          >
            <select
              :value="plat.platform"
              @change="changePlatform(index, $event.target.value)"
              class="platform-select"
            >
              <option v-for="p in availablePlatforms" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
            <select
              v-if="plat.platform === 'pc'"
              :value="plat.storefront"
              @change="changeStorefront(plat, $event.target.value)"
              class="storefront-select"
            >
              <option v-for="s in storefronts" :key="s.id" :value="s.id">{{ s.label }}</option>
            </select>
            <button
              v-if="platformEditor.platforms.length > 1"
              class="remove-btn"
              @click="removePlatform(index)"
            >✕</button>
          </div>
          <div class="add-platform-section">
            <select
              @change="addPlatform($event.target.value); $event.target.value = ''"
              class="add-platform-select"
            >
              <option value="">+ Add platform</option>
              <option v-for="p in availablePlatforms" :key="p.id" :value="p.id">{{ p.label }}</option>
            </select>
          </div>
        </div>

        <button class="close-btn" @click="savePlatformEditor">Done</button>
      </div>
    </div>

    <!-- Search Overlay -->
    <GameSearchOverlay
      v-if="showSearchOverlay"
      :searchQuery="overlaySearchQuery"
      :results="hltbResults"
      :loading="addLoading"
      :tabs="tabs"
      :statusOptions="statusOptions"
      :activeTab="activeTab"
      @update:searchQuery="overlaySearchQuery = $event"
      @search="searchHltb"
      @add="({ result, status }) => handleAddFromSearch(result, status)"
      @close="closeSearchOverlay"
    />
  </div>
</template>
