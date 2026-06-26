import express from 'express'
import { createServer } from 'node:http'

export function createTestApp(mounts) {
  const app = express()
  app.use(express.json())
  for (const [path, router] of mounts) {
    app.use(path, router)
  }
  return app
}

export async function withServer(app, run) {
  const server = createServer(app)
  await new Promise(resolve => server.listen(0, resolve))
  const { port } = server.address()
  const baseUrl = `http://127.0.0.1:${port}`
  try {
    return await run(baseUrl)
  } finally {
    await new Promise((resolve, reject) => {
      server.close(err => (err ? reject(err) : resolve()))
    })
  }
}

export async function requestJson(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    ...options,
  })
  const text = await res.text()
  let body = null
  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
  }
  return { status: res.status, body }
}
