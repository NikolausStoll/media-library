<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import draggable from 'vuedraggable';
import { storefronts, availablePlatforms } from '../data/games.js';
import { getPlatformLogo } from '../data/platformLogos.js';
import {
  loadGames,
  addGame,
  updateGame,
  updateGamePlatforms,
  deleteGame,
  loadSortOrder,
  saveSortOrder,
  loadPlayNext,
  savePlayNext,
  removeFromPlayNextApi,
  updateGameTags,
} from '../services/gameStorage.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────

const gameList       = ref([]);
const startedOrder   = ref([]);
const playNextList   = ref([]);
const drag           = ref(false);
const activeTab      = ref('started');
const loading        = ref(true);

// Add Game
const newExternalId  = ref('');
const addLoading     = ref(false);
const addError       = ref('');
const addSuccess     = ref(false);

// UI
const sidebarOpen        = ref(true);
const darkMode = ref(localStorage.getItem('darkMode') !== 'false');
const filterSectionsOpen = ref({ platformStorefront: true, sort: true });

// Overlays
const overlayGame        = ref(null);
const showOverlay        = ref(false);
const deleteConfirm      = ref(false);
const platformEditor     = ref(null);
const showPlatformEditor = ref(false);
const showSearchOverlay  = ref(false);
const overlaySearchQuery = ref('');

// Filter & Sort
const searchQuery      = ref('');
const platformFilter   = ref([]);
const storefrontFilter = ref([]);
const sortBy           = ref('custom');
const sortDirection    = ref('asc');

// HLTB Search
const hltbResults  = ref([]);
const hltbLoading  = ref(false);
const hltbError    = ref('');
const hltbSearched = ref(false);

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const tabs = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },  
  { id: 'started',   label: 'Started'   },
  { id: 'completed', label: 'Completed' },
  { id: 'retired',   label: 'Retired'   },
  { id: 'all',       label: 'All'       },
];

const statusOptions = [
  { id: 'wishlist',  label: 'Wishlist'  },
  { id: 'backlog',   label: 'Backlog'   },  
  { id: 'started',   label: 'Started'   },
  { id: 'shelved',   label: 'Shelved'   },
  { id: 'completed', label: 'Completed' },
  { id: 'retired',   label: 'Retired'   },
];

const viewMode = ref(localStorage.getItem('viewMode') || 'grid');

const tagFilter = ref([]);

// Watches zum Speichern
watch(viewMode, val => localStorage.setItem('viewMode', val));
watch(darkMode, val => localStorage.setItem('darkMode', val));

watch(activeTab, newTab => {
  if (newTab === 'started') {
    sortBy.value = 'custom';
  } else {
    sortBy.value = 'name';
    sortDirection.value = 'asc';
  }
});

watch(showOverlay, val => {
  if (!val) deleteConfirm.value = false;
});

watch(overlaySearchQuery, () => {
  hltbResults.value  = [];
  hltbSearched.value = false;
  hltbError.value    = '';
});

// ─── Add Game ─────────────────────────────────────────────────────────────────

async function handleAddGame() {
  const id = newExternalId.value.trim();
  if (!id) { addError.value = 'Please enter an external ID.'; return; }

  addError.value = ''; addSuccess.value = false; addLoading.value = true;

  try {
    const newGame = await addGame(id, activeTab.value, []);
    gameList.value.push(newGame);
    newExternalId.value = '';
    addSuccess.value = true;
    setTimeout(() => (addSuccess.value = false), 2500);
  } catch (err) {
    addError.value = err.message;
  } finally {
    addLoading.value = false;
  }
}

function onAddKeydown(e) {
  if (e.key === 'Enter') handleAddGame();
}

// ─── Logo / Label Helper ──────────────────────────────────────────────────────

function resolveLogo(plat) {
  return getPlatformLogo(plat.platform, plat.storefront);
}

function getPlatformLabel(plat) {
  if (plat.storefront)
    return storefronts.find(s => s.id === plat.storefront)?.label ?? plat.storefront;
  return availablePlatforms.find(p => p.id === plat.platform)?.label ?? plat.platform;
}

// ─── Rating / Time Format ─────────────────────────────────────────────────────

function formatRating(rating) {
  const val = rating % 1 === 0 ? Math.floor(rating) : rating;
  return `${val} %`;
}

// ─── Computed ─────────────────────────────────────────────────────────────────

const startedGames = computed(() => {
  const games = gameList.value.filter(g => g.status === 'started');
  if (!startedOrder.value.length) return games;
  const map = new Map(games.map(g => [String(g.id), g]));
  const ordered = startedOrder.value.map(id => map.get(String(id))).filter(Boolean);
  const seen = new Set(startedOrder.value.map(String));
  games.filter(g => !seen.has(String(g.id))).forEach(g => ordered.push(g));
  return ordered;
});

const shelvedGames = computed(() => {
  let base = gameList.value.filter(g => g.status === 'shelved');

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)));

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0);
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)));

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)));

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value));

  return applySort(base);
});

const playNextGames = computed(() => {
  let base = playNextList.value
    .map(id => gameList.value.find(g => String(g.id) === String(id)))
    .filter(g => g && g.status === 'backlog');

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)));

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0);
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)));

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)));

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value));

  return applySort(base);
});

const normalBacklogGames = computed(() =>
  gameList.value.filter(
    g => g.status === 'backlog' && !playNextList.value.includes(String(g.id)),
  ),
);

function fuzzyMatch(str, query) {
  const s = str.toLowerCase();
  const q = query.toLowerCase().trim();
  if (!q) return true;
  let si = 0;
  for (let qi = 0; qi < q.length; qi++) {
    const found = s.indexOf(q[qi], si);
    if (found === -1) return false;
    si = found + 1;
  }
  return true;
}

function applySort(list) {
  const dir = sortDirection.value === 'asc' ? 1 : -1;

  if (sortBy.value === 'name')
    return [...list].sort((a, b) => a.name.localeCompare(b.name) * dir);

  if (sortBy.value === 'rating')
    return [...list].sort((a, b) => {
      if (a.rating == null && b.rating == null) return 0;
      if (a.rating == null) return 1;
      if (b.rating == null) return -1;
      return (a.rating - b.rating) * dir;
    });

  if (sortBy.value === 'playtime')
    return [...list].sort((a, b) => {
      if (a.gameplayAll == null && b.gameplayAll == null) return 0;
      if (a.gameplayAll == null) return 1;
      if (b.gameplayAll == null) return -1;
      return (a.gameplayAll - b.gameplayAll) * dir;
    });

  return list;
}

const filteredGames = computed(() => {
  let base =
    activeTab.value === 'all'     ? gameList.value.filter(g => g.status !== 'wishlist') :
    activeTab.value === 'started' ? startedGames.value :
    activeTab.value === 'backlog' ? normalBacklogGames.value :
    gameList.value.filter(g => g.status === activeTab.value);

  if (tagFilter.value.length)
    base = base.filter(g => tagFilter.value.every(t => g.tags?.includes(t)));

  if (platformFilter.value.includes('none'))
    base = base.filter(g => g.platforms.length === 0);
  else if (platformFilter.value.length)
    base = base.filter(g => g.platforms.some(p => platformFilter.value.includes(p.platform)));

  if (storefrontFilter.value.length)
    base = base.filter(g => g.platforms.some(p => p.storefront && storefrontFilter.value.includes(p.storefront)));

  if (searchQuery.value.trim())
    base = base.filter(g => fuzzyMatch(g.name, searchQuery.value));

  if (sortBy.value === 'custom') return base;
  return applySort(base);
});

const filteredIds = computed(() => new Set(filteredGames.value.map(g => String(g.id))));

const statusCounts = computed(() => {
  const c = {};
  tabs.forEach(t => { c[t.id] = gameList.value.filter(g => g.status === t.id).length; });
  c['started'] += gameList.value.filter(g => g.status === 'shelved').length;
  c['all'] = gameList.value.filter(g => g.status !== 'wishlist').length;
  return c;
});


async function toggleTag(tag) {
  if (!overlayGame.value) return;
  const game = overlayGame.value;
  const current = game.tags ?? [];
  const updated = current.includes(tag)
    ? current.filter(t => t !== tag)
    : [...current, tag];

  game.tags = updated;
  await updateGameTags(game.id, updated);
}


// ─── Sort ─────────────────────────────────────────────────────────────────────

function toggleNameSort() {
  if (sortBy.value !== 'name') {
    sortBy.value = 'name';
    sortDirection.value = 'asc';
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  }
}

function toggleRatingSort() {
  if (sortBy.value !== 'rating') {
    sortBy.value = 'rating';
    sortDirection.value = 'desc';
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  }
}

function togglePlaytimeSort() {
  if (sortBy.value !== 'playtime') {
    sortBy.value = 'playtime';
    sortDirection.value = 'asc';
  } else {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc';
  }
}

async function onDragEnd() {
  drag.value = false;
  if (activeTab.value === 'started') {
    const ids = startedGames.value.map(g => String(g.id));
    startedOrder.value = ids;
    await saveSortOrder(ids);
  }
}

// ─── Overlay / Status ─────────────────────────────────────────────────────────

function openOverlay(game, event) {
  event.stopPropagation();
  overlayGame.value = game;
  showOverlay.value = true;
}

async function changeStatus(newStatus) {
  if (!overlayGame.value) return;
  const game = overlayGame.value;
  const gameId = String(game.id);
  const wasInPlayNext = playNextList.value.includes(gameId);
  const wasStarted = game.status === 'started';

  game.status = newStatus;
  showOverlay.value = false;
  overlayGame.value = null;

  if (wasInPlayNext && newStatus !== 'backlog') {
    playNextList.value = playNextList.value.filter(id => String(id) !== gameId);
    await removeFromPlayNextApi(game.id);
  }

  if (wasStarted && newStatus !== 'started') {
    startedOrder.value = startedOrder.value.filter(id => String(id) !== gameId);
    await saveSortOrder(startedOrder.value);
  }

  await updateGame(game.id, { status: newStatus });
}

async function handleDeleteGame() {
  if (!overlayGame.value) return;
  const game = overlayGame.value;
  const gameId = String(game.id);
  const wasInPlayNext = playNextList.value.includes(gameId);

  showOverlay.value = false;
  overlayGame.value = null;
  gameList.value = gameList.value.filter(g => String(g.id) !== gameId);

  if (wasInPlayNext) {
    playNextList.value = playNextList.value.filter(id => String(id) !== gameId);
    await removeFromPlayNextApi(game.id);
  }

  await deleteGame(game.id);
}

async function clearGameCache(game) {
  try {
    const res = await fetch(`${API_BASE}/hltb/cache/${game.externalId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`clearCache failed: ${res.status}`);
  } catch (err) {
    console.error('clearGameCache:', err);
  }
}

// ─── Platform Editor ──────────────────────────────────────────────────────────

function openPlatformEditor(game, event) {
  event.stopPropagation();
  platformEditor.value = { ...game, platforms: game.platforms.map(p => ({ ...p })) };
  showPlatformEditor.value = true;
}

async function savePlatformEditor() {
  if (!platformEditor.value) return;
  const game = gameList.value.find(g => String(g.id) === String(platformEditor.value.id));
  if (game) game.platforms = platformEditor.value.platforms;
  await updateGamePlatforms(platformEditor.value.id, platformEditor.value.platforms);
  showPlatformEditor.value = false;
  platformEditor.value = null;
}

function removePlatform(index) {
  if (platformEditor.value.platforms.length > 1)
    platformEditor.value.platforms.splice(index, 1);
}

function addPlatform(platformId) {
  if (!platformId) return;
  const plat = { platform: platformId };
  if (platformId === 'pc') plat.storefront = 'steam';
  platformEditor.value.platforms.push(plat);
}

function changeStorefront(plat, storefrontId) { plat.storefront = storefrontId; }

function changePlatform(index, newPlatformId) {
  const plat = { platform: newPlatformId };
  if (newPlatformId === 'pc') plat.storefront = 'steam';
  platformEditor.value.platforms[index] = plat;
}

// ─── Play Next ────────────────────────────────────────────────────────────────

async function addToPlayNext(game) {
  const gameId = String(game.id);
  if (playNextList.value.length >= 6 || playNextList.value.includes(gameId)) return;

  playNextList.value = [...playNextList.value, gameId];

  try {
    await savePlayNext(playNextList.value);
  } catch (err) {
    playNextList.value = playNextList.value.filter(id => id !== gameId);
    console.error('addToPlayNext failed:', err);
  }
}

async function removeFromPlayNext(gameId) {
  const id = String(gameId);
  playNextList.value = playNextList.value.filter(i => String(i) !== id);
  await removeFromPlayNextApi(gameId);
}

// ─── Search Overlay ───────────────────────────────────────────────────────────

function openSearchOverlay() {
  showSearchOverlay.value = true;
}

function closeSearchOverlay() {
  showSearchOverlay.value = false;
  overlaySearchQuery.value = '';
  hltbResults.value  = [];
  hltbSearched.value = false;
  hltbError.value    = '';
}

async function searchHltb() {
  const q = overlaySearchQuery.value.trim();
  if (q.length < 3) return;
  hltbLoading.value  = true;
  hltbError.value    = '';
  hltbSearched.value = true;
  try {
    const res = await fetch(`${API_BASE}/hltb/search?q=${encodeURIComponent(q)}`);
    if (!res.ok) throw new Error(`Error ${res.status}`);
    const data = await res.json();
    const existingIds = new Set(gameList.value.map(g => String(g.externalId)));
    hltbResults.value = data.filter(r => !existingIds.has(String(r.id)));
  } catch (err) {
    hltbError.value = err.message;
  } finally {
    hltbLoading.value = false;
  }
}

async function addFromHltb(result) {
  try {
    const newGame = await addGame(result.id, activeTab.value, []);
    gameList.value.push(newGame);
    hltbResults.value = hltbResults.value.filter(r => String(r.id) !== String(result.id));
  } catch (err) {
    hltbError.value = err.message;
  }
}

async function addFromHltbToStatus(result, status) {
  if (!status) return;
  try {
    const newGame = await addGame(result.id, status, []);
    gameList.value.push(newGame);
    hltbResults.value = hltbResults.value.filter(r => String(r.id) !== String(result.id));
  } catch (err) {
    hltbError.value = err.message;
  }
}

// ─── Filter ───────────────────────────────────────────────────────────────────

function toggleFilter(arr, val) {
  const i = arr.indexOf(val);
  if (i > -1) arr.splice(i, 1); else arr.push(val);
}

function toggleFilterSection(s) {
  filterSectionsOpen.value[s] = !filterSectionsOpen.value[s];
}

// ─── Dark Mode ────────────────────────────────────────────────────────────────

function toggleDarkMode() {
  darkMode.value = !darkMode.value;
  document.body.classList.toggle('light-mode', !darkMode.value);
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function handleGlobalKeydown(e) {
  if (e.key === 'Escape') {
    if (showSearchOverlay.value)       closeSearchOverlay();
    else if (showOverlay.value)        showOverlay.value = false;
    else if (showPlatformEditor.value) showPlatformEditor.value = false;
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

onMounted(async () => {
  document.addEventListener('keydown', handleGlobalKeydown);
  document.body.classList.toggle('light-mode', !darkMode.value);
  loading.value = true;
  const [games, sortOrder, playNext] = await Promise.all([
    loadGames(), loadSortOrder(), loadPlayNext(),
  ]);
  gameList.value     = games;
  startedOrder.value = sortOrder;
  playNextList.value = playNext;
  loading.value      = false;
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeydown);
});
</script>

<template>
  <div class="app-layout">

    <!-- Sidebar Toggle -->
    <button
      class="sidebar-toggle-external"
      :class="{ 'sidebar-closed': !sidebarOpen }"
      @click="sidebarOpen = !sidebarOpen"
    >{{ sidebarOpen ? '›' : '‹' }}</button>

    <!-- Main Content -->
    <div class="main-content" :class="{ 'sidebar-closed': !sidebarOpen }">
      <div class="game-list-container" :class="{ 'list-view': viewMode === 'list' }">

        <div v-if="loading" class="loading-state">Loading games...</div>

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
          <div
            v-if="activeTab === 'backlog' && playNextGames.length > 0"
            class="play-next-section"
          >
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
                  <button
                    class="card-pn-btn pn-remove-btn"
                    @click.stop="removeFromPlayNext(game.id)"
                    title="Remove from Play Next"
                  >✕</button>
                    <!-- 100% overlay -->
                  <img
                    v-if="game.tags?.includes('100%')"
                    src="/tags/100percent.png"
                    class="card-tag-overlay"
                  />
                </div>

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
                      <div class="gameplay-tooltip">
                        <div v-if="game.gameplayMain != null" class="tooltip-row">
                          <span class="tooltip-label">Main</span>
                          <span class="tooltip-value">{{ game.gameplayMain }} h</span>
                        </div>
                        <div v-if="game.gameplayExtra != null" class="tooltip-row">
                          <span class="tooltip-label">Extra</span>
                          <span class="tooltip-value">{{ game.gameplayExtra }} h</span>
                        </div>
                        <div v-if="game.gameplayComplete != null" class="tooltip-row">
                          <span class="tooltip-label">Complete</span>
                          <span class="tooltip-value">{{ game.gameplayComplete }} h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card-row" v-if="game.rating != null || game.dlcs?.length || game.tags?.length">
                    <div class="card-row-left">
                      <div v-if="game.dlcs?.length" class="dlc-wrap" @click.stop>
                        <span class="dlc-count">{{ game.dlcs.length }} DLC</span>
                        <div class="dlc-tooltip">
                          <div v-for="dlc in game.dlcs" :key="dlc.id" class="dlc-name">{{ dlc.name }}</div>
                        </div>
                      </div>
                      <div v-if="game.tags?.length" class="card-tags" @click.stop>
                        <img
                          v-if="game.tags.includes('physical')"
                          src="/tags/physical.png"
                          title="Physical"
                          class="card-tag-icon"
                        />
                        <span
                          v-if="game.tags.includes('100%')"
                          class="card-tag-100"
                          title="100%"
                        >100%</span>
                      </div>
                    </div>
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
            :disabled="sortBy !== 'custom'"
            @start="drag = true"
            @end="onDragEnd"
          >
            <template #item="{ element }">
              <div
                v-show="filteredIds.has(String(element.id))"
                class="game-card"
                @click="openOverlay(element, $event)"
              >
                <div class="card-cover-wrap">
                  <img :src="element.imageUrl" :alt="element.name" class="card-cover" />
                  <button
                    v-if="
                      activeTab === 'backlog' &&
                      !playNextList.includes(String(element.id)) &&
                      playNextList.length < 6
                    "
                    class="card-pn-btn"
                    @click.stop="addToPlayNext(element)"
                    title="Add to Play Next"
                  >›</button>
                    <!-- 100% overlay -->
                  <img
                    v-if="element.tags?.includes('100%')"
                    src="/tags/100percent.png"
                    class="card-tag-overlay"
                  />
                </div>

                <div class="card-info">
                  <p class="card-title">{{ element.name }}</p>

                  <div class="card-row">
                    <div class="card-platform" @click.stop="openPlatformEditor(element, $event)">
                      <button v-if="element.platforms.length === 0" class="add-first-platform-btn">+</button>
                      <template v-else>
                        <span class="platform-primary">
                          <img :src="resolveLogo(element.platforms[0])" class="platform-logo-sm" :title="getPlatformLabel(element.platforms[0])" />
                          <span class="platform-text">{{ getPlatformLabel(element.platforms[0]) }}</span>
                        </span>
                        <img v-for="(plat, idx) in element.platforms.slice(1)" :key="idx" :src="resolveLogo(plat)" class="platform-logo-sm" :title="getPlatformLabel(plat)" />
                      </template>
                    </div>

                    <div v-if="element.gameplayAll != null" class="card-time-wrap" @click.stop>
                      <span class="card-time">{{ element.gameplayAll }} h</span>
                      <div class="gameplay-tooltip">
                        <div v-if="element.gameplayMain != null" class="tooltip-row">
                          <span class="tooltip-label">Main</span>
                          <span class="tooltip-value">{{ element.gameplayMain }} h</span>
                        </div>
                        <div v-if="element.gameplayExtra != null" class="tooltip-row">
                          <span class="tooltip-label">Extra</span>
                          <span class="tooltip-value">{{ element.gameplayExtra }} h</span>
                        </div>
                        <div v-if="element.gameplayComplete != null" class="tooltip-row">
                          <span class="tooltip-label">Complete</span>
                          <span class="tooltip-value">{{ element.gameplayComplete }} h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card-row" v-if="element.rating != null || element.dlcs?.length || element.tags?.length">
                    <div class="card-row-left">
                      <div v-if="element.dlcs?.length" class="dlc-wrap" @click.stop>
                        <span class="dlc-count">{{ element.dlcs.length }} DLC</span>
                        <div class="dlc-tooltip">
                          <div v-for="dlc in element.dlcs" :key="dlc.id" class="dlc-name">{{ dlc.name }}</div>
                        </div>
                      </div>
                      <div v-if="element.tags?.length" class="card-tags" @click.stop>
                        <img
                          v-if="element.tags.includes('physical')"
                          src="/tags/physical.png"
                          title="Physical"
                          class="card-tag-icon"
                        />
                        <span
                          v-if="element.tags.includes('100%')"
                          class="card-tag-100"
                          title="100%"
                        >100%</span>
                      </div>
                    </div>
                    <span v-if="element.rating != null" class="card-rating">{{ formatRating(element.rating) }}</span>
                  </div>
                </div>
              </div>
            </template>
          </draggable>

          <!-- Shelved Section (Started tab only) -->
          <template v-if="activeTab === 'started' && shelvedGames.length > 0">
            <div class="list-separator"></div>
            <div class="section-label">SHELVED</div>
            <div class="game-grid">
              <div
                v-for="game in shelvedGames"
                :key="game.id"
                class="game-card"
                @click="openOverlay(game, $event)"
              >
                <div class="card-cover-wrap">
                  <img :src="game.imageUrl" :alt="game.name" class="card-cover" />

                    <!-- 100% overlay -->
                    <img
                      v-if="game.tags?.includes('100%')"
                      src="/tags/100percent.png"
                      class="card-tag-overlay"
                    />
                </div>
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
                      <div class="gameplay-tooltip">
                        <div v-if="game.gameplayMain != null" class="tooltip-row">
                          <span class="tooltip-label">Main</span>
                          <span class="tooltip-value">{{ game.gameplayMain }} h</span>
                        </div>
                        <div v-if="game.gameplayExtra != null" class="tooltip-row">
                          <span class="tooltip-label">Extra</span>
                          <span class="tooltip-value">{{ game.gameplayExtra }} h</span>
                        </div>
                        <div v-if="game.gameplayComplete != null" class="tooltip-row">
                          <span class="tooltip-label">Complete</span>
                          <span class="tooltip-value">{{ game.gameplayComplete }} h</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div class="card-row" v-if="game.rating != null || game.dlcs?.length || game.tags?.length">
                    <div class="card-row-left">
                      <div v-if="game.dlcs?.length" class="dlc-wrap" @click.stop>
                        <span class="dlc-count">{{ game.dlcs.length }} DLC</span>
                        <div class="dlc-tooltip">
                          <div v-for="dlc in game.dlcs" :key="dlc.id" class="dlc-name">{{ dlc.name }}</div>
                        </div>
                      </div>
                      <div v-if="game.tags?.length" class="card-tags" @click.stop>
                        <img
                          v-if="game.tags.includes('physical')"
                          src="/tags/physical.png"
                          title="Physical"
                          class="card-tag-icon"
                        />
                        <span
                          v-if="game.tags.includes('100%')"
                          class="card-tag-100"
                          title="100%"
                        >100%</span>
                      </div>
                    </div>
                    <span v-if="game.rating != null" class="card-rating">{{ formatRating(game.rating) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <p
            v-if="filteredGames.length === 0 && (activeTab !== 'backlog' || playNextGames.length === 0)"
            class="empty-state"
          >No games found</p>

        </template>
      </div>
    </div>

    <!-- Sidebar -->
    <aside :class="['sidebar', { collapsed: !sidebarOpen }]">
      <div v-show="sidebarOpen" class="sidebar-content">

        <div class="sidebar-header">Filters & View</div>

        <div class="sidebar-section">
          <button class="search-open-btn" @click="openSearchOverlay">
            Add Games
          </button>
        </div>

        <!-- Add Game (hidden) -->
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
            >{{ addLoading ? '...' : 'ADD' }}</button>
          </div>
          <p v-if="addError" class="add-game-error">{{ addError }}</p>
          <p v-if="addSuccess" class="add-game-success">Game added</p>
        </div>

        <!-- Search -->
        <div class="sidebar-section">
          <div class="sidebar-section-label">SEARCH</div>
          <div class="search-row">
            <div class="search-input-wrap" style="flex: 1">
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Filter by title..."
                class="search-input"
                @keydown.esc="searchQuery = ''"
              />
              <button
                v-if="searchQuery"
                class="search-clear-btn"
                @click="searchQuery = ''"
              >✕</button>
            </div>
          </div>
        </div>

        <!-- Sort -->
        <div class="sidebar-section">
          <div
            class="sidebar-section-label collapsible"
            @click="toggleFilterSection('sort')"
          >
            SORT
            <span class="collapse-arrow">{{ filterSectionsOpen.sort ? '▼' : '▶' }}</span>
          </div>
          <div v-show="filterSectionsOpen.sort" class="filter-options filter-options-single">
            <button
              v-if="activeTab === 'started'"
              :class="['filter-btn', { active: sortBy === 'custom' }]"
              @click="sortBy = 'custom'"
            >Custom Order</button>
            <button
              :class="['filter-btn', { active: sortBy === 'name' }]"
              @click="toggleNameSort"
            >
              Name
              <span v-if="sortBy === 'name'" class="sort-dir">
                {{ sortDirection === 'asc' ? '(A–Z)' : '(Z–A)' }}
              </span>
            </button>
            <button
              :class="['filter-btn', { active: sortBy === 'rating' }]"
              @click="toggleRatingSort"
            >
              Rating
              <span v-if="sortBy === 'rating'" class="sort-dir">
                {{ sortDirection === 'desc' ? '(↓)' : '(↑)' }}
              </span>
            </button>
            <button
              :class="['filter-btn', { active: sortBy === 'playtime' }]"
              @click="togglePlaytimeSort"
            >
              Playtime
              <span v-if="sortBy === 'playtime'" class="sort-dir">
                {{ sortDirection === 'asc' ? '(↑)' : '(↓)' }}
              </span>
            </button>
          </div>
        </div>

        <!-- Platform & Storefront -->
        <div class="sidebar-section">
          <div
            class="sidebar-section-label collapsible"
            @click="toggleFilterSection('platformStorefront')"
          >
            Filter
            <span class="collapse-arrow">{{ filterSectionsOpen.platformStorefront ? '▼' : '▶' }}</span>
          </div>
          <div v-show="filterSectionsOpen.platformStorefront">
            <div class="filter-subsection-label">Tags</div>
            <div class="filter-options">
              <button
                v-for="tag in ['physical', '100%']"
                :key="tag"
                :class="['filter-btn', { active: tagFilter.includes(tag) }]"
                @click="toggleFilter(tagFilter, tag)"
              >{{ tag.charAt(0).toUpperCase() + tag.slice(1) }}</button>
            </div>

            <div class="filter-subsection-label">Platform</div>
            <div class="filter-options">
              <button
                v-for="plat in availablePlatforms"
                :key="plat.id"
                :class="['filter-btn', { active: platformFilter.includes(plat.id) }]"
                @click="toggleFilter(platformFilter, plat.id)"
              >{{ plat.label }}</button>
              <button
                :class="['filter-btn', { active: platformFilter.includes('none') }]"
                @click="toggleFilter(platformFilter, 'none')"
              >No Platform</button>
            </div>
            <div class="filter-subsection-label" style="margin-top: 8px">Storefront</div>
            <div class="filter-options">
              <button
                v-for="store in storefronts"
                :key="store.id"
                :class="['filter-btn', { active: storefrontFilter.includes(store.id) }]"
                @click="toggleFilter(storefrontFilter, store.id)"
              >{{ store.label }}</button>
            </div>
          </div>
        </div>

        <!-- View & Theme -->
        <div class="sidebar-section view-section">
          <div class="sidebar-section-label">VIEW</div>

          <!-- Grid / List Toggle -->
          <div class="view-toggle">
            <button
              :class="['view-btn', { active: viewMode === 'grid' }]"
              @click="viewMode = 'grid'"
            >Grid</button>
            <button
              :class="['view-btn', { active: viewMode === 'list' }]"
              @click="viewMode = 'list'"
            >List</button>
          </div>

          <!-- Dark / Light Toggle -->
          <button class="theme-toggle-btn" @click="toggleDarkMode">
            {{ darkMode ? 'Light Mode' : 'Dark Mode' }}
          </button>
        </div>

      </div>
    </aside>

    <!-- Status Overlay -->
    <div v-if="showOverlay" class="overlay" @click="showOverlay = false">
      <div class="overlay-content" @click.stop>
        <div class="overlay-title">{{ overlayGame?.name }}</div>
        <div class="overlay-subtitle">Move to</div>

        <div class="status-buttons">
          <button
            v-for="option in statusOptions"
            :key="option.id"
            :class="['status-btn', { active: overlayGame?.status === option.id }]"
            @click="changeStatus(option.id)"
          >{{ option.label }}</button>
        </div>

        <!-- Tags -->
        <div class="overlay-tags">
          <div class="overlay-section-label">TAGS</div>
          <div class="tag-buttons">
            <button
              v-for="tag in ['physical', '100%']"
              :key="tag"
              :class="['tag-btn', { active: overlayGame?.tags?.includes(tag) }]"
              @click="toggleTag(tag)"
            >{{ tag.charAt(0).toUpperCase() + tag.slice(1) }}</button>
          </div>
        </div>

        <div class="overlay-danger-zone">
          <button class="clear-cache-btn" @click="clearGameCache(overlayGame)">
            Clear Cache
          </button>

          <template v-if="!deleteConfirm">
            <button class="delete-trigger-btn" @click="deleteConfirm = true">
              Delete game
            </button>
          </template>
          <template v-else>
            <span class="delete-confirm-text">Really delete?</span>
            <div class="delete-confirm-actions">
              <button class="delete-confirm-btn" @click="handleDeleteGame">Yes, delete</button>
              <button class="delete-cancel-btn" @click="deleteConfirm = false">Cancel</button>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Platform Editor -->
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
    <div v-if="showSearchOverlay" class="overlay search-overlay" @click.self="closeSearchOverlay">
      <div class="search-overlay-content" @click.stop>

        <div class="search-overlay-header">
          <div class="search-input-wrap">
            <input
              v-model="overlaySearchQuery"
              type="text"
              placeholder="Search title... (min. 3 characters)"
              class="search-input"
              autofocus
              @keydown.enter="searchHltb"
            />
            <button
              v-if="overlaySearchQuery"
              class="search-clear-btn"
              @click="overlaySearchQuery = ''"
            >✕</button>
          </div>
          <button
            class="hltb-search-btn"
            :disabled="overlaySearchQuery.trim().length < 3 || hltbLoading"
            @click="searchHltb"
          >{{ hltbLoading ? '...' : 'Search HLTB' }}</button>
        </div>

        <!-- Aktive Liste -->
        <p class="search-active-list">
          Adding to: <strong>{{ tabs.find(t => t.id === activeTab)?.label }}</strong>
        </p>

        <p v-if="hltbError" class="add-game-error">{{ hltbError }}</p>

        <div v-if="hltbSearched && !hltbLoading && hltbResults.length === 0" class="hltb-empty">
          No new games found
        </div>

        <div v-if="hltbResults.length > 0" class="search-results-grid">
          <div
            v-for="result in hltbResults"
            :key="result.id"
            class="search-result-card"
          >
            <img :src="result.imageUrl" :alt="result.name" class="search-result-img" />
            <div class="search-result-info">
              <div class="search-result-name">{{ result.name }}</div>
              <div class="search-result-actions">
                <!-- Zur aktiven Liste hinzufügen -->
                <button
                  class="search-result-add-btn primary"
                  @click="addFromHltb(result)"
                  :title="`Add to ${tabs.find(t => t.id === activeTab)?.label}`"
                >+ {{ tabs.find(t => t.id === activeTab)?.label }}</button>

                <!-- Auswahl zu welcher Liste -->
                <select
                  class="search-result-status-select"
                  @change="addFromHltbToStatus(result, $event.target.value); $event.target.value = ''"
                >
                  <option value="" disabled selected>+ Other</option>
                  <option
                    v-for="option in statusOptions"
                    :key="option.id"
                    :value="option.id"
                  >{{ option.label }}</option>
                </select>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>
