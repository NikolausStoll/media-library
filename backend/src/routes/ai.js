import { Router } from 'express'
import { generateSuggestionFromParams } from '../services/aiService.js'

const router = Router()

const VALID_MEDIA_TYPES = ['game', 'movie', 'series']
const VALID_MODES = ['whats-next', 'new-recommendation']
const VALID_SESSION_HINTS = ['short', 'long', 'any']
const VALID_EPISODE_LENGTHS = ['20-30', '45+', 'any']
const VALID_MINUTES = [30, 60, 120, 180]
const VALID_PLATFORMS = ['pc', 'xbox', 'switch', '3ds']

router.post('/suggest', async (req, res) => {
  const {
    mediaType,
    mode,
    platformFilter,
    sessionHint,
    availableMinutes,
    episodeLength,
    streamingOnly,
  } = req.body ?? {}

  if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType is required (game, movie, series)' })
  }
  if (!mode || !VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: 'mode is required (whats-next, new-recommendation)' })
  }

  const params = { mediaType, mode }

  if (mediaType === 'game') {
    if (Array.isArray(platformFilter) && platformFilter.length) {
      const invalid = platformFilter.filter((p) => !VALID_PLATFORMS.includes(p))
      if (invalid.length) {
        return res.status(400).json({ error: `Invalid platform(s): ${invalid.join(', ')}` })
      }
      params.platformFilter = platformFilter
    }
    if (mode === 'whats-next') {
      params.sessionHint = VALID_SESSION_HINTS.includes(sessionHint) ? sessionHint : 'any'
    } else {
      const mins = Number(availableMinutes)
      if (Number.isFinite(mins) && VALID_MINUTES.includes(mins)) {
        params.availableMinutes = mins
      }
    }
  }

  if (mediaType === 'series' && mode === 'new-recommendation') {
    params.episodeLength = VALID_EPISODE_LENGTHS.includes(episodeLength) ? episodeLength : 'any'
  }

  if ((mediaType === 'movie' || mediaType === 'series') && mode === 'whats-next') {
    params.streamingOnly = Boolean(streamingOnly)
  }

  try {
    const suggestion = await generateSuggestionFromParams(params)
    res.json(suggestion)
  } catch (err) {
    console.error('Failed to generate AI suggestion:', err)
    res.status(500).json({ error: 'AI recommendation failed', details: err.message })
  }
})

export default router
