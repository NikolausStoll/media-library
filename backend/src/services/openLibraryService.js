import fetch from 'node-fetch'

const OL_BASE = 'https://openlibrary.org'
const SEARCH_LIMIT = 10
const EDITION_PAGE_LIMIT = 100
const EDITION_MAX_SCAN = 300
const EDITION_RETURN_LIMIT = 20

const HEADERS = {
  'User-Agent': 'MediaLibrary/1.0 (https://github.com/NikolausStoll/media-library; media-library-app@nikolausstoll.dev)',
}

export async function getRatingByIsbn(isbn) {
  if (!isbn) return null

  const editionRes = await fetch(`${OL_BASE}/isbn/${isbn}.json`, { headers: HEADERS })
  if (!editionRes.ok) return null

  const edition = await editionRes.json()
  const workKey = edition?.works?.[0]?.key
  if (!workKey) return null

  const ratingsRes = await fetch(`${OL_BASE}${workKey}/ratings.json`, { headers: HEADERS })
  if (!ratingsRes.ok) return null

  const data = await ratingsRes.json()
  const avg = data?.summary?.average
  const count = data?.summary?.count

  if (avg == null || count === 0) return null

  return {
    average: Math.round(avg * 10) / 10,
    count,
  }
}

function normalizeIsbn(isbn) {
  return String(isbn ?? '').replace(/[^0-9Xx]/g, '')
}

function firstValue(value) {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function arrayValue(value) {
  if (Array.isArray(value)) return value
  if (value == null) return []
  return [value]
}

function normalizeLanguage(value) {
  const raw = String(value ?? '').toLowerCase()
  if (['eng', 'en', '/languages/eng'].includes(raw)) return 'en'
  if (['ger', 'deu', 'de', '/languages/ger', '/languages/deu'].includes(raw)) return 'de'
  return null
}

function normalizeLanguageList(values = []) {
  const langs = values
    .map(normalizeLanguage)
    .filter(Boolean)
  return Array.from(new Set(langs))
}

function descriptionText(description) {
  if (!description) return null
  if (typeof description === 'string') return description
  if (typeof description?.value === 'string') return description.value
  return null
}

function comparableTitle(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

function publishedYear(value) {
  const match = String(value ?? '').match(/\b(1[5-9]\d{2}|20\d{2})\b/)
  return match ? Number(match[1]) : 0
}

function bestTitle({ edition, booksData, work }) {
  const editionTitle = edition?.title ?? null
  const booksTitle = booksData?.title ?? null
  const workTitle = work?.title ?? null
  const comparableWork = comparableTitle(workTitle)
  if (workTitle && comparableWork) {
    if (comparableWork === comparableTitle(editionTitle)) return workTitle
    if (comparableWork === comparableTitle(booksTitle)) return workTitle
  }
  return editionTitle ?? booksTitle ?? workTitle ?? ''
}

function normalizeSeriesName(value) {
  return String(value ?? '')
    .replace(/^series:/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())
}

function extractSeriesHints(...subjectGroups) {
  const subjects = subjectGroups.flat().filter(Boolean)
  const hints = []
  for (const subject of subjects) {
    const name = typeof subject === 'string' ? subject : subject?.name
    const url = typeof subject === 'object' ? subject?.url : ''
    const raw = name?.match(/^Series:(.+)$/i)?.[1] ?? url?.match(/\/subjects\/series:([^/?#]+)/i)?.[1]
    if (!raw) continue
    const seriesName = normalizeSeriesName(decodeURIComponent(raw))
    if (seriesName && !hints.some(hint => hint.seriesName === seriesName)) {
      hints.push({
        seriesName,
        source: name ?? url,
      })
    }
  }
  return hints
}

function coverFromEdition(edition) {
  const coverId = firstValue(edition?.covers)
  if (coverId) return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
  return null
}

function mapBooksApiEntry(entry) {
  if (!entry) return null
  return {
    title: entry.title ?? null,
    authors: (entry.authors ?? []).map(a => a.name).filter(Boolean),
    publisher: firstValue(entry.publishers)?.name ?? null,
    publishedDate: entry.publish_date ?? null,
    pageCount: entry.number_of_pages ?? null,
    coverUrl: entry.cover?.large ?? entry.cover?.medium ?? null,
    sourceUrl: entry.url ?? null,
    seriesHints: extractSeriesHints(entry.subjects),
  }
}

function mapFallbackDraft({ isbn, edition, booksApi, work }) {
  const booksData = mapBooksApiEntry(booksApi)
  const languageKey = firstValue(edition?.languages)?.key
  const seriesHints = extractSeriesHints(booksApi?.subjects, work?.subjects)
  const seriesName = seriesHints[0]?.seriesName ?? booksData?.seriesHints?.[0]?.seriesName ?? null
  return {
    title: bestTitle({ edition, booksData, work }),
    authors: booksData?.authors ?? [],
    description: descriptionText(work?.description) ?? null,
    imageUrl: booksData?.coverUrl ?? coverFromEdition(edition),
    coverUrl: booksData?.coverUrl ?? coverFromEdition(edition),
    pageCount: edition?.number_of_pages ?? booksData?.pageCount ?? null,
    publishedDate: edition?.publish_date ?? booksData?.publishedDate ?? null,
    seriesName,
    seriesPosition: null,
    publisher: firstValue(edition?.publishers) ?? booksData?.publisher ?? null,
    isbn,
    language: normalizeLanguage(languageKey) ?? null,
    sourceName: 'Open Library',
    sourceUrl: booksData?.sourceUrl ?? `https://openlibrary.org/isbn/${isbn}`,
  }
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return null
  return res.json()
}

function coverFromId(coverId) {
  if (!coverId) return null
  return `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
}

function mapSearchDoc(doc) {
  const isbnCandidates = Array.from(
    new Set((doc.isbn ?? []).map(normalizeIsbn).filter(isbn => /^(97[89])?\d{9}[\dXx]$/.test(isbn))),
  ).slice(0, 8)

  return {
    title: doc.title ?? '',
    authors: doc.author_name ?? [],
    firstPublishYear: doc.first_publish_year ?? null,
    languages: normalizeLanguageList(doc.language ?? []),
    editionCount: doc.edition_count ?? null,
    isbnCandidates,
    coverUrl: coverFromId(doc.cover_i),
    openLibraryWorkKey: doc.key ?? null,
  }
}

function normalizeSearchLanguage(language) {
  const normalized = String(language ?? '').toLowerCase()
  if (normalized === 'en') return 'eng'
  if (normalized === 'de') return 'ger'
  return ''
}

function normalizeFormatFilter(format) {
  const normalized = String(format ?? '').toLowerCase()
  return ['hardcover', 'paperback', 'ebook'].includes(normalized) ? normalized : ''
}

function normalizedFormatText(edition) {
  return [
    ...arrayValue(edition.physical_format),
    ...arrayValue(edition.format),
    ...arrayValue(edition.edition_name),
  ].join(' ').toLowerCase()
}

function editionMatchesFormat(edition, format) {
  if (!format) return true
  const text = normalizedFormatText(edition)
  if (format === 'ebook') {
    return Boolean(edition.ebook_access && edition.ebook_access !== 'no_ebook') ||
      /\b(e-?book|kindle|digital|electronic)\b/.test(text)
  }
  if (format === 'paperback') return /\b(paperback|softcover|mass market|taschenbuch)\b/.test(text)
  if (format === 'hardcover') return /\b(hardcover|hardback|gebunden|gebundene|gebundener)\b/.test(text)
  return text.includes(format)
}

function editionLanguageList(edition) {
  return normalizeLanguageList(
    arrayValue(edition.languages ?? edition.language)
      .map(lang => (typeof lang === 'string' ? lang : lang.key)),
  )
}

function mapEditionDoc(edition) {
  const isbn13 = (edition.isbn_13 ?? []).map(normalizeIsbn).filter(isbn => /^(97[89])\d{10}$/.test(isbn))
  const isbn10 = (edition.isbn_10 ?? []).map(normalizeIsbn).filter(isbn => /^\d{9}[\dXx]$/.test(isbn))
  const isbnCandidates = Array.from(
    new Set([...isbn13, ...isbn10]),
  )
  return {
    title: edition.title ?? '',
    publisher: firstValue(edition.publishers) ?? null,
    publishedDate: edition.publish_date ?? null,
    language: editionLanguageList(edition)[0] ?? null,
    languages: editionLanguageList(edition),
    format: firstValue(edition.physical_format) ?? firstValue(edition.format) ?? null,
    pageCount: edition.number_of_pages ?? null,
    isbn13,
    isbn10,
    isbnCandidates,
    coverUrl: coverFromEdition(edition),
    openLibraryEditionKey: edition.key ?? null,
  }
}

export async function searchBookDraftCandidates(queryInput, options = {}) {
  const query = String(queryInput ?? '').trim()
  if (query.length < 2) {
    throw new Error('query must contain at least 2 characters')
  }

  const language = normalizeSearchLanguage(options.language)
  const queryParts = [query]
  if (language) queryParts.push(`language:${language}`)
  const sort = options.sort === 'new' ? '&sort=new' : ''
  const url = `${OL_BASE}/search.json?q=${encodeURIComponent(queryParts.join(' '))}&limit=${SEARCH_LIMIT}${sort}&fields=key,title,author_name,first_publish_year,language,edition_count,isbn,cover_i`
  const data = await fetchJson(url)
  return (data?.docs ?? [])
    .map(mapSearchDoc)
    .filter(item => item.title && item.isbnCandidates.length)
}

export async function getEditionCandidatesForWork(workKeyInput, options = {}) {
  const rawKey = String(workKeyInput ?? '').trim()
  const workId = rawKey.match(/OL\d+W/)?.[0]
  if (!workId) throw new Error('workKey must be an Open Library work key')

  const firstPage = await fetchJson(`${OL_BASE}/works/${workId}/editions.json?limit=${EDITION_PAGE_LIMIT}`)
  const total = Math.min(firstPage?.size ?? firstPage?.entries?.length ?? 0, EDITION_MAX_SCAN)
  const pageOffsets = []
  for (let offset = EDITION_PAGE_LIMIT; offset < total; offset += EDITION_PAGE_LIMIT) {
    pageOffsets.push(offset)
  }

  const extraPages = await Promise.all(
    pageOffsets.map(offset => fetchJson(`${OL_BASE}/works/${workId}/editions.json?limit=${EDITION_PAGE_LIMIT}&offset=${offset}`)),
  )

  let editions = [
    ...(firstPage?.entries ?? []),
    ...extraPages.flatMap(page => page?.entries ?? []),
  ]
    .filter(edition => (edition.isbn_13?.length || edition.isbn_10?.length))

  const language = options.language
  if (['de', 'en'].includes(language)) {
    editions = editions.filter(edition => editionLanguageList(edition).includes(language))
  }

  const format = normalizeFormatFilter(options.format)
  if (format) {
    editions = editions.filter(edition => editionMatchesFormat(edition, format))
  }

  const mapped = editions.map(mapEditionDoc).filter(edition => edition.isbnCandidates.length)
  mapped.sort((a, b) => {
    if (options.sort === 'new') return publishedYear(b.publishedDate) - publishedYear(a.publishedDate)
    return 0
  })
  return mapped.slice(0, EDITION_RETURN_LIMIT)
}

export async function getBookDraftSourceByIsbn(isbnInput) {
  const isbn = normalizeIsbn(isbnInput)
  if (!/^(97[89])?\d{9}[\dXx]$/.test(isbn)) {
    throw new Error('isbn must be ISBN-10 or ISBN-13')
  }

  const [edition, booksApiPayload] = await Promise.all([
    fetchJson(`${OL_BASE}/isbn/${encodeURIComponent(isbn)}.json`),
    fetchJson(`${OL_BASE}/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&jscmd=data&format=json`),
  ])

  const booksApi = booksApiPayload?.[`ISBN:${isbn}`] ?? null
  const workKey = edition?.works?.[0]?.key
  const work = workKey ? await fetchJson(`${OL_BASE}${workKey}.json`) : null

  return {
    isbn,
    edition,
    booksApi,
    work,
    seriesHints: extractSeriesHints(booksApi?.subjects, work?.subjects),
    fallbackDraft: mapFallbackDraft({ isbn, edition, booksApi, work }),
    sourceUrls: {
      isbn: `${OL_BASE}/isbn/${isbn}`,
      edition: edition?.key ? `${OL_BASE}${edition.key}` : null,
      work: workKey ? `${OL_BASE}${workKey}` : null,
      booksApi: `${OL_BASE}/api/books?bibkeys=ISBN:${isbn}&jscmd=data&format=json`,
    },
  }
}
