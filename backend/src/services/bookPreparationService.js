import { getAiClient, MODEL } from './aiService.js'
import { getBookDraftSourceByIsbn } from './openLibraryService.js'

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
- Normalize language to "de", "en", or null.
- Extract seriesName and seriesPosition only when there is clear evidence.
- If seriesName is known but seriesPosition is missing, you may use your general literary knowledge to infer seriesPosition. When you do, add a warning that the series position was inferred by AI and set confidence.seriesPosition to "medium" or "low", not "high".
- Do not invent missing facts. Use null and add a warning when uncertain.

Rules:
- This draft will be reviewed by a human before saving.
- Mention version/edition ambiguity in warnings when Open Library data looks inconsistent or sparse.
- Do not include markdown or prose outside the JSON object.`

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
    publishedDate: d.publishedDate ?? null,
    seriesName: d.seriesName ?? null,
    seriesPosition: d.seriesPosition ?? null,
    publisher: d.publisher ?? null,
    isbn,
    language: ['de', 'en'].includes(d.language) ? d.language : null,
    sourceName: d.sourceName ?? 'Open Library',
    sourceUrl: d.sourceUrl ?? null,
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

function fallbackResult(source, extraWarnings = []) {
  const draft = cleanDraft(source.fallbackDraft, source.isbn)
  const result = {
    draft,
    confidence: fallbackConfidence(draft),
    warnings: [
      'AI_API_KEY is not configured; using Open Library data without LLM normalization.',
      ...extraWarnings,
    ],
    raw: {
      openLibrary: source,
      usedAi: false,
      model: null,
    },
  }
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
      model: response?.model ?? MODEL,
      usage: response?.usage ?? null,
    })

    const parsed = JSON.parse(extractJsonObject(text))

    const cleaned = cleanDraft(parsed.draft, source.isbn)
    const result = {
      draft: {
        ...cleaned,
        coverUrl: cleaned.coverUrl ?? source.fallbackDraft?.coverUrl ?? source.fallbackDraft?.imageUrl ?? null,
        sourceName: cleaned.sourceName ?? source.fallbackDraft?.sourceName ?? 'Open Library',
        sourceUrl: cleaned.sourceUrl ?? source.fallbackDraft?.sourceUrl ?? source.sourceUrls?.isbn ?? null,
      },
      confidence: parsed.confidence ?? fallbackConfidence(cleanDraft(parsed.draft, source.isbn)),
      warnings: [],
      raw: {
        openLibrary: source,
        usedAi: true,
        model: MODEL,
        tokenUsage: response?.usage ?? null,
      },
    }
    result.warnings = mergeSeriesInferenceWarning(parsed.warnings, source, result.draft)
    return result
  } catch (err) {
    console.error('Book preparation AI failed:', err.message)
    return fallbackResult(source, [`AI preparation failed: ${err.message}`])
  }
}
