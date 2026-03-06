import { Router } from 'express'
import { generateSuggestionFromParams } from '../services/aiService.js'

const router = Router()

const VALID_LOCATIONS = ['bed', 'couch', 'desk']
const VALID_MOODS = ['relaxed', 'energetic', 'melancholic', 'sociable', 'focused']
const VALID_MEDIA_TYPES = ['game', 'movie', 'series']
const VALID_MODES = ['continue', 'shelved', 'new']
const VALID_MINUTES = [30, 60, 120, 180]

router.post('/suggest', async (req, res) => {
  const { location, mood, availableMinutes, mediaType, mode } = req.body ?? {}

  if (!location || !VALID_LOCATIONS.includes(location)) {
    return res.status(400).json({ error: 'location is required (bed, couch, desk)' })
  }
  if (!mood || !VALID_MOODS.includes(mood)) {
    return res.status(400).json({ error: 'mood is required (relaxed, energetic, melancholic, sociable, focused)' })
  }
  const mins = Number(availableMinutes)
  if (!Number.isFinite(mins) || !VALID_MINUTES.includes(mins)) {
    return res.status(400).json({ error: 'availableMinutes must be 30, 60, 120, or 180' })
  }
  if (!mediaType || !VALID_MEDIA_TYPES.includes(mediaType)) {
    return res.status(400).json({ error: 'mediaType is required (game, movie, series)' })
  }
  if (mediaType === 'game' && mode && !VALID_MODES.includes(mode)) {
    return res.status(400).json({ error: 'mode must be continue, shelved, or new' })
  }
  if (mediaType !== 'game' && location === 'desk') {
    return res.status(400).json({ error: 'Desk is only allowed for games' })
  }

  try {
    const suggestion = await generateSuggestionFromParams({
      location,
      mood,
      availableMinutes: mins,
      mediaType,
      mode: mediaType === 'game' ? (mode || 'continue') : undefined,
    })
    res.json(suggestion)
  } catch (err) {
    console.error('Failed to generate AI suggestion:', err)
    res.status(500).json({ error: 'AI recommendation failed', details: err.message })
  }
})

export default router
