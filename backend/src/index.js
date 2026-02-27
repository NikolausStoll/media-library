import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import gamesRouter   from './routes/games.js'
import moviesRouter  from './routes/movies.js'
import seriesRouter  from './routes/series.js'
import hltbRouter    from './routes/hltb.js'
import tmdbRouter    from './routes/tmdb.js'
import nextRouter    from './routes/next.js'
import sortRouter    from './routes/sortOrder.js'
import adminRouter   from './routes/admin.js'

const app = express()
app.use(cors({ origin: process.env.FRONTEND_URL ?? 'http://localhost:5173' }))
app.use(express.json())

app.use('/api/games',      gamesRouter)
app.use('/api/movies',     moviesRouter)
app.use('/api/series',     seriesRouter)
app.use('/api/hltb',       hltbRouter)
app.use('/api/tmdb',       tmdbRouter)
app.use('/api/next',       nextRouter)
app.use('/api/sort-order', sortRouter)
app.use('/api/admin',      adminRouter)

const PORT = process.env.PORT ?? 8787
app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`))
