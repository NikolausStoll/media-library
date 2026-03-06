import Database from 'better-sqlite3'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = process.env.DB_PATH ?? join(__dirname, '../..', 'backend.db')
const db = new Database(dbPath)

const today = new Date().toISOString().slice(0, 10)

const applyCompletion = (table, status) => {
  const updated = db
    .prepare(
      `UPDATE ${table} SET completedAt = COALESCE(completedAt, ?), lastTouched = COALESCE(lastTouched, ?) WHERE status = ?`,
    )
    .run(today, today, status).changes
  console.log(`${table}: ${updated} rows marked as completed`)
}

const touchTable = (table) => {
  const updated = db.prepare(`UPDATE ${table} SET lastTouched = COALESCE(lastTouched, ?)`).run(today)
  console.log(`${table}: ${updated.changes} rows received a lastTouched stamp`)
}

try {
  applyCompletion('games', 'completed')
  applyCompletion('movies', 'finished')
  applyCompletion('series', 'finished')
  touchTable('games')
  touchTable('movies')
  touchTable('series')
  db.prepare('UPDATE episodeprogress SET lastTouched = COALESCE(lastTouched, ?)').run(today)
  console.log('episodeprogress: ensured lastTouched')
} catch (err) {
  console.error('Failed to seed completion dates', err)
  process.exit(1)
} finally {
  db.close()
}
