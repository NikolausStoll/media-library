import OpenAI from 'openai'

const MODEL = process.env.AI_MODEL ?? 'gpt-3.5-turbo-16k'
let cachedClient = null
let cachedKey = ''

const getAiClient = () => {
  const key = (process.env.AI_API_KEY ?? '').trim()
  if (!key) return null
  if (cachedClient && cachedKey === key) return cachedClient
  cachedKey = key
  cachedClient = new OpenAI({ apiKey: key })
  return cachedClient
}

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

const parseOpenAiResponse = (text) => {
  if (!text) return {}
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    return { message: trimmed }
  }
}

const fallbackSuggestion = ({ mediaType, activeTab, contextItems, prompt, contextSummary }) => {
  const safeItems = Array.isArray(contextItems) ? contextItems : []
  const candidate =
    safeItems.find(item => item?.status?.toLowerCase()?.includes('backlog') || item?.status?.toLowerCase()?.includes('watchlist')) ??
    safeItems[0]
  const title = candidate?.title ?? `${mediaType} Vorschlag`
  const metadata = candidate?.metadata ?? 'Keine Details'
  const reason = candidate
    ? `Ähnliche Einträge: ${candidate.status ?? 'unbekannt'} (${metadata}).`
    : `Kontext fehlt; suche nach einem ${mediaType} in ${activeTab}.`

  return {
    message: `AI_API_KEY nicht konfiguriert oder erreichbar. Fallback: ${title}`,
    suggestion: title,
    reasoning: reason,
    contextSummary,
  }
}

export async function generateSuggestion({ mediaType, activeTab, prompt, contextItems }) {
  if (!mediaType || !activeTab || !(prompt ?? '').trim()) {
    throw new Error('mediaType, activeTab und prompt sind erforderlich')
  }
  const normalizedPrompt = prompt.trim()
  const contextSummary = contextSummaryFor(mediaType, activeTab, contextItems)
  const aiClient = getAiClient()
  if (!aiClient) {
    return fallbackSuggestion({ mediaType, activeTab, contextItems, prompt: normalizedPrompt, contextSummary })
  }

  try {
    const response = await aiClient.createChatCompletion({
      model: MODEL,
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are a thoughtful media librarian. Use the available library context and the requested media type when suggesting titles.',
        },
        {
          role: 'user',
          content: [
            `Context:\n${contextSummary}`,
            `Question: ${normalizedPrompt}`,
            'Answer as JSON with keys { suggestion, reasoning, message }. Provide a short reasoning.',
          ].join('\n\n'),
        },
      ],
    })

    const text = response?.data?.choices?.[0]?.message?.content ?? ''
    const parsed = parseOpenAiResponse(text)
    return {
      message: parsed.message ?? text,
      suggestion: parsed.suggestion ?? parsed.title ?? parsed?.recommendation ?? '',
      reasoning: parsed.reasoning ?? parsed.detail ?? '',
      contextSummary,
    }
  } catch (err) {
    console.error('AI service error:', err.message)
    const fallback = fallbackSuggestion({
      mediaType,
      activeTab,
      contextItems,
      prompt: normalizedPrompt,
      contextSummary,
    })
    return {
      ...fallback,
      message: `AI-Request fehlgeschlagen (${err.message}); Fallback: ${fallback.suggestion}`,
    }
  }
}
