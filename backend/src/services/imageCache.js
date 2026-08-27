import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, renameSync } from 'node:fs'
import { dirname, join } from 'node:path'
import fetch from 'node-fetch'
import sharp from 'sharp'

const DAY_MS = 24 * 60 * 60 * 1000
const INITIAL_INTERVAL_MS = 7 * DAY_MS
const INTERVALS_MS = [INITIAL_INTERVAL_MS, 14 * DAY_MS, 30 * DAY_MS]
const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const dbPath = process.env.DB_PATH ?? join(process.cwd(), 'backend.db')
const uploadsRoot = process.env.UPLOAD_DIR ?? join(dirname(dbPath), 'uploads')
const IMAGE_QUALITY = parseInt(process.env.IMAGE_QUALITY ?? '80', 10)
const IMAGE_MAX_DIMENSION = parseInt(process.env.IMAGE_MAX_DIMENSION ?? '1200', 10)
const IMAGE_QUALITY_THUMB = parseInt(process.env.IMAGE_QUALITY_THUMB ?? '80', 10)
const IMAGE_MAX_DIMENSION_THUMB = parseInt(process.env.IMAGE_MAX_DIMENSION_THUMB ?? '600', 10)

function isFutureRelease(value) {
  if (!value) return false
  const normalized = String(value).trim()
  const year = Number(normalized.slice(0, 4))
  if (!Number.isInteger(year)) return false
  if (normalized.length === 4) return year > new Date().getFullYear()
  const timestamp = Date.parse(normalized)
  return !Number.isNaN(timestamp) && timestamp > Date.now()
}

function getInterval(existing, futureRelease, unchangedChecks) {
  if (futureRelease) return INITIAL_INTERVAL_MS
  const current = Math.max(0, INTERVALS_MS.indexOf(existing?.imageCheckIntervalMs ?? INITIAL_INTERVAL_MS))
  const next = unchangedChecks > 0 ? current + 1 : current
  return INTERVALS_MS[Math.min(next, INTERVALS_MS.length - 1)]
}

function checkedMetadata(existing, updates, futureRelease, changed = false) {
  const unchangedChecks = changed ? 0 : (existing?.imageUnchangedChecks ?? 0) + 1
  return {
    ...existing,
    ...updates,
    imageCheckedAt: Date.now(),
    imageCheckIntervalMs: changed
      ? INITIAL_INTERVAL_MS
      : getInterval(existing, futureRelease, unchangedChecks),
    imageUnchangedChecks: unchangedChecks,
  }
}

function localFileExists(imagePath) {
  if (!imagePath) return false
  return existsSync(join(uploadsRoot, imagePath.replace(/^\/uploads\//, '')))
}

function imageIsDue(existing, sourceUrl, force, futureRelease) {
  if (force || existing.sourceImageUrl !== sourceUrl || !localFileExists(existing.imagePath)) return true
  const interval = futureRelease ? INITIAL_INTERVAL_MS : (existing.imageCheckIntervalMs ?? INITIAL_INTERVAL_MS)
  return !existing.imageCheckedAt || Date.now() - existing.imageCheckedAt >= interval
}

function localNames(mediaType, externalId) {
  const safeId = String(externalId).replace(/[^a-zA-Z0-9_-]/g, '_')
  const folder = `${mediaType}s`
  return {
    directory: join(uploadsRoot, 'images', folder),
    path: `/uploads/images/${folder}/${safeId}.webp`,
    thumbPath: `/uploads/images/${folder}/${safeId}-thumb.webp`,
    safeId,
  }
}

async function writeWebp(bytes, filename, dimension, quality) {
  const temporary = `${filename}.tmp-${process.pid}-${Date.now()}`
  await sharp(bytes)
    .rotate()
    .resize({ width: dimension, height: dimension, fit: 'inside', withoutEnlargement: true })
    .webp({ quality })
    .toFile(temporary)
  renameSync(temporary, filename)
}

export async function syncImage({ mediaType, externalId, sourceUrl, existing = {}, force = false, releaseDate = null }) {
  const futureRelease = isFutureRelease(releaseDate)
  const names = localNames(mediaType, externalId)
  if (!sourceUrl || !imageIsDue(existing, sourceUrl, force, futureRelease)) return { ...existing }

  const headers = {
    Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
  }
  const sourceHost = new URL(sourceUrl).hostname
  if (sourceHost === 'howlongtobeat.com' || sourceHost.endsWith('.howlongtobeat.com')) {
    headers.Referer = 'https://howlongtobeat.com/'
    headers.Origin = 'https://howlongtobeat.com'
  }
  if (existing.sourceImageUrl === sourceUrl && existing.imageETag) headers['If-None-Match'] = existing.imageETag
  if (existing.sourceImageUrl === sourceUrl && existing.imageLastModified) headers['If-Modified-Since'] = existing.imageLastModified

  try {
    const response = await fetch(sourceUrl, { headers })
    if (response.status === 304 && localFileExists(existing.imagePath))
      return checkedMetadata(existing, {}, futureRelease)
    if (!response.ok) throw new Error(`Bild konnte nicht geladen werden: HTTP ${response.status}`)
    const contentType = response.headers.get('content-type') ?? ''
    if (contentType && !contentType.startsWith('image/')) throw new Error('Bildquelle liefert kein Bild')
    const bytes = Buffer.from(await response.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_IMAGE_BYTES) throw new Error('Bild ist leer oder zu groß')

    const imageHash = createHash('sha256').update(bytes).digest('hex')
    const headersMetadata = {
      sourceImageUrl: sourceUrl,
      imageHash,
      imageETag: response.headers.get('etag'),
      imageLastModified: response.headers.get('last-modified'),
    }
    if (existing.sourceImageUrl === sourceUrl && imageHash === existing.imageHash && localFileExists(existing.imagePath))
      return checkedMetadata(existing, headersMetadata, futureRelease)

    mkdirSync(names.directory, { recursive: true })
    await writeWebp(bytes, join(names.directory, `${names.safeId}.webp`), IMAGE_MAX_DIMENSION, IMAGE_QUALITY)
    await writeWebp(bytes, join(names.directory, `${names.safeId}-thumb.webp`), IMAGE_MAX_DIMENSION_THUMB, IMAGE_QUALITY_THUMB)
    return checkedMetadata(existing, {
      ...headersMetadata,
      imagePath: names.path,
      imageThumbPath: names.thumbPath,
    }, futureRelease, true)
  } catch (error) {
    if (existing.imagePath) return { ...existing }
    throw error
  }
}

export function imageUrlFromCache(cache, fallback = null) {
  return cache?.imageThumbPath ?? cache?.imagePath ?? fallback
}

export function imageFullUrlFromCache(cache, fallback = null) {
  return cache?.imagePath ?? cache?.sourceImageUrl ?? fallback
}