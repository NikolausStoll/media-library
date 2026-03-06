import test from 'node:test'
import assert from 'node:assert/strict'
import { generateSuggestion } from '../src/services/aiService.js'

test('fallback suggestion uses provided context when AI key is missing', async () => {
  process.env.AI_API_KEY = ''
  const items = [
    { title: 'Mock Adventure', status: 'backlog', metadata: 'PC · Tags: RPG' },
    { title: 'Mock Shooter', status: 'started', metadata: 'Console' },
  ]

  const result = await generateSuggestion({
    mediaType: 'game',
    activeTab: 'backlog',
    prompt: 'Was könnte ich als nächstes spielen?',
    contextItems: items,
  })

  assert.ok(result.suggestion.includes('Mock Adventure'), 'Should mention a backlog item')
  assert.ok(result.contextSummary.includes('Mock Adventure'), 'Context summary should mention the item')
  assert.ok(result.message.includes('AI_API_KEY'), 'Message should describe missing API key')
})
