import { Router } from 'express'
import { generateSuggestion } from '../services/aiService.js'

const router = Router()

router.post('/suggest', async (req, res) => {
  const { mediaType, activeTab, prompt, contextItems } = req.body
  if (!mediaType || !activeTab || !(prompt ?? '').trim()) {
    return res.status(400).json({ error: 'mediaType, activeTab und prompt sind erforderlich' })
  }

  try {
    const suggestion = await generateSuggestion({ mediaType, activeTab, prompt, contextItems })
    res.json(suggestion)
  } catch (err) {
    console.error('Failed to generate AI suggestion:', err)
    res.status(500).json({ error: 'KI-Empfehlung fehlgeschlagen', details: err.message })
  }
})

export default router
