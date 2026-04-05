import { db } from '../db/library.js'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export function getFromCache(id) {
  const row = db.prepare('SELECT * FROM googlebookscache WHERE id = ?').get(id)
  if (!row) return null
  if (Date.now() - row.updatedAt > SEVEN_DAYS_MS) return null
  return {
    id:             row.id,
    title:          row.title,
    authors:        JSON.parse(row.authors ?? '[]'),
    description:    row.description,
    imageUrl:       row.imageUrl,
    pageCount:      row.pageCount,
    publishedDate:  row.publishedDate,
    categories:     JSON.parse(row.categories ?? '[]'),
    rating:         row.rating,
    ratingsCount:   row.ratingsCount,
    olRating:       row.olRating ?? null,
    olRatingsCount: row.olRatingsCount ?? null,
    seriesName:     row.seriesName,
    seriesPosition: row.seriesPosition,
    publisher:      row.publisher,
    isbn:           row.isbn,
    language:       row.language,
    linkUrl:        row.linkUrl,
  }
}

export function saveToCache(book) {
  db.prepare(`
    INSERT INTO googlebookscache
      (id, title, authors, description, imageUrl, pageCount, publishedDate, categories, rating, ratingsCount, olRating, olRatingsCount, seriesName, seriesPosition, publisher, isbn, language, linkUrl, updatedAt)
    VALUES
      (@id, @title, @authors, @description, @imageUrl, @pageCount, @publishedDate, @categories, @rating, @ratingsCount, @olRating, @olRatingsCount, @seriesName, @seriesPosition, @publisher, @isbn, @language, @linkUrl, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      title=excluded.title, authors=excluded.authors, description=excluded.description,
      imageUrl=excluded.imageUrl, pageCount=excluded.pageCount, publishedDate=excluded.publishedDate,
      categories=excluded.categories, rating=excluded.rating, ratingsCount=excluded.ratingsCount,
      olRating=excluded.olRating, olRatingsCount=excluded.olRatingsCount,
      seriesName=excluded.seriesName, seriesPosition=excluded.seriesPosition,
      publisher=excluded.publisher, isbn=excluded.isbn, language=excluded.language,
      linkUrl=excluded.linkUrl, updatedAt=excluded.updatedAt
  `).run({
    ...book,
    authors: JSON.stringify(book.authors ?? []),
    categories: JSON.stringify(book.categories ?? []),
    olRating: book.olRating ?? null,
    olRatingsCount: book.olRatingsCount ?? null,
    updatedAt: Date.now(),
  })
}

export function deleteFromCache(id) {
  db.prepare('DELETE FROM googlebookscache WHERE id = ?').run(id)
}
