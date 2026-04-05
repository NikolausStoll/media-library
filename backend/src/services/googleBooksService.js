import fetch from 'node-fetch'
import { getRatingByIsbn } from './openLibraryService.js'

const API_BASE = 'https://www.googleapis.com/books/v1'
const PAGE_SIZE = 20

function extractSeriesInfo(volumeInfo) {
  const title = volumeInfo.title ?? ''
  const subtitle = volumeInfo.subtitle ?? ''

  if (volumeInfo.seriesInfo) {
    return {
      seriesName: volumeInfo.seriesInfo.shortSeriesBookTitle ?? null,
      seriesPosition: volumeInfo.seriesInfo.bookDisplayNumber ?? null,
    }
  }

  const titlePatterns = [
    /\(([^)]+?)(?:\s*[#,]\s*(?:Book\s+)?(\d+(?:\.\d+)?))\)/i,
    /\(([^)]+?)\s+Series(?:\s*[#,]\s*(?:Book\s+)?(\d+(?:\.\d+)?))?\)/i,
  ]

  const fullTitle = subtitle ? `${title} (${subtitle})` : title

  for (const pattern of titlePatterns) {
    const match = fullTitle.match(pattern)
    if (match) {
      return { seriesName: match[1].trim(), seriesPosition: match[2] ?? null }
    }
  }

  const subtitlePatterns = [
    /^(?:Book\s+)?(\d+)\s+(?:of|in)\s+(?:the\s+)?(.+?)(?:\s+Series)?$/i,
    /^(.+?)\s+Series,?\s+(?:Book\s+)?#?(\d+)/i,
    /^(?:A\s+)?(.+?)\s+Novel(?:\s*[#,]\s*(\d+))?/i,
  ]

  if (subtitle) {
    for (const pattern of subtitlePatterns) {
      const match = subtitle.match(pattern)
      if (match) {
        if (pattern === subtitlePatterns[0]) {
          return { seriesName: match[2].trim(), seriesPosition: match[1] }
        }
        return { seriesName: match[1].trim(), seriesPosition: match[2] ?? null }
      }
    }
  }

  return { seriesName: null, seriesPosition: null }
}

function mapVolume(item) {
  const v = item.volumeInfo ?? {}
  const series = extractSeriesInfo(v)
  const identifiers = v.industryIdentifiers ?? []
  const isbn = identifiers.find(i => i.type === 'ISBN_13')?.identifier
    ?? identifiers.find(i => i.type === 'ISBN_10')?.identifier
    ?? null

  let imageUrl = v.imageLinks?.thumbnail ?? v.imageLinks?.smallThumbnail ?? null
  if (imageUrl) {
    imageUrl = imageUrl.replace('http://', 'https://')
    imageUrl = imageUrl.replace(/&edge=curl/g, '')
  }

  return {
    id: item.id,
    title: v.title ?? '',
    authors: v.authors ?? [],
    description: v.description ?? null,
    imageUrl,
    pageCount: v.pageCount ?? null,
    publishedDate: v.publishedDate ?? null,
    categories: v.categories ?? [],
    rating: v.averageRating ?? null,
    ratingsCount: v.ratingsCount ?? null,
    seriesName: series.seriesName,
    seriesPosition: series.seriesPosition,
    publisher: v.publisher ?? null,
    isbn,
    language: v.language ?? null,
    linkUrl: v.infoLink ?? v.canonicalVolumeLink ?? null,
  }
}

export async function searchBooks(query) {
  const url = `${API_BASE}/volumes?q=${encodeURIComponent(query)}&maxResults=${PAGE_SIZE}&printType=books&orderBy=relevance`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Books search failed: HTTP ${res.status}`)
  const json = await res.json()
  return (json.items ?? []).map(mapVolume)
}

export async function getBook(id) {
  const url = `${API_BASE}/volumes/${encodeURIComponent(id)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Books fetch failed: HTTP ${res.status}`)
  const item = await res.json()
  const book = mapVolume(item)

  if (book.isbn) {
    try {
      const olRating = await getRatingByIsbn(book.isbn)
      if (olRating) {
        book.olRating = olRating.average
        book.olRatingsCount = olRating.count
      }
    } catch (err) {
      console.error(`Open Library rating fetch failed for ISBN ${book.isbn}:`, err.message)
    }
  }

  return book
}
