import OpenAI from 'openai'
import { getMovieContext, getSeriesContext, getGameContext } from './aiContext.js'

const MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini'
let cachedClient = null
let cachedKey = ''

export const LOCATION_PRESETS = [
  { id: 'bed', label: 'Bed' },
  { id: 'couch', label: 'Couch' },
  { id: 'desk', label: 'Desk' },
]

export const MOOD_PRESETS = [
  { id: 'relaxed', label: 'Relaxed', emoji: '😴' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡' },
  { id: 'melancholic', label: 'Melancholic', emoji: '😢' },
  { id: 'sociable', label: 'Sociable', emoji: '🤝' },
  { id: 'focused', label: 'Focused', emoji: '🧠' },
]

const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MODE_LABELS = {
  continue: 'Continue playing',
  shelved: 'Pick up paused',
  new: 'Start something new',
}

function getAiClient() {
  const key = (process.env.AI_API_KEY ?? '').trim()
  if (!key) return null
  if (cachedClient && cachedKey === key) return cachedClient
  cachedKey = key
  cachedClient = new OpenAI({ apiKey: key })
  return cachedClient
}

function getTimeContext() {
  const now = new Date()
  const h = now.getHours()
  const timeOfDay = h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening'
  const weekday = WEEKDAY_EN[now.getDay()]
  const day = now.getDay()
  const isWeekend = day === 0 || day === 6
  const energyLevel = h < 10 ? 'low' : h < 18 ? 'medium' : 'variable'
  return { timeOfDay, weekday, isWeekend, energyLevel }
}

function getContextData(mediaType, mode) {
  if (mediaType === 'movie') return getMovieContext()
  if (mediaType === 'series') return getSeriesContext()
  if (mediaType === 'game') return getGameContext(mode || 'continue')
  return { filteredItems: [], recentlyCompleted: [], topGenres: [] }
}

function formatFilteredItems(items) {
  if (!items?.length) return '-'
  return items.map((item, i) => {
    const parts = [`${i + 1}. ${item.title}`, item.status]
    if (item.progress) parts.push(item.progress)
    if (item.genres) parts.push(item.genres)
    if (item.lastTouched) parts.push(item.lastTouched)
    if (item.gameplayAll != null) parts.push(`${item.gameplayAll}h`)
    if (item.rating != null) parts.push(typeof item.rating === 'number' && item.rating > 10 ? `${item.rating}%` : `★${item.rating}`)
    if (item.platforms) parts.push(item.platforms)
    if (item.hype !== undefined) parts.push(`H${item.hype}`)
    return parts.join(' ')
  }).join('\n')
}

function buildPrompt(params, contextData) {
  const { location, mood, availableMinutes, mediaType, mode } = params
  const locationPreset = LOCATION_PRESETS.find((p) => p.id === location) || LOCATION_PRESETS[0]
  const moodPreset = MOOD_PRESETS.find((p) => p.id === mood) || MOOD_PRESETS[0]
  const time = getTimeContext()

  const modeLabel = mediaType === 'game' && mode ? MODE_LABELS[mode] || mode : mediaType
  const plat =
    location === 'bed' ? 'Switch only' : location === 'couch' ? 'Xbox or Switch' : 'any'
  const lowEnergy = time.energyLevel === 'low' || time.timeOfDay === 'evening'
  const sessionHint = lowEnergy
    ? ' Late/low energy: prefer light, short sessions; avoid deep complex games.'
    : ' Match time to HLTB h + rating; consider session length.'

  let taskLine = ''
  if (mediaType === 'movie') {
    const skipEpics = location === 'bed' || availableMinutes < 120
    taskLine = skipEpics
      ? '2–3 titles (not watchlist). Bed/short time: no long epics, prefer light or single-session.'
      : '2–3 movie titles (not on watchlist), match taste. Output titles only.'
  } else if (mediaType === 'series') {
    const seriesTasks = {
      continue: '1–2 series from LIST (currently watching) to continue. Prefer near season end or light for tired. Low energy = less complex. Short reason.',
      new: '1–2 new series (exclude SEEN and WATCHLIST). Use my finished (with rating), taste, and what I\'m currently watching. Match taste. Short reason.',
    }
    taskLine = seriesTasks[mode] || seriesTasks.continue
  } else if (mediaType === 'game') {
    const modeTasks = {
      continue: `1–2 games to continue. P:${plat}.${sessionHint} Short reason.`,
      shelved: `1–2 shelved. P:${plat}. Re-entry? How long since? HLTB fit.${sessionHint} Brief reason.`,
      new: `1–2 fresh (Wishlist H4 / Play Next H2 / Backlog H0). P:${plat}.${sessionHint} Short reason.`,
    }
    taskLine = modeTasks[mode] || modeTasks.continue
  }

  const filteredBlob = formatFilteredItems(contextData.filteredItems)
  const recentBlob = contextData.recentlyCompleted?.length
    ? contextData.recentlyCompleted.join('\n')
    : '-'
  const genresBlob = contextData.topGenres?.length ? contextData.topGenres.join(', ') : '-'

  const locLine =
    mediaType === 'game'
      ? `${locationPreset.label} (games P: ${plat})`
      : locationPreset.label
  const typeLine =
    mediaType === 'game' && mode ? `${mediaType} ${modeLabel}` : mediaType === 'series' && mode ? `series ${mode}` : mediaType

  const contextLine =
    `Time=${time.timeOfDay} Day=${time.weekday}${time.isWeekend ? ' Weekend' : ''} | Mood=${moodPreset.label} Energy=${time.energyLevel} | Avail=${availableMinutes}min | Loc=${locLine} | Type=${typeLine}`

  let excludeBlob = ''
  const addSeen = (titles, max = 80) =>
    titles.length > max ? titles.slice(0, max).join(', ') + ` …+${titles.length - max} more` : titles.join(', ')
  const addWatchlist = (titles, max = 50) =>
    titles.length > max ? titles.slice(0, max).join(', ') + ` …+${titles.length - max} more` : titles.join(', ')
  if ((mediaType === 'movie' || mediaType === 'series') && contextData.finishedTitles?.length) {
    excludeBlob += `SEEN (do not suggest): ${addSeen(contextData.finishedTitles)}\n`
  }
  if ((mediaType === 'movie' || mediaType === 'series') && contextData.watchlistTitles?.length) {
    excludeBlob += `WATCHLIST (do not suggest): ${addWatchlist(contextData.watchlistTitles)}\n`
  }

  const listLabel = mediaType === 'series' && mode === 'continue' ? 'CURRENTLY WATCHING (pick from here):\n' : mediaType === 'series' ? 'CURRENTLY WATCHING (context):\n' : ''
  const userContent = `${contextLine}

${excludeBlob}${listLabel}LIST:
${filteredBlob}

TASTE: ${genresBlob}
RECENT (title + my rating): ${recentBlob}

DO: ${taskLine}
${mediaType === 'game' || (mediaType === 'series' && mode === 'continue') ? 'Only from LIST.' : ''}${mediaType === 'movie' || (mediaType === 'series' && mode === 'new') ? ' Exclude SEEN and WATCHLIST.' : ''}`

  return {
    systemContent:
      'Personal media advisor. English. One JSON object only. Keys: suggestion (string, for games/series) or suggestions (array, for movies), reasoning, message.',
    userContent,
  }
}

function extractFirstJsonObject(str) {
  const trimmed = str.trim()
  const start = trimmed.indexOf('{')
  if (start === -1) return trimmed
  let depth = 0
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++
    else if (trimmed[i] === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return trimmed.slice(start)
}

const parseOpenAiResponse = (text) => {
  if (!text) return {}
  const toParse = extractFirstJsonObject(text)
  try {
    const parsed = JSON.parse(toParse)
    const suggestion =
      parsed.suggestion ??
      parsed.game ??
      parsed.title ??
      parsed.recommendation ??
      ''
    return {
      ...parsed,
      suggestion: suggestion || parsed.suggestion,
    }
  } catch {
    return { message: text.trim() }
  }
}

function fallbackFromContext(mediaType, contextData) {
  const items = contextData.filteredItems || []
  const first = items[0]
  const title = first?.title ?? `${mediaType} suggestion`
  return {
    message: `AI_API_KEY not configured. Fallback: ${title}`,
    suggestion: title,
    reasoning: 'No API key configured.',
    suggestions: mediaType === 'movie' ? [title] : undefined,
  }
}

export async function generateSuggestionFromParams(params) {
  const { mediaType, mode } = params
  const contextData = getContextData(mediaType, mode)
  const { systemContent, userContent } = buildPrompt(params, contextData)
  const aiClient = getAiClient()

  if (!aiClient) {
    return fallbackFromContext(mediaType, contextData)
  }

  console.log('[AI] Request – system:', systemContent)
  console.log('[AI] Request – user:', userContent)

  try {
    const response = await aiClient.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: systemContent },
        { role: 'user', content: userContent },
      ],
    })

    const text = response?.choices?.[0]?.message?.content ?? ''
    console.log('[AI] Response:', text)
    const parsed = parseOpenAiResponse(text)
    const suggestion = parsed.suggestion ?? ''
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : undefined

    return {
      message: parsed.message ?? text,
      suggestion,
      suggestions,
      reasoning: parsed.reasoning ?? parsed.detail ?? '',
    }
  } catch (err) {
    console.error('AI service error:', err.message)
    const fallback = fallbackFromContext(mediaType, contextData)
    return {
      ...fallback,
      message: `AI request failed (${err.message}); fallback: ${fallback.suggestion}`,
    }
  }
}

// Legacy: keep for any old callers
const contextSummaryFor = (mediaType, activeTab, items) => {
  const normalized = Array.isArray(items) ? items : []
  const lines = [
    `mediaType=${mediaType}`,
    `activeTab=${activeTab}`,
    ...normalized.slice(0, 5).map((item, index) => {
      const meta = item?.metadata ? ` · ${item.metadata}` : ''
      return `${index + 1}. ${item?.title ?? 'Unbekannt'} (${item?.status ?? 'unbekannt'})${meta}`
    }),
  ]
  return lines.join('\n')
}

const fallbackSuggestion = ({ mediaType, activeTab, contextItems, prompt, contextSummary }) => {
  const safeItems = Array.isArray(contextItems) ? contextItems : []
  const candidate =
    safeItems.find(item => item?.status?.toLowerCase()?.includes('backlog') || item?.status?.toLowerCase()?.includes('watchlist')) ??
    safeItems[0]
  const title = candidate?.title ?? `${mediaType} suggestion`
  const reason = candidate ? `Similar entries: ${candidate.status ?? 'unknown'}.` : 'Context missing.'
  return {
    message: `AI_API_KEY not configured. Fallback: ${title}`,
    suggestion: title,
    reasoning: reason,
    contextSummary,
  }
}

export async function generateSuggestion({ mediaType, activeTab, prompt, contextItems }) {
  if (!mediaType || !activeTab || !(prompt ?? '').trim()) {
    throw new Error('mediaType, activeTab and prompt are required')
  }
  const contextSummary = contextSummaryFor(mediaType, activeTab, contextItems)
  const aiClient = getAiClient()
  if (!aiClient) {
    return fallbackSuggestion({ mediaType, activeTab, contextItems, prompt: prompt.trim(), contextSummary })
  }
  try {
    const response = await aiClient.chat.completions.create({
      model: MODEL,
      temperature: 0.6,
      messages: [
        { role: 'system', content: 'You are a thoughtful media librarian. Use the available library context.' },
        { role: 'user', content: `Context:\n${contextSummary}\n\nQuestion: ${prompt.trim()}\n\nAnswer as JSON with keys { suggestion, reasoning, message }.` },
      ],
    })
    const text = response?.choices?.[0]?.message?.content ?? ''
    const parsed = parseOpenAiResponse(text)
    return {
      message: parsed.message ?? text,
      suggestion: parsed.suggestion ?? parsed.title ?? parsed?.recommendation ?? '',
      reasoning: parsed.reasoning ?? parsed.detail ?? '',
      contextSummary,
    }
  } catch (err) {
    console.error('AI service error:', err.message)
    const fallback = fallbackSuggestion({ mediaType, activeTab, contextItems, prompt: prompt.trim(), contextSummary })
    return { ...fallback, message: `AI request failed (${err.message}); fallback: ${fallback.suggestion}` }
  }
}
