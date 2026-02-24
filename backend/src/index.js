import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import hltbRouter     from './routes/hltb.js';
import gamesRouter    from './routes/games.js';
import sortRouter     from './routes/sortOrder.js';
import playNextRouter from './routes/playNext.js';
import adminRouter from './routes/admin.js';

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/hltb',       hltbRouter);
app.use('/api/games',      gamesRouter);
app.use('/api/sort-order', sortRouter);
app.use('/api/play-next',  playNextRouter);
app.use('/api/admin', adminRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API läuft auf Port ${PORT}`));
