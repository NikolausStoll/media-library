import fetch from 'node-fetch'
import { ALLOWED_PROVIDER_IDS } from '../config/providers.js'

const BASEURL = 'https://api.themoviedb.org/3'
const IMGBASE = 'https://image.tmdb.org/t/p/w500'

function buildUrl(path, params = {}) {
  const url = new URL(`${BASEURL}${path}`)
  url.searchParams.set('api_key', process.env.TMDB_API_KEY)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return url.toString()
}

function extractProviders(data) {
  return data['watch/providers']?.results?.DE?.flatrate
    ?.filter(p => ALLOWED_PROVIDER_IDS.has(p.provider_id))
    ?.map(p => ({
      id:   p.provider_id,
      name: p.provider_name,
      logo: `https://image.tmdb.org/t/p/w45${p.logo_path}`
    })) ?? []
}

export async function searchMedia(query, type = 'movie') {
  const endpoint = type === 'movie' ? '/search/movie' : '/search/tv'
  const [resDe, resEn] = await Promise.all([
    fetch(buildUrl(endpoint, { query, language: 'de-DE' })),
    fetch(buildUrl(endpoint, { query, language: 'en-US' }))
  ])
  if (!resDe.ok) throw new Error(`TMDB search fehlgeschlagen: ${resDe.status}`)
  const [de, en] = await Promise.all([resDe.json(), resEn.json()])
  const enMap = new Map((en.results ?? []).map(r => [r.id, r]))

  return (de.results ?? []).slice(0, 20).map(r => {
    const enItem = enMap.get(r.id)
    const isGerman = r.original_language === 'de'
    return {
      id:      String(r.id),
      titleEn: isGerman
                 ? (enItem?.title ?? enItem?.name ?? null)
                 : (r.original_title ?? r.original_name ?? null),
      titleDe: r.title ?? r.name ?? null,
      imageUrl: r.poster_path ? `${IMGBASE}${r.poster_path}` : null,
      year:    (r.release_date ?? r.first_air_date ?? '').slice(0, 4) || null,
      rating:  r.vote_average ?? null,
      // Genres kommen erst beim Detail-Fetch (Search liefert nur IDs)
    }
  })
}

export async function getMovie(id) {
  const [resDe, resEn] = await Promise.all([
    fetch(buildUrl(`/movie/${id}`, {
      append_to_response: 'release_dates,watch/providers',
      language: 'de-DE'   // titleDe, certification (FSK), streamingProviders (DE)
    })),
    fetch(buildUrl(`/movie/${id}`, {
      language: 'en-US'   // titleEn, genres
    }))
  ])
  if (!resDe.ok) throw new Error(`TMDB movie nicht gefunden: ${resDe.status}`)
  const [de, en] = await Promise.all([resDe.json(), resEn.json()])

  const certDE = de.release_dates?.results
    ?.find(r => r.iso_3166_1 === 'DE')
    ?.release_dates?.find(d => d.certification)
    ?.certification ?? null

  const isGerman = de.original_language === 'de'

  return {
    id:                 String(id),
    mediaType:          'movie',
    titleEn:            isGerman ? (en.title ?? null) : (en.original_title ?? en.title ?? null),
    titleDe:            de.title ?? null,
    imageUrl:           de.poster_path ? `${IMGBASE}${de.poster_path}` : null,
    year:               de.release_date?.slice(0, 4) ?? null,
    certification:      certDE,
    rating:             de.vote_average ?? null,
    runtime:            de.runtime ?? null,
    seasons:            null,
    episodes:           null,
    genres:             JSON.stringify(en.genres?.map(g => g.name) ?? []),
    streamingProviders: JSON.stringify(extractProviders(de)),
    linkUrl:            `https://www.themoviedb.org/movie/${id}`,
    originalLang:       de.original_language ?? null,
  }
}

export async function getSeries(id) {
  const [resDe, resEn] = await Promise.all([
    fetch(buildUrl(`/tv/${id}`, {
      append_to_response: 'content_ratings,watch/providers',
      language: 'de-DE'   // titleDe, certification, streamingProviders (DE)
    })),
    fetch(buildUrl(`/tv/${id}`, {
      language: 'en-US'   // titleEn, genres
    }))
  ])
  if (!resDe.ok) throw new Error(`TMDB series nicht gefunden: ${resDe.status}`)
  const [de, en] = await Promise.all([resDe.json(), resEn.json()])

  const certDE = de.content_ratings?.results
    ?.find(r => r.iso_3166_1 === 'DE')
    ?.rating ?? null

  const isGerman = de.original_language === 'de'

  return {
    id:                 String(id),
    mediaType:          'series',
    titleEn:            isGerman ? (en.name ?? null) : (en.original_name ?? en.name ?? null),
    titleDe:            de.name ?? null,
    imageUrl:           de.poster_path ? `${IMGBASE}${de.poster_path}` : null,
    year:               de.first_air_date?.slice(0, 4) ?? null,
    certification:      certDE,
    rating:             de.vote_average ?? null,
    runtime:            de.episode_run_time?.[0] ?? null,
    seasons:            de.number_of_seasons ?? null,
    episodes:           de.number_of_episodes ?? null,
    genres:             JSON.stringify(en.genres?.map(g => g.name) ?? []),
    streamingProviders: JSON.stringify(extractProviders(de)),
    linkUrl:            `https://www.themoviedb.org/tv/${id}`,
    originalLang:       de.original_language ?? null,
  }
}
