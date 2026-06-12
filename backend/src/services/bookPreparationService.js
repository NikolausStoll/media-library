import { getAiClient, MODEL } from './aiService.js'
import { getBookDraftSourceByIsbn } from './openLibraryService.js'
import { normalizeBookPublishedDate } from '../utils/bookDate.js'

const WEB_SEARCH_MODEL = process.env.BOOK_PREP_WEB_SEARCH_MODEL ?? 'gpt-4o-mini'

const CONFIDENCE_FIELDS = [
  'title',
  'authors',
  'description',
  'pageCount',
  'publishedDate',
  'seriesName',
  'seriesPosition',
  'publisher',
  'language',
  'coverUrl',
]

const BOOK_PREP_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['draft', 'confidence', 'warnings'],
  properties: {
    draft: {
      type: 'object',
      additionalProperties: false,
      required: [
        'title',
        'authors',
        'description',
        'coverUrl',
        'pageCount',
        'publishedDate',
        'seriesName',
        'seriesPosition',
        'publisher',
        'isbn',
        'language',
        'sourceName',
        'sourceUrl',
      ],
      properties: {
        title: { type: ['string', 'null'] },
        authors: { type: 'array', items: { type: 'string' } },
        description: { type: ['string', 'null'] },
        coverUrl: { type: ['string', 'null'] },
        pageCount: { type: ['integer', 'null'] },
        publishedDate: { type: ['string', 'null'] },
        seriesName: { type: ['string', 'null'] },
        seriesPosition: { type: ['string', 'null'] },
        publisher: { type: ['string', 'null'] },
        isbn: { type: 'string' },
        language: { type: ['string', 'null'], enum: ['de', 'en', null] },
        sourceName: { type: 'string' },
        sourceUrl: { type: ['string', 'null'] },
      },
    },
    confidence: {
      type: 'object',
      additionalProperties: false,
      required: CONFIDENCE_FIELDS,
      properties: Object.fromEntries(
        CONFIDENCE_FIELDS.map(field => [field, { type: 'string', enum: ['high', 'medium', 'low', 'unknown'] }]),
      ),
    },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const BOOK_PREP_SYSTEM = `You prepare editable book metadata drafts for a private media library.

You receive one JSON object with:
- isbn
- languageHint: optional "de" or "en"
- openLibrary: compact Open Library edition/work/books-api data, deterministic fallbackDraft, and pre-extracted seriesHints

Task:
- Return exactly one JSON object matching the provided schema.
- Prefer ISBN-specific edition fields for edition-specific facts: publisher, publish date, page count, ISBN, cover.
- Use Open Library work data only as additional context for general facts such as description or series hints.
- Use seriesHints directly when present.
- Keep title and author names clean, without edition noise.
- Correct obvious title capitalization when evidence points to the same title, e.g. work title vs edition title casing.
- Return publishedDate only as "YYYY-MM-DD", "YYYY-MM", "YYYY", or null. Use "YYYY-MM-DD" when day/month/year are known, "YYYY-MM" when only month/year are known, and "YYYY" when only the year is known.
- Normalize language to "de", "en", or null.
- Extract seriesName and seriesPosition only when there is clear evidence.
- If seriesName is known but seriesPosition is missing, you may use your general literary knowledge to infer seriesPosition. When you do, add a warning that the series position was inferred by AI and set confidence.seriesPosition to "medium" or "low", not "high".
- Do not change sourceName or sourceUrl. Keep the Open Library source information from fallbackDraft/sourceUrls unchanged.
- Do not invent missing facts. Use null and add a warning when uncertain.

Rules:
- This draft will be reviewed by a human before saving.
- Mention version/edition ambiguity in warnings when Open Library data looks inconsistent or sparse.
- Do not include markdown or prose outside the JSON object.`

const BOOK_WEB_SEARCH_SYSTEM = `You prepare editable book metadata drafts for a private media library.

You receive one JSON object with:
- isbn
- languageHint: optional "de" or "en"
- openLibrary: sparse Open Library data that was not enough for a useful draft

Task:
- Use web search to identify the ISBN-specific book edition.
- Return exactly one JSON object matching the provided schema.
- Prefer edition-specific facts for publisher, publish date, page count, ISBN, and language.
- Keep title and author names clean, without edition noise.
- Set coverUrl only when you have a direct, stable cover image URL from Open Library Covers for this ISBN or exact edition. If you would have to infer, guess, pick a generic image result, or use an unrelated shop/page image, return null.
- Return publishedDate only as "YYYY-MM-DD", "YYYY-MM", "YYYY", or null. Use "YYYY-MM-DD" when day/month/year are known, "YYYY-MM" when only month/year are known, and "YYYY" when only the year is known.
- Normalize language to "de", "en", or null.
- Extract seriesName and seriesPosition only when there is clear evidence.
- Put the best source page you used into draft.sourceUrl and set draft.sourceName to a concise source label.
- If facts are uncertain or sources disagree, use null for that field and add a warning.

Rules:
- This draft will be reviewed by a human before saving.
- Do not invent missing facts.
- Do not include markdown or prose outside the JSON object.`

const TRACKED_DRAFT_FIELDS = [
  'title',
  'authors',
  'description',
  'coverUrl',
  'pageCount',
  'publishedDate',
  'seriesName',
  'seriesPosition',
  'publisher',
  'isbn',
  'language',
  'sourceName',
  'sourceUrl',
]

function logBookPreparation(label, data) {
  try {
    console.log(`[BookPrepare] ${label}:`, JSON.stringify(data, null, 2))
  } catch {
    console.log(`[BookPrepare] ${label}:`, data)
  }
}

function compactOpenLibraryPayload(source) {
  return {
    fallbackDraft: {
      title: source.fallbackDraft?.title ?? null,
      authors: source.fallbackDraft?.authors ?? [],
      description: source.fallbackDraft?.description ?? null,
      pageCount: source.fallbackDraft?.pageCount ?? null,
      publishedDate: source.fallbackDraft?.publishedDate ?? null,
      publisher: source.fallbackDraft?.publisher ?? null,
      isbn: source.fallbackDraft?.isbn ?? source.isbn,
      language: source.fallbackDraft?.language ?? null,
      seriesName: source.fallbackDraft?.seriesName ?? null,
      seriesPosition: source.fallbackDraft?.seriesPosition ?? null,
    },
    edition: {
      title: source.edition?.title ?? null,
      publishers: source.edition?.publishers ?? [],
      publishDate: source.edition?.publish_date ?? null,
      languageKeys: (source.edition?.languages ?? []).map(lang => lang.key).filter(Boolean),
      physicalFormat: source.edition?.physical_format ?? null,
      pageCount: source.edition?.number_of_pages ?? null,
      isbn10: source.edition?.isbn_10 ?? [],
      isbn13: source.edition?.isbn_13 ?? [],
      editionName: source.edition?.edition_name ?? null,
    },
    booksApi: {
      title: source.booksApi?.title ?? null,
      authors: (source.booksApi?.authors ?? []).map(author => author.name).filter(Boolean),
      publisher: source.booksApi?.publishers?.[0]?.name ?? null,
      publishDate: source.booksApi?.publish_date ?? null,
      pageCount: source.booksApi?.number_of_pages ?? null,
    },
    work: {
      title: source.work?.title ?? null,
      description: typeof source.work?.description === 'string'
        ? source.work.description
        : source.work?.description?.value ?? null,
    },
    seriesHints: source.seriesHints ?? [],
    sourceUrls: {
      isbn: source.sourceUrls?.isbn ?? null,
      edition: source.sourceUrls?.edition ?? null,
      work: source.sourceUrls?.work ?? null,
    },
  }
}

function cleanDraft(draft, isbn) {
  const d = draft ?? {}
  return {
    title: d.title ?? '',
    authors: Array.isArray(d.authors) ? d.authors.filter(Boolean) : [],
    description: d.description ?? null,
    coverUrl: d.coverUrl ?? d.imageUrl ?? null,
    pageCount: Number.isInteger(d.pageCount) ? d.pageCount : (Number.isFinite(Number(d.pageCount)) ? Number(d.pageCount) : null),
    publishedDate: normalizeBookPublishedDate(d.publishedDate),
    seriesName: d.seriesName ?? null,
    seriesPosition: d.seriesPosition ?? null,
    publisher: d.publisher ?? null,
    isbn,
    language: ['de', 'en'].includes(d.language) ? d.language : null,
    sourceName: d.sourceName ?? 'Open Library',
    sourceUrl: d.sourceUrl ?? null,
  }
}

function isTrustedWebSearchCoverUrl(value) {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' &&
      url.hostname === 'covers.openlibrary.org' &&
      url.pathname.startsWith('/b/')
  } catch {
    return false
  }
}

function fallbackConfidence(draft) {
  return {
    title: draft.title ? 'medium' : 'unknown',
    authors: draft.authors.length ? 'medium' : 'unknown',
    description: draft.description ? 'low' : 'unknown',
    pageCount: draft.pageCount ? 'medium' : 'unknown',
    publishedDate: draft.publishedDate ? 'medium' : 'unknown',
    seriesName: 'unknown',
    seriesPosition: 'unknown',
    publisher: draft.publisher ? 'medium' : 'unknown',
    language: draft.language ? 'medium' : 'unknown',
    coverUrl: draft.coverUrl ? 'medium' : 'unknown',
  }
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value != null
}

function comparableValue(value) {
  if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean).join(' | ')
  if (value == null) return ''
  return String(value).trim()
}

function displayValue(value) {
  if (Array.isArray(value)) return value.join(', ')
  if (value == null || value === '') return 'empty'
  return String(value)
}

function createFieldComparison(before, after) {
  const changes = []
  const filled = []
  const changed = []
  for (const field of TRACKED_DRAFT_FIELDS) {
    const from = before?.[field]
    const to = after?.[field]
    const fromPresent = present(from)
    const toPresent = present(to)
    if (!toPresent) continue
    if (!fromPresent) {
      const item = { field, from: null, to: displayValue(to), type: 'filled' }
      changes.push(item)
      filled.push(item)
      continue
    }
    if (comparableValue(from) !== comparableValue(to)) {
      const item = { field, from: displayValue(from), to: displayValue(to), type: 'changed' }
      changes.push(item)
      changed.push(item)
    }
  }
  return { changes, filled, changed }
}

function countPresentFields(draft) {
  return TRACKED_DRAFT_FIELDS.filter(field => field !== 'isbn' && present(draft?.[field])).length
}

function isWeakOpenLibrarySource(source) {
  const draft = cleanDraft(source.fallbackDraft, source.isbn)
  if (!present(draft.title) || !present(draft.authors)) return true
  return countPresentFields(draft) < 4
}

function countResponseWebSearchCalls(response) {
  return (response?.output ?? []).filter(item => item?.type === 'web_search_call').length
}

function openLibrarySourceUrl(source) {
  return source.fallbackDraft?.sourceUrl ??
    source.sourceUrls?.edition ??
    source.sourceUrls?.isbn ??
    null
}

function createAnalysis({ source, draft, method, model, tokenUsage = null, webSearchCallCount = 0 }) {
  const before = {
    ...cleanDraft(source.fallbackDraft, source.isbn),
    coverUrl: source.fallbackDraft?.coverUrl ?? source.fallbackDraft?.imageUrl ?? null,
  }
  const comparison = createFieldComparison(before, draft)
  return {
    method,
    model,
    openLibraryWeak: isWeakOpenLibrarySource(source),
    openLibraryFieldCount: countPresentFields(before),
    webSearchUsed: webSearchCallCount > 0 || method === 'web-search',
    webSearchCallCount,
    tokenUsage,
    fieldComparison: comparison,
  }
}

function fallbackResult(source, extraWarnings = [], reason = 'AI_API_KEY is not configured; using Open Library data without LLM normalization.') {
  const draft = cleanDraft(source.fallbackDraft, source.isbn)
  const result = {
    draft,
    confidence: fallbackConfidence(draft),
    warnings: [
      reason,
      ...extraWarnings,
    ],
    raw: {
      openLibrary: source,
      usedAi: false,
      model: null,
    },
  }
  result.analysis = createAnalysis({
    source,
    draft,
    method: 'open-library',
    model: null,
  })
  return result
}

function mergeSeriesInferenceWarning(warnings, source, draft) {
  const list = Array.isArray(warnings) ? [...warnings] : []
  const hadSeriesHint = Boolean(source.seriesHints?.length)
  const fallbackHadPosition = Boolean(source.fallbackDraft?.seriesPosition)
  const hasPosition = Boolean(draft?.seriesPosition)
  if (hadSeriesHint && hasPosition && !fallbackHadPosition) {
    const exists = list.some(warning => /series position|seriesPosition|position/i.test(warning))
    if (!exists) list.push('Series position was inferred by AI and should be reviewed.')
  }
  return list
}

function extractJsonObject(text) {
  const trimmed = String(text ?? '').trim()
  const start = trimmed.indexOf('{')
  if (start === -1) return trimmed
  let depth = 0
  for (let i = start; i < trimmed.length; i++) {
    if (trimmed[i] === '{') depth++
    if (trimmed[i] === '}') {
      depth--
      if (depth === 0) return trimmed.slice(start, i + 1)
    }
  }
  return trimmed
}

async function runNormalPreparation(aiClient, source, payload) {
  const response = await aiClient.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'book_metadata_draft',
        strict: true,
        schema: BOOK_PREP_SCHEMA,
      },
    },
    messages: [
      { role: 'system', content: BOOK_PREP_SYSTEM },
      { role: 'user', content: JSON.stringify(payload, null, 2) },
    ],
  })

  const text = response?.choices?.[0]?.message?.content ?? ''
  logBookPreparation('llm-token-usage', {
    method: 'normalization',
    model: response?.model ?? MODEL,
    usage: response?.usage ?? null,
  })

  const parsed = JSON.parse(extractJsonObject(text))
  const cleaned = cleanDraft(parsed.draft, source.isbn)
  const draft = {
    ...cleaned,
    coverUrl: cleaned.coverUrl ?? source.fallbackDraft?.coverUrl ?? source.fallbackDraft?.imageUrl ?? null,
    sourceName: source.fallbackDraft?.sourceName ?? 'Open Library',
    sourceUrl: openLibrarySourceUrl(source),
  }

  const result = {
    draft,
    confidence: parsed.confidence ?? fallbackConfidence(cleaned),
    warnings: mergeSeriesInferenceWarning(parsed.warnings, source, draft),
    raw: {
      openLibrary: source,
      usedAi: true,
      usedWebSearch: false,
      model: response?.model ?? MODEL,
      tokenUsage: response?.usage ?? null,
    },
  }
  result.analysis = createAnalysis({
    source,
    draft,
    method: 'llm-normalization',
    model: response?.model ?? MODEL,
    tokenUsage: response?.usage ?? null,
  })
  return result
}

async function runWebSearchPreparation(aiClient, source, payload) {
  const response = await aiClient.responses.create({
    model: WEB_SEARCH_MODEL,
    instructions: BOOK_WEB_SEARCH_SYSTEM,
    input: JSON.stringify(payload, null, 2),
    temperature: 0.2,
    tool_choice: 'required',
    tools: [
      {
        type: 'web_search_preview',
        search_context_size: 'low',
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'book_web_metadata_draft',
        strict: true,
        schema: BOOK_PREP_SCHEMA,
      },
    },
  })

  const text = response?.output_text ?? ''
  const webSearchCallCount = countResponseWebSearchCalls(response)
  logBookPreparation('llm-token-usage', {
    method: 'web-search-fallback',
    model: response?.model ?? WEB_SEARCH_MODEL,
    usage: response?.usage ?? null,
    webSearchCallCount,
  })

  const parsed = JSON.parse(extractJsonObject(text))
  const cleaned = cleanDraft(parsed.draft, source.isbn)
  const coverUrl = isTrustedWebSearchCoverUrl(cleaned.coverUrl) ? cleaned.coverUrl : null
  const draft = {
    ...cleaned,
    coverUrl,
    sourceName: cleaned.sourceName || 'Web Search',
    sourceUrl: cleaned.sourceUrl ?? source.sourceUrls?.isbn ?? null,
  }

  const warnings = Array.isArray(parsed.warnings) ? [...parsed.warnings] : []
  warnings.push('Metadata was enriched using web search.')
  if (cleaned.coverUrl && !coverUrl) {
    warnings.push('Cover URL from web search was ignored because it was not a trusted Open Library cover URL.')
  }

  const result = {
    draft,
    confidence: {
      ...(parsed.confidence ?? fallbackConfidence(cleaned)),
      coverUrl: coverUrl ? (parsed.confidence?.coverUrl ?? 'medium') : 'unknown',
    },
    warnings,
    raw: {
      openLibrary: source,
      usedAi: true,
      usedWebSearch: true,
      model: response?.model ?? WEB_SEARCH_MODEL,
      tokenUsage: response?.usage ?? null,
      webSearchCallCount,
    },
  }
  result.analysis = createAnalysis({
    source,
    draft,
    method: 'web-search',
    model: response?.model ?? WEB_SEARCH_MODEL,
    tokenUsage: response?.usage ?? null,
    webSearchCallCount,
  })
  return result
}

export async function prepareBookDraft({ isbn, languageHint }) {
  const source = await getBookDraftSourceByIsbn(isbn)

  const aiClient = getAiClient()
  if (!aiClient) return fallbackResult(source)

  const payload = {
    isbn: source.isbn,
    languageHint: ['de', 'en'].includes(languageHint) ? languageHint : null,
    openLibrary: compactOpenLibraryPayload(source),
  }

  try {
    if (isWeakOpenLibrarySource(source)) {
      return await runWebSearchPreparation(aiClient, source, payload)
    }
    return await runNormalPreparation(aiClient, source, payload)
  } catch (err) {
    console.error('Book preparation AI failed:', err.message)
    return fallbackResult(
      source,
      [`AI preparation failed: ${err.message}`],
      'Using Open Library data without AI normalization.',
    )
  }
}
