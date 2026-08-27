import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'

const testDir = mkdtempSync(join(tmpdir(), 'media-library-image-test-'))
process.env.UPLOAD_DIR = join(testDir, 'uploads')

const { syncImage } = await import('../src/services/imageCache.js')

const imageBytes = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
)

let server
let sourceUrl
let requests

test.before(async () => {
  requests = []
  server = createServer((req, res) => {
    requests.push(req)
    if (req.headers['if-none-match'] === '"cover-v1"') {
      res.writeHead(304)
      res.end()
      return
    }
    res.writeHead(200, { 'content-type': 'image/png', etag: '"cover-v1"' })
    res.end(imageBytes)
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  sourceUrl = `http://127.0.0.1:${server.address().port}/cover.png`
})

test.after(() => {
  server.close()
  rmSync(testDir, { recursive: true, force: true })
})

test('stores a local WebP and reuses it for unchanged responses', async () => {
  const first = await syncImage({ mediaType: 'movie', externalId: 'image-1', sourceUrl })
  const imageFile = join(testDir, 'uploads', first.imagePath.replace('/uploads/', ''))
  const firstMtime = statSync(imageFile).mtimeMs

  const second = await syncImage({
    mediaType: 'movie',
    externalId: 'image-1',
    sourceUrl,
    existing: first,
    force: true,
  })

  assert.equal(second.imageHash, first.imageHash)
  assert.equal(statSync(imageFile).mtimeMs, firstMtime)
  assert.equal(readFileSync(imageFile).subarray(0, 4).toString('hex'), '52494646')
  assert.equal(requests.length, 2)
  assert.equal(requests[1].headers['if-none-match'], '"cover-v1"')
})