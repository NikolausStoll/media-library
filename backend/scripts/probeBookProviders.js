#!/usr/bin/env node
/**
 * Compare Open Library vs DNB (+ optional Google Books) for a set of ISBNs.
 *
 * Usage:
 *   node scripts/probeBookProviders.js --db
 *   node scripts/probeBookProviders.js 9783404170570 9783161484100
 *   node scripts/probeBookProviders.js --file isbns.txt
 *   DB_PATH=../data/backend.db node scripts/probeBookProviders.js --db --limit 50
 *
 * Optional: GOOGLE_BOOKS_API_KEY in env for a third column.
 */

import 'dotenv/config'
import { readFileSync } from 'fs'
import fetch from 'node-fetch'
import Database from 'better-sqlite3'
import { getBookDraftSourceByIsbn } from '../src/services/openLibraryService.js'

const SCORED_FIELDS = ['title', 'authors', 'description', 'pageCount', 'publishedDate', 'publisher', 'language', 'coverUrl']
const DNB_SRU = 'https://services.dnb.de/sru/dnb'
const OL_HEADERS = {
  'User-Agent': 'MediaLibrary/1.0 (probe; media-library-app@nikolausstoll.dev)',
}

function parseArgs(argv) {
  const opts = { db: false, file: null, limit: 0, json: false, delayMs: 400 }
  const isbns = []
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--db') opts.db = true
    else if (arg === '--json') opts.json = true
    else if (arg === '--file') opts.file = argv[++i]
    else if (arg === '--limit') opts.limit = Number(argv[++i]) || 0
    else if (arg === '--delay') opts.delayMs = Number(argv[++i]) || 0
    else if (!arg.startsWith('-')) isbns.push(arg)
  }
  return { opts, isbns }
}

function normalizeIsbn(value) {
  return String(value ?? '').replace(/[^0-9Xx]/g, '')
}

function present(value) {
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return value != null
}

function countFields(record) {
  return SCORED_FIELDS.filter(field => present(record?.[field])).length
}

function isUsable(record) {
  return present(record?.title) && present(record?.authors) && countFields(record) >= 4
}

function isWeak(record) {
  if (!record?.hit) return true
  if (!present(record.title) || !present(record.authors)) return true
  return countFields(record) < 4
}

function loadIsbnsFromDb(limit) {
  const dbPath = process.env.DB_PATH ?? new URL('../backend.db', import.meta.url).pathname
  const db = new Database(dbPath, { readonly: true })
  const rows = db.prepare(`
    SELECT DISTINCT isbn FROM books
    WHERE isbn IS NOT NULL AND TRIM(isbn) != ''
    ORDER BY lastTouched DESC, id DESC
  `).all()
  db.close()
  const isbns = rows.map(r => normalizeIsbn(r.isbn)).filter(isbn => /^(97[89])?\d{9}[\dXx]$/.test(isbn))
  return limit > 0 ? isbns.slice(0, limit) : isbns
}

function loadIsbnsFromFile(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .map(line => normalizeIsbn(line.trim()))
    .filter(isbn => /^(97[89])?\d{9}[\dXx]$/.test(isbn))
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
  const f008 = xml.match(/<datafield[^>]*tag="008"[\s\S]*?<subfield code="a">([^<]*)<\/subfield>/)
  if (f008?.[1]?.length >= 4) return f008[1].slice(0, 4)
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

async function probeOpenLibrary(isbn) {
  try {
    const source = await getBookDraftSourceByIsbn(isbn)
    const draft = source.fallbackDraft ?? {}
    const hasEdition = Boolean(source.edition)
    return {
      provider: 'open-library',
      hit: hasEdition || present(draft.title),
      hasEdition,
      title: draft.title ?? null,
      authors: Array.isArray(draft.authors) ? draft.authors : [],
      description: draft.description ?? null,
      pageCount: draft.pageCount ?? null,
      publishedDate: draft.publishedDate ?? null,
      publisher: draft.publisher ?? null,
      language: draft.language ?? null,
      coverUrl: draft.coverUrl ?? draft.imageUrl ?? null,
      fieldCount: 0,
      error: null,
    }
  } catch (err) {
    return {
      provider: 'open-library',
      hit: false,
      hasEdition: false,
      title: null,
      authors: [],
      fieldCount: 0,
      error: err.message,
    }
  }
}

async function probeDnb(isbn) {
  const url = `${DNB_SRU}?version=1.1&operation=searchRetrieve&maximumRecords=1&recordSchema=MARC21-xml&query=${encodeURIComponent(`isbn=${isbn}`)}`
  try {
    const res = await fetch(url, { headers: OL_HEADERS })
    if (!res.ok) return { provider: 'dnb', hit: false, fieldCount: 0, error: `HTTP ${res.status}` }
    const xml = await res.text()
    const records = Number(xml.match(/<numberOfRecords>(\d+)<\/numberOfRecords>/)?.[1] ?? 0)
    if (!records) return { provider: 'dnb', hit: false, fieldCount: 0, error: null }

    const titleParts = marcSubfields(xml, '245', ['a', 'b'])
    const authors = [
      ...marcSubfields(xml, '100', ['a']),
      ...marcSubfields(xml, '700', ['a']),
    ]
    const publisher = marcSubfields(xml, '264', ['b'])[0] ?? marcSubfields(xml, '028', ['b'])[0] ?? null
    const publishedDate = yearFromMarc(xml)
    const pageCount = pagesFromMarc(xml)

    const record = {
      provider: 'dnb',
      hit: true,
      title: titleParts.join(' ').replace(/\s+/g, ' ').trim() || null,
      authors,
      description: null,
      pageCount,
      publishedDate,
      publisher,
      language: /ger|deu|german/i.test(xml) ? 'de' : null,
      coverUrl: null,
      error: null,
    }
    record.fieldCount = countFields(record)
    return record
  } catch (err) {
    return { provider: 'dnb', hit: false, fieldCount: 0, error: err.message }
  }
}

async function probeGoogleBooks(isbn) {
  const key = process.env.GOOGLE_BOOKS_API_KEY
  if (!key) return { provider: 'google-books', hit: false, skipped: true, fieldCount: 0 }

  const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`isbn:${isbn}`)}&langRestrict=de&maxResults=3&key=${key}`
  try {
    const res = await fetch(url)
    if (!res.ok) return { provider: 'google-books', hit: false, fieldCount: 0, error: `HTTP ${res.status}` }
    const data = await res.json()
    const item = data?.items?.[0]?.volumeInfo
    if (!item) return { provider: 'google-books', hit: false, fieldCount: 0, error: null }

    const record = {
      provider: 'google-books',
      hit: true,
      title: item.title ?? null,
      authors: item.authors ?? [],
      description: item.description ?? null,
      pageCount: item.pageCount ?? null,
      publishedDate: item.publishedDate ?? null,
      publisher: item.publisher ?? null,
      language: item.language === 'de' ? 'de' : (item.language === 'en' ? 'en' : null),
      coverUrl: item.imageLinks?.thumbnail ?? item.imageLinks?.smallThumbnail ?? null,
      error: null,
    }
    record.fieldCount = countFields(record)
    return record
  } catch (err) {
    return { provider: 'google-books', hit: false, fieldCount: 0, error: err.message }
  }
}

function extraFieldsIfMerged(base, other) {
  if (!other?.hit) return []
  return SCORED_FIELDS.filter(field => !present(base?.[field]) && present(other?.[field]))
}

function classify({ ol, dnb, gb }) {
  const olUsable = isUsable(ol)
  const olWeak = isWeak(ol)
  const dnbUsable = isUsable(dnb)
  const gbUsable = isUsable(gb)
  const dnbExtra = extraFieldsIfMerged(ol, dnb)
  const gbExtra = extraFieldsIfMerged(ol, gb)

  if (olUsable && dnbExtra.length === 0 && gbExtra.length === 0) {
    return 'ol_sufficient'
  }
  if (!ol.hit && dnb.hit) {
    return 'ol_miss_dnb_hit'
  }
  if (!ol.hit && gb.hit) {
    return 'ol_miss_gb_hit'
  }
  if (olWeak && (dnbUsable || gbUsable)) {
    return 'ol_weak_fallback_usable'
  }
  if (olWeak && dnbExtra.length > 0) {
    return 'ol_weak_dnb_fills_gaps'
  }
  if (olWeak && gbExtra.length > 0) {
    return 'ol_weak_gb_fills_gaps'
  }
  if (olWeak && !dnb.hit && (!gb.hit || gb.skipped)) {
    return 'all_weak'
  }
  if (ol.hit && dnb.hit && dnbExtra.length === 0) {
    return 'redundant_overlap'
  }
  return 'unclear'
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function printRow(cells, widths) {
  console.log(cells.map((cell, i) => String(cell ?? '').padEnd(widths[i])).join('  '))
}

async function main() {
  const { opts, isbns: cliIsbns } = parseArgs(process.argv.slice(2))
  let isbns = [...cliIsbns]

  if (opts.file) isbns.push(...loadIsbnsFromFile(opts.file))
  if (opts.db) isbns.push(...loadIsbnsFromDb(opts.limit))

  isbns = Array.from(new Set(isbns.map(normalizeIsbn))).filter(isbn => /^(97[89])?\d{9}[\dXx]$/.test(isbn))
  if (opts.limit > 0) isbns = isbns.slice(0, opts.limit)

  if (!isbns.length) {
    console.error('No ISBNs. Use --db, --file path.txt, or pass ISBNs as arguments.')
    process.exit(1)
  }

  console.log(`Probing ${isbns.length} ISBN(s)...`)
  if (!process.env.GOOGLE_BOOKS_API_KEY) {
    console.log('GOOGLE_BOOKS_API_KEY not set → Google Books column skipped.\n')
  }

  const results = []
  const summary = {
    total: isbns.length,
    ol_sufficient: 0,
    ol_miss_dnb_hit: 0,
    ol_miss_gb_hit: 0,
    ol_weak_fallback_usable: 0,
    ol_weak_dnb_fills_gaps: 0,
    ol_weak_gb_fills_gaps: 0,
    redundant_overlap: 0,
    all_weak: 0,
    unclear: 0,
  }

  for (const isbn of isbns) {
    const [ol, dnb, gb] = await Promise.all([
      probeOpenLibrary(isbn),
      probeDnb(isbn),
      probeGoogleBooks(isbn),
    ])
    ol.fieldCount = countFields(ol)
    if (!dnb.fieldCount) dnb.fieldCount = countFields(dnb)
    const verdict = classify({ ol, dnb, gb })
    summary[verdict] = (summary[verdict] ?? 0) + 1

    const row = {
      isbn,
      verdict,
      ol: `${ol.hit ? ol.fieldCount : '–'}/${ol.hasEdition ? 'ed' : 'no-ed'}`,
      dnb: dnb.hit ? dnb.fieldCount : '–',
      gb: gb.skipped ? 'skip' : (gb.hit ? gb.fieldCount : '–'),
      dnbExtra: extraFieldsIfMerged(ol, dnb).join(',') || '–',
      gbExtra: extraFieldsIfMerged(ol, gb).join(',') || '–',
      title: ol.title ?? dnb.title ?? gb.title ?? '',
    }
    results.push({ isbn, verdict, ol, dnb, gb, title: row.title })

    if (!opts.json) {
      const widths = [15, 22, 8, 5, 5, 18, 18, 28]
      if (results.length === 1) {
        printRow(['ISBN', 'Verdict', 'OL fld', 'DNB', 'GB', 'DNB extra', 'GB extra', 'Title'], widths)
        printRow(widths.map(w => '─'.repeat(w)), widths)
      }
      printRow([row.isbn, row.verdict, row.ol, row.dnb, row.gb, row.dnbExtra, row.gbExtra, row.title.slice(0, 28)], widths)
    }

    if (opts.delayMs > 0) await sleep(opts.delayMs)
  }

  const cascadeWorthwhile = summary.ol_miss_dnb_hit + summary.ol_miss_gb_hit +
    summary.ol_weak_fallback_usable + summary.ol_weak_dnb_fills_gaps + summary.ol_weak_gb_fills_gaps
  const pct = (n) => `${Math.round((n / summary.total) * 100)}%`

  console.log('\n=== Summary ===')
  console.log(`Total:                    ${summary.total}`)
  console.log(`OL sufficient:            ${summary.ol_sufficient} (${pct(summary.ol_sufficient)})`)
  console.log(`OL miss, DNB hit:         ${summary.ol_miss_dnb_hit} (${pct(summary.ol_miss_dnb_hit)})`)
  console.log(`OL miss, GB hit:          ${summary.ol_miss_gb_hit} (${pct(summary.ol_miss_gb_hit)})`)
  console.log(`OL weak, fallback usable: ${summary.ol_weak_fallback_usable} (${pct(summary.ol_weak_fallback_usable)})`)
  console.log(`OL weak, DNB fills gaps:  ${summary.ol_weak_dnb_fills_gaps} (${pct(summary.ol_weak_dnb_fills_gaps)})`)
  console.log(`OL weak, GB fills gaps:   ${summary.ol_weak_gb_fills_gaps} (${pct(summary.ol_weak_gb_fills_gaps)})`)
  console.log(`Redundant overlap:        ${summary.redundant_overlap} (${pct(summary.redundant_overlap)})`)
  console.log(`All weak:                 ${summary.all_weak} (${pct(summary.all_weak)})`)
  console.log(`Unclear:                  ${summary.unclear} (${pct(summary.unclear)})`)
  console.log(`\nPotential cascade value:  ${cascadeWorthwhile} (${pct(cascadeWorthwhile)})`)
  console.log('\nRule of thumb:')
  console.log('  <10%  → stay with OL + LLM')
  console.log('  10–20% → maybe minimal DNB fallback only')
  console.log('  >20%  → cascade likely worth it')

  if (opts.json) {
    console.log(JSON.stringify({ summary, results }, null, 2))
  }
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
