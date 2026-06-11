const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function validYear(year) {
  const n = Number(year)
  return Number.isInteger(n) && n >= 1000 && n <= 9999
}

function validMonth(month) {
  const n = Number(month)
  return Number.isInteger(n) && n >= 1 && n <= 12
}

function validDay(year, month, day) {
  const y = Number(year)
  const m = Number(month)
  const d = Number(day)
  if (!validYear(y) || !validMonth(m) || !Number.isInteger(d) || d < 1 || d > 31) return false
  const date = new Date(Date.UTC(y, m - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d
}

function monthNumber(value) {
  return MONTHS[String(value ?? '').trim().toLowerCase()] ?? null
}

function normalizedOrThrow(value, strict) {
  if (!strict) return null
  throw new Error('publishedDate muss im Format YYYY-MM-DD, YYYY-MM oder YYYY vorliegen')
}

export function normalizeBookPublishedDate(value, { strict = false } = {}) {
  if (value === undefined) return undefined
  if (value === null || value === '') return null

  const raw = String(value).trim()
  if (!raw) return null

  const iso = raw.match(/^(\d{4})(?:-(\d{1,2})(?:-(\d{1,2}))?)?$/)
  if (iso) {
    const [, year, month, day] = iso
    if (!validYear(year)) return normalizedOrThrow(value, strict)
    if (!month) return year
    if (!validMonth(month)) return normalizedOrThrow(value, strict)
    if (!day) return `${year}-${pad2(month)}`
    if (!validDay(year, month, day)) return normalizedOrThrow(value, strict)
    return `${year}-${pad2(month)}-${pad2(day)}`
  }

  const monthDayYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monthDayYear) {
    const month = monthNumber(monthDayYear[1])
    if (month && validDay(monthDayYear[3], month, monthDayYear[2]))
      return `${monthDayYear[3]}-${pad2(month)}-${pad2(monthDayYear[2])}`
  }

  const dayMonthYear = raw.match(/^(\d{1,2})\s+([A-Za-z]+)\.?\s+(\d{4})$/)
  if (dayMonthYear) {
    const month = monthNumber(dayMonthYear[2])
    if (month && validDay(dayMonthYear[3], month, dayMonthYear[1]))
      return `${dayMonthYear[3]}-${pad2(month)}-${pad2(dayMonthYear[1])}`
  }

  const monthYear = raw.match(/^([A-Za-z]+)\.?\s+(\d{4})$/)
  if (monthYear) {
    const month = monthNumber(monthYear[1])
    if (month && validYear(monthYear[2])) return `${monthYear[2]}-${pad2(month)}`
  }

  return normalizedOrThrow(value, strict)
}
