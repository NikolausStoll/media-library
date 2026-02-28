import fs from 'fs'
import { spawn } from 'child_process'

const OPTIONS_FILE = '/data/options.json'
let fileOptions = {}

if (fs.existsSync(OPTIONS_FILE)) {
  try {
    const raw = fs.readFileSync(OPTIONS_FILE, 'utf-8')
    fileOptions = JSON.parse(raw || '{}')
  } catch (error) {
    console.error('Failed to parse options.json:', error)
  }
}

const resolveSetting = (envName, fallback, keys = []) => {
  for (const key of keys) {
    if (fileOptions[key] != null) {
      return fileOptions[key]
    }
  }
  return process.env[envName] ?? fallback
}

const port = resolveSetting('PORT', '8099', ['port'])
const dbPath = resolveSetting('DB_PATH', '/data/backend.db', ['db_path', 'dbPath'])
const staticDir = resolveSetting('STATIC_DIR', '/app/public', ['static_dir', 'staticDir'])
const tmdbKey = resolveSetting('TMDB_API_KEY', '', ['TMDB_API_KEY', 'tmdb_api_key'])

process.env.PORT = String(port)
process.env.DB_PATH = String(dbPath)
process.env.STATIC_DIR = String(staticDir)
process.env.TMDB_API_KEY = String(tmdbKey ?? '')

console.log(tmdbKey ? 'TMDB_API_KEY set' : 'TMDB_API_KEY not set')

const backend = spawn('node', ['backend/src/index.js'], { stdio: 'inherit' })

backend.on('exit', code => {
  process.exit(code ?? 0)
})

backend.on('error', err => {
  console.error('Failed to start backend:', err)
  process.exit(1)
})
