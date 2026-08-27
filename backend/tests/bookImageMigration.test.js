import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const testDir = mkdtempSync(join(tmpdir(), 'media-library-book-migration-'))
process.env.DB_PATH = join(testDir, 'test.db')
process.env.UPLOAD_DIR = join(testDir, 'uploads')

const { db } = await import('../src/db/library.js')
const oldDirectory = join(testDir, 'uploads', 'books')
const oldFilename = 'legacy-cover.webp'
const oldFile = join(oldDirectory, oldFilename)
const newFile = join(testDir, 'uploads', 'images', 'books', oldFilename)
mkdirSync(oldDirectory, { recursive: true })
writeFileSync(oldFile, 'cover')
const { lastInsertRowid } = db.prepare(
  'INSERT INTO books (title, status, coverPath, coverThumbPath) VALUES (?, ?, ?, ?)',
).run('Legacy Book', 'backlog', `/uploads/books/${oldFilename}`, `/uploads/books/${oldFilename}`)

await import('../src/routes/books.js')

test.after(() => {
  db.close()
  rmSync(testDir, { recursive: true, force: true })
})

test('migrates legacy book covers to the shared image directory', () => {
  const book = db.prepare('SELECT coverPath, coverThumbPath FROM books WHERE id = ?').get(lastInsertRowid)

  assert.equal(book.coverPath, `/uploads/images/books/${oldFilename}`)
  assert.equal(book.coverThumbPath, `/uploads/images/books/${oldFilename}`)
  assert.equal(existsSync(oldFile), false)
  assert.equal(readFileSync(newFile, 'utf8'), 'cover')
})