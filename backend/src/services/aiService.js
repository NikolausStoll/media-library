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
  if (!items?.length) return '(no entries)'
  return items.map((item, i) => {
    const parts = [`${i + 1}. ${item.title}`, item.status]
    if (item.progress) parts.push(`Progress: ${item.progress}`)
    if (item.genres) parts.push(`Genres: ${item.genres}`)
    if (item.lastTouched) parts.push(`lastTouched: ${item.lastTouched}`)
    if (item.gameplayMain != null) parts.push(`~${item.gameplayMain}h`)
    if (item.gameplayAll != null) parts.push(`Total ~${item.gameplayAll}h`)
    if (item.platforms) parts.push(`Platform: ${item.platforms}`)
    if (item.hype !== undefined) parts.push(`Hype: ${item.hype}`)
    return parts.join(' · ')
  }).join('\n')
}

function buildPrompt(params, contextData) {
  const { location, mood, availableMinutes, mediaType, mode } = params
  const locationPreset = LOCATION_PRESETS.find((p) => p.id === location) || LOCATION_PRESETS[0]
  const moodPreset = MOOD_PRESETS.find((p) => p.id === mood) || MOOD_PRESETS[0]
  const time = getTimeContext()

  const moodLabel = `${moodPreset.emoji} ${moodPreset.label}`
  const modeLabel = mediaType === 'game' && mode ? MODE_LABELS[mode] || mode : mediaType

  let taskLine = ''
  if (mediaType === 'movie') {
    taskLine = 'Find 2–3 movie titles I do not know yet (not from my watchlist) that match my taste. List only the movie titles.'
  } else if (mediaType === 'series') {
    taskLine = 'Recommend 1–2 series to continue. Prioritise: series where I am close to a season finale, or light series for tired evenings. Downgrade complex series when energy is low. Give a short reasoning.'
  } else if (mediaType === 'game') {
    if (mode === 'continue') {
      taskLine = 'Recommend 1–2 games to continue playing. Check if complexity fits current mood. Give a short reasoning why now.'
    } else if (mode === 'shelved') {
      taskLine = 'Recommend 1–2 shelved games. Consider: How long has it been? Is there a good re-entry point? Explain briefly why now is a good time to pick it up again.'
    } else {
      taskLine = 'Recommend 1–2 games I can start fresh (Wishlist/Play Next/Backlog). Hype: Wishlist=4, Play Next=2, Backlog=0. Choose to fit time, mood and platform. Give a short reasoning.'
    }
  }

  const filteredBlob = formatFilteredItems(contextData.filteredItems)
  const recentBlob = contextData.recentlyCompleted?.length
    ? contextData.recentlyCompleted.join('\n')
    : '(none)'
  const genresBlob = contextData.topGenres?.length ? contextData.topGenres.join(', ') : '(none)'

  const userContent = `You are a personal media advisor.

CONTEXT:
- Time of day: ${time.timeOfDay} | Weekday: ${time.weekday} | Weekend: ${time.isWeekend}
- Mood: ${moodLabel} | Energy: ${time.energyLevel}
- Available time: ${availableMinutes} minutes
- Location/device: ${locationPreset.label}
- Media type: ${mediaType}${mediaType === 'game' && mode ? ` | Mode: ${modeLabel}` : ''}

MY BACKLOG (pre-filtered):
${filteredBlob}

TASTE PROFILE (from completed titles):
Top genres: ${genresBlob}
Recent completions: ${recentBlob}

TASK:
${taskLine}

Reply concisely. For movies: list only 2–3 titles I do not know yet. For games/series: only titles from my backlog. Respond as JSON with keys: suggestion (or suggestions array for movies), reasoning, message.`

  return {
    systemContent: 'You are a personal media advisor. Answer in English. Output valid JSON only.',
    userContent,
  }
}

const parseOpenAiResponse = (text) => {
  if (!text) return {}
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  const toParse = jsonMatch ? jsonMatch[0] : trimmed
  try {
    return JSON.parse(toParse)
  } catch {
    return { message: trimmed }
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
    const parsed = parseOpenAiResponse(text)
    const suggestion = parsed.suggestion ?? parsed.title ?? parsed.recommendation ?? ''
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
