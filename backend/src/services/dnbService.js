import fetch from 'node-fetch'

const DNB_SRU = 'https://services.dnb.de/sru/dnb'
const DNB_TIMEOUT_MS = Number(process.env.BOOK_DNB_TIMEOUT_MS) || 2500

const HEADERS = {
  'User-Agent': 'MediaLibrary/1.0 (https://github.com/NikolausStoll/media-library; media-library-app@nikolausstoll.dev)',
}

function normalizeIsbn(isbnInput) {
  const isbn = String(isbnInput ?? '').replace(/[^0-9Xx]/g, '')
  if (!/^(97[89])?\d{9}[\dXx]$/.test(isbn)) {
    throw new Error('isbn must be ISBN-10 or ISBN-13')
  }
  return isbn
}

function marcSubfields(xml, tag, codes = ['a']) {
  const re = new RegExp(`<datafield[^>]*tag="${tag}"[\\s\\S]*?<\\/datafield>`, 'g')
  const fields = xml.match(re) ?? []
  const values = []
  for (const field of fields) {
    for (const code of codes) {
      const subRe = new RegExp(`<subfield code="${code}">([^<]*)<\\/subfield>`, 'g')
      let match
      while ((match = subRe.exec(field))) values.push(match[1].trim())
    }
  }
  return values.filter(Boolean)
}

function yearFromMarc(xml) {
  const dates = marcSubfields(xml, '264', ['c'])
  for (const raw of dates) {
    const match = String(raw).match(/\b(1[5-9]\d{2}|20\d{2})\b/)
    if (match) return match[1]
  }
  const f008 = xml.match(/<controlfield tag="008">([^<]*)<\/controlfield>/)
  if (f008?.[1]?.length >= 4) return f008[1].slice(7, 11)
  return null
}

function pagesFromMarc(xml) {
  const values = marcSubfields(xml, '300', ['a'])
  for (const raw of values) {
    const match = String(raw).match(/(\d{1,4})\s*(?:S\.|Seiten|p\.|pages)/i)
    if (match) return Number(match[1])
  }
  return null
}

function normalizeDnbAuthor(name) {
  const raw = String(name ?? '').trim()
  if (!raw.includes(',')) return raw
  const parts = raw.split(',').map(part => part.trim()).filter(Boolean)
  if (parts.length < 2) return raw
  const dates = parts[parts.length - 1].match(/^\d{4}/) ? parts.pop() : null
  const family = parts.shift()
  const given = parts.join(' ')
  return [given, family, dates].filter(Boolean).join(' ').trim()
}

function descriptionFromMarc(xml) {
  const summaries = marcSubfields(xml, '520', ['a'])
  return summaries.find(text => text.trim().length > 0) ?? null
}

function dnbRecordId(xml) {
  return xml.match(/<controlfield tag="001">([^<]*)<\/controlfield>/)?.[1]?.trim() ?? null
}

function isGermanMarc(xml) {
  return /(?:<subfield code="a">ger<\/subfield>|tag="008">[^<]*\bger\b)/i.test(xml)
}

export function parseDnbMarcXml(xml, isbn) {
  const records = Number(xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/)?.[1] ?? 0)
  if (!records) {
    return { hit: false, isbn, fallbackDraft: null, recordId: null }
  }

  const titleMain = marcSubfields(xml, '245', ['a'])[0] ?? ''
  const titleSub = marcSubfields(xml, '245', ['b'])[0] ?? ''
  const title = [titleMain, titleSub].filter(Boolean).join(': ').replace(/\s+/g, ' ').trim()
  const authors = [
    ...marcSubfields(xml, '100', ['a']),
    ...marcSubfields(xml, '700', ['a']),
  ].map(normalizeDnbAuthor).filter(Boolean)
  const recordId = dnbRecordId(xml)

  const fallbackDraft = {
    title: title || null,
    authors,
    description: descriptionFromMarc(xml),
    pageCount: pagesFromMarc(xml),
    publishedDate: yearFromMarc(xml),
    publisher: marcSubfields(xml, '264', ['b'])[0] ?? null,
    isbn,
    language: isGermanMarc(xml) ? 'de' : null,
    seriesName: null,
    seriesPosition: null,
    coverUrl: null,
    imageUrl: null,
    sourceName: 'Deutsche Nationalbibliothek',
    sourceUrl: recordId ? `https://d-nb.info/${recordId}` : `https://portal.dnb.de/opac.htm?query=${encodeURIComponent(`isbn=${isbn}`)}`,
  }

  return {
    hit: Boolean(title && authors.length),
    isbn,
    recordId,
    fallbackDraft,
  }
}

export function compactDnbPayload(dnb) {
  if (!dnb?.hit) return null
  const draft = dnb.fallbackDraft ?? {}
  return {
    recordId: dnb.recordId ?? null,
    fallbackDraft: {
      title: draft.title ?? null,
      authors: draft.authors ?? [],
      description: draft.description ?? null,
      pageCount: draft.pageCount ?? null,
      publishedDate: draft.publishedDate ?? null,
      publisher: draft.publisher ?? null,
      language: draft.language ?? null,
      isbn: draft.isbn ?? dnb.isbn,
    },
    sourceUrl: draft.sourceUrl ?? null,
  }
}

export async function getDnbBookDraftByIsbn(isbnInput) {
  const isbn = normalizeIsbn(isbnInput)
  const url = `${DNB_SRU}?version=1.1&operation=searchRetrieve&maximumRecords=1&recordSchema=MARC21-xml&query=${encodeURIComponent(`isbn=${isbn}`)}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DNB_TIMEOUT_MS)

  try {
    const res = await fetch(url, { headers: HEADERS, signal: controller.signal })
    if (!res.ok) {
      return { hit: false, isbn, fallbackDraft: null, recordId: null, error: `HTTP ${res.status}` }
    }
    const xml = await res.text()
    return parseDnbMarcXml(xml, isbn)
  } catch (err) {
    const message = err.name === 'AbortError' ? 'DNB request timed out' : err.message
    return { hit: false, isbn, fallbackDraft: null, recordId: null, error: message }
  } finally {
    clearTimeout(timer)
  }
}
