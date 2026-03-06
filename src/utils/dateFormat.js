const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/
const DDMMYYYY_REGEX = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

export function formatDateDDMMYYYY(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (!ISO_DATE_REGEX.test(trimmed)) return trimmed
  const [year, month, day] = trimmed.split('-')
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`
}

/**
 * Parses DD.MM.YYYY or YYYY-MM-DD to YYYY-MM-DD. Returns null for empty or invalid input.
 */
export function parseToISODate(value) {
  if (value === undefined || value === null) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null

  if (ISO_DATE_REGEX.test(trimmed)) return trimmed

  const match = trimmed.match(DDMMYYYY_REGEX)
  if (!match) return null
  const [, dayStr, monthStr, yearStr] = match
  const day = parseInt(dayStr, 10)
  const month = parseInt(monthStr, 10)
  const year = parseInt(yearStr, 10)
  if (month < 1 || month > 12) return null
  const lastDay = new Date(year, month, 0).getDate()
  if (day < 1 || day > lastDay) return null
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
