const releaseDateFormatter = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
})

function parseReleaseDate(date) {
  if (!date) return { date: null, yearOnly: false, original: '' }
  const trimmed = String(date).trim()
  if (!trimmed) return { date: null, yearOnly: false, original: '' }
  const yearOnlyPattern = /^\d{4}$/
  if (yearOnlyPattern.test(trimmed)) {
    return { date: new Date(`${trimmed}-12-31`), yearOnly: true, original: trimmed }
  }
  const parsed = Date.parse(trimmed)
  if (Number.isNaN(parsed)) return { date: null, yearOnly: false, original: trimmed }
  return { date: new Date(parsed), yearOnly: false, original: trimmed }
}

export function formatReleaseDate(date) {
  const { date: parsed, yearOnly, original } = parseReleaseDate(date)
  if (!parsed) return ''
  return yearOnly ? original : releaseDateFormatter.format(parsed)
}

export function isFutureRelease(date) {
  const { date: parsed } = parseReleaseDate(date)
  if (!parsed) return false
  return parsed.getTime() > Date.now()
}
