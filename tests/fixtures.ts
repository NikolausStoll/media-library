export const ZELDA = {
  id: '1',
  externalId: '10101',
  name: 'The Legend of Zelda: Tears of the Kingdom',
  status: 'backlog',
  coverUrl: null,
  imageUrl: null,
  rating: null,
  gameplayAll: null,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
  tags: [] as string[],
}

export const MARIO = {
  id: '2',
  externalId: '20202',
  name: 'Super Mario Odyssey',
  status: 'started',
  coverUrl: null,
  imageUrl: null,
  rating: 9,
  gameplayAll: 12,
  platforms: [{ platform: 'switch', storefront: 'nintendo' }],
  tags: [] as string[],
}

export const METROID = {
  id: '3',
  externalId: '30303',
  name: 'Metroid Dread',
  status: 'backlog',
  coverUrl: null,
  imageUrl: null,
  rating: null,
  gameplayAll: null,
  platforms: [{ platform: 'pc', storefront: 'steam' }],
  tags: [] as string[],
}

export const HOBBIT = {
  id: '10',
  title: 'The Hobbit',
  status: 'backlog',
  authors: ['J.R.R. Tolkien'],
  formats: [{ format: 'paperback' }],
  imageUrl: null,
  pageCount: 310,
  userRating: null,
  language: 'en',
}

export const DUNE = {
  id: '11',
  title: 'Dune',
  status: 'started',
  authors: ['Frank Herbert'],
  formats: [{ format: 'hardcover' }],
  imageUrl: null,
  pageCount: 688,
  userRating: 9,
  language: 'en',
}

export const FOUNDATION = {
  id: '12',
  title: 'Foundation',
  status: 'backlog',
  authors: ['Isaac Asimov'],
  formats: [{ format: 'paperback' }],
  imageUrl: null,
  pageCount: 255,
  userRating: null,
  language: 'en',
}

export const EBOOK_BOOK = {
  id: '13',
  title: 'Project Hail Mary',
  status: 'backlog',
  authors: ['Andy Weir'],
  formats: [{ format: 'ebook' }],
  imageUrl: null,
  pageCount: 496,
  userRating: null,
  language: 'de',
}

export const PAUSED_SERIES = {
  id: '32',
  externalId: '1402',
  title: 'The Walking Dead',
  titleDe: 'The Walking Dead',
  status: 'paused',
  year: '2010',
  imageUrl: null,
  rating: 8.2,
  runtime: 44,
  seasonCount: 11,
  episodeCount: 177,
  genres: ['Drama'],
  streamingProviders: [{ id: 8, name: 'Netflix', logo: '/streamingProviders/netflix.webp' }],
  userRating: null,
  providers: ['netflix'],
}

export const INCEPTION = {
  id: '20',
  externalId: '27205',
  title: 'Inception',
  titleDe: 'Inception',
  status: 'watchlist',
  year: '2010',
  imageUrl: null,
  rating: 8.4,
  runtime: 148,
  genres: ['Action', 'Sci-Fi'],
  streamingProviders: [{ id: 8, name: 'Netflix', logo: '/streamingProviders/netflix.webp' }],
  userRating: null,
  releaseDateDe: '2010-07-15',
  providers: ['netflix'],
}

export const INTERSTELLAR = {
  id: '21',
  externalId: '157336',
  title: 'Interstellar',
  titleDe: 'Interstellar',
  status: 'finished',
  year: '2014',
  imageUrl: null,
  rating: 8.7,
  runtime: 169,
  genres: ['Adventure', 'Sci-Fi'],
  streamingProviders: [],
  userRating: 9,
  releaseDateDe: '2014-11-06',
  providers: [],
}

export const BREAKING_BAD = {
  id: '30',
  externalId: '1396',
  title: 'Breaking Bad',
  titleDe: 'Breaking Bad',
  status: 'watching',
  year: '2008',
  imageUrl: null,
  rating: 9.5,
  runtime: 47,
  seasonCount: 5,
  episodeCount: 62,
  genres: ['Drama', 'Crime'],
  streamingProviders: [{ id: 8, name: 'Netflix', logo: '/streamingProviders/netflix.webp' }],
  userRating: null,
  providers: ['netflix'],
}

export const THE_OFFICE = {
  id: '31',
  externalId: '2316',
  title: 'The Office',
  titleDe: 'The Office',
  status: 'watchlist',
  year: '2005',
  imageUrl: null,
  rating: 8.9,
  runtime: 22,
  seasonCount: 9,
  episodeCount: 201,
  genres: ['Comedy'],
  streamingProviders: [],
  userRating: null,
  providers: [],
}

export const SAMPLE_EPISODES = [
  { season: 1, episode: 1, titleEn: 'Pilot', airDate: '2008-01-20', runtime: 58 },
  { season: 1, episode: 2, titleEn: 'Cat in the Bag', airDate: '2008-01-27', runtime: 48 },
]
