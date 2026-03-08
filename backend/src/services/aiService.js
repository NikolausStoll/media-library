import OpenAI from 'openai'
import { getMovieContext, getSeriesContext, getGameContext } from './aiContext.js'

const MODEL = process.env.AI_MODEL ?? 'gpt-4o-mini'
let cachedClient = null
let cachedKey = ''

const WEEKDAY_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
  return { timeOfDay, weekday }
}

function getContextData(mediaType, mode, options = {}) {
  if (mediaType === 'movie') return getMovieContext(mode, options)
  if (mediaType === 'series') return getSeriesContext(mode, options.episodeLength, options)
  if (mediaType === 'game') return getGameContext(mode, options)
  return null
}

function buildPromptPayload(mediaType, mode, contextData, options = {}) {
  const time = getTimeContext()
  const { mode: _m, mediaType: _t, ...rest } = contextData
  const payload = {
    timeOfDay: time.timeOfDay,
    weekday: time.weekday,
    ...rest,
  }

  if (mediaType === 'game') {
    payload.sessionHint = options.sessionHint ?? 'any'
    payload.availableMinutes = options.availableMinutes ?? null
    if (options.platformFilter?.length) payload.platformFilter = options.platformFilter
  }
  if (mediaType === 'series' && mode === 'new-recommendation') {
    payload.episodeLength = options.episodeLength ?? 'any'
  }

  return payload
}

const MOVIE_WHATS_NEXT_SYSTEM = `You are a personal movie advisor.

You receive one JSON object with:
- timeOfDay, weekday
- recentlyCompleted: recently watched movies, optionally with rating
- genrePreference: array of { name, count }
- poolTitles: candidate movie titles

Task:
- Suggest 1–2 movies only from poolTitles.
- Prefer titles that match the strongest genre preferences.
- Use recentlyCompleted and optional ratings to stay close to the user's current taste when helpful.

Output:
- Return exactly one JSON object and nothing else.

JSON shape:
{
  "suggestions": [string],
  "reasoning": string
}

Rules:
- Use only titles from poolTitles.
- Return 1–2 titles.
- Write reasoning in English, short and UI-friendly.
- Avoid spoilers.`

const MOVIE_NEW_REC_SYSTEM = `You are a personal movie advisor.

You receive one JSON object with:
- timeOfDay, weekday
- recentlyCompleted: recently watched movies, optionally with rating
- genrePreference: array of { name, count }
- poolTitles: optional candidate movie titles (may be empty)

Task:
- Suggest exactly 10 movies that fit the user's taste.
- Prefer titles from poolTitles when poolTitles is non-empty.
- Use recentlyCompleted, optional ratings, and genrePreference to infer taste.

Output:
- Return exactly one JSON object and nothing else.

JSON shape:
{
  "suggestions": [string],
  "reasoning": string
}

Rules:
- Return exactly 10 titles in "suggestions".
- Write reasoning in English, short and UI-friendly.
- Avoid spoilers.
- If poolTitles is non-empty, prioritize titles from poolTitles.`

const SERIES_WHATS_NEXT_SYSTEM = `You are a personal series advisor.

You receive one JSON object with:
- timeOfDay, weekday
- recentlyCompleted: recently watched series, optionally with rating
- genrePreference: array of { name, count }
- poolItems: candidate series objects with title, weight, and optional runtime

Task:
- Suggest 1–2 series only from poolItems, using the title field.
- Prefer titles with higher weight when the overall fit is similar.
- Match the strongest genre preferences.
- Use recentlyCompleted and optional ratings to stay close to the user's current taste when helpful.

Output:
- Return exactly one JSON object and nothing else.

JSON shape:
{
  "suggestions": [string],
  "reasoning": string
}

Rules:
- Use only titles from poolItems.
- Return 1–2 titles.
- Write reasoning in English, short and UI-friendly.
- Avoid spoilers.`

const SERIES_NEW_REC_SYSTEM = `You are a personal series advisor.

You receive one JSON object with:
- timeOfDay, weekday
- recentlyCompleted: series the user finished recently, optionally with rating
- recentlyWatchingPaused: series the user is currently watching or paused
- genrePreference: array of { name, count }
- episodeLength: "20-30" | "45+" | "any"

Task:
- Suggest exactly 10 series that fit the user's taste.
- Use recentlyCompleted, recentlyWatchingPaused, genrePreference, and episodeLength to infer fit.

Output:
- Return exactly one JSON object and nothing else.

JSON shape:
{
  "suggestions": [string],
  "reasoning": string
}

Rules:
- Return exactly 10 titles in "suggestions".
- Write reasoning in English, short and UI-friendly.
- Avoid spoilers.
- Respect episodeLength when possible.`


const GAME_TASKS = {
  'whats-next': 'Pick 1–2 titles ONLY from the pool (wishlist released + play next). Consider sessionHint. Short reason.',
  'new-recommendation': 'Suggest 1–2 new games. Exclude excludeGameIds. Wishlist in result is OK. Consider availableMinutes and platformFilter if given. Short reason.',
}

function buildSystemPrompt(mediaType, mode) {
  if (mediaType === 'movie' && mode === 'whats-next') return MOVIE_WHATS_NEXT_SYSTEM
  if (mediaType === 'movie' && mode === 'new-recommendation') return MOVIE_NEW_REC_SYSTEM
  if (mediaType === 'series' && mode === 'whats-next') return SERIES_WHATS_NEXT_SYSTEM
  if (mediaType === 'series' && mode === 'new-recommendation') return SERIES_NEW_REC_SYSTEM
  const taskLine = mediaType === 'game' ? GAME_TASKS[mode] : 'Suggest 1–2 titles. Short reason.'
  return `You are a personal media advisor. Reply with a single JSON object only. Keys: suggestion (string, one title) OR suggestions (array of strings), reasoning (string). Use English. ${taskLine}`
}

function extractFirstJsonObject(str) {
  const trimmed = String(str).trim()
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

function parseOpenAiResponse(text) {
  if (!text) return {}
  const toParse = extractFirstJsonObject(text)
  try {
    const parsed = JSON.parse(toParse)
    const suggestion =
      parsed.suggestion ??
      parsed.game ??
      parsed.title ??
      parsed.recommendation ??
      (Array.isArray(parsed.suggestions) && parsed.suggestions[0] ? parsed.suggestions[0] : '')
    return {
      ...parsed,
      suggestion: suggestion || parsed.suggestion,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : (suggestion ? [suggestion] : []),
    }
  } catch {
    return { message: text.trim() }
  }
}

function fallbackFromContext(mediaType, contextData) {
  const pool = contextData?.poolItems ?? contextData?.poolTitles ?? []
  const first = Array.isArray(pool) ? pool[0] : null
  const title = (typeof first === 'object' && first?.title) ? first.title : (first ?? `${mediaType} suggestion`)
  return {
    message: `AI_API_KEY not configured. Fallback: ${title}`,
    suggestion: title,
    reasoning: 'No API key configured.',
    suggestions: mediaType === 'movie' ? [title] : undefined,
  }
}

export async function generateSuggestionFromParams(params) {
  const {
    mediaType,
    mode,
    platformFilter,
    sessionHint,
    availableMinutes,
    episodeLength,
    streamingOnly,
  } = params

  if (!mediaType || !mode) {
    throw new Error('mediaType and mode are required')
  }

  const options = {
    platformFilter: Array.isArray(platformFilter) ? platformFilter : undefined,
    sessionHint: sessionHint || 'any',
    availableMinutes: Number.isFinite(Number(availableMinutes)) ? Number(availableMinutes) : undefined,
    episodeLength: episodeLength || 'any',
    streamingOnly: Boolean(streamingOnly),
  }

  const contextData = getContextData(mediaType, mode, options)
  if (!contextData) throw new Error(`Unknown mediaType: ${mediaType}`)

  const payload = buildPromptPayload(mediaType, mode, contextData, options)
  const userContent = JSON.stringify(payload, null, 2)
  const systemContent = buildSystemPrompt(mediaType, mode)

  const aiClient = getAiClient()
  if (!aiClient) {
    return fallbackFromContext(mediaType, contextData)
  }

  console.log('[AI] Request – system:', systemContent)
  console.log('[AI] Request – user (JSON):', userContent)

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
    const suggestions = Array.isArray(parsed.suggestions) ? parsed.suggestions : (suggestion ? [suggestion] : [])

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

// Legacy: keep for tests / old callers
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
    safeItems.find(item => item?.status?.toLowerCase?.()?.includes('backlog') || item?.status?.toLowerCase?.()?.includes('watchlist')) ??
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
