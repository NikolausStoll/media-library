import 'dotenv/config'
import express, { Router } from 'express'
import cors from 'cors'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import gamesRouter   from './routes/games.js'
import moviesRouter  from './routes/movies.js'
import seriesRouter  from './routes/series.js'
import hltbRouter    from './routes/hltb.js'
import tmdbRouter    from './routes/tmdb.js'
import nextRouter    from './routes/next.js'
import sortRouter    from './routes/sortOrder.js'
import adminRouter   from './routes/admin.js'

const app = express()
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const PORT = parseInt(process.env.PORT ?? '3000', 10)
const STATIC_DIR =
  process.env.STATIC_DIR ??
  (existsSync(path.join(__dirname, '../../dist')) ? path.join(__dirname, '../../dist') : path.join(__dirname, '../../public'))
const hasStatic = STATIC_DIR && existsSync(path.join(STATIC_DIR, 'index.html'))

app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

if (!process.env.TMDB_API_KEY) {
  console.warn('TMDB_API_KEY nicht gesetzt; TMDB-Anfragen schlagen möglicherweise fehl.')
}

const apiRouter = Router()
apiRouter.use('/games', gamesRouter)
apiRouter.use('/movies', moviesRouter)
apiRouter.use('/series', seriesRouter)
apiRouter.use('/hltb', hltbRouter)
apiRouter.use('/tmdb', tmdbRouter)
apiRouter.use('/next', nextRouter)
apiRouter.use('/sort-order', sortRouter)
apiRouter.use('/admin', adminRouter)

apiRouter.get('/config', (req, res) => {
  res.json({
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: PORT,
    frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
    staticDir: hasStatic ? STATIC_DIR : null,
  })
})

app.use('/api', apiRouter)

if (hasStatic) {
  app.use(express.static(STATIC_DIR))
}

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next()
  if (!hasStatic) return res.status(404).json({ error: 'Static assets not found' })
  res.sendFile(path.join(STATIC_DIR, 'index.html'))
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`API läuft auf Port ${PORT}`)
  if (hasStatic) {
    console.log(`Serving static assets from ${STATIC_DIR}`)
  }
})
