const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

export function formatDateDDMMYYYY(value) {
  if (!value) return ''
  const trimmed = String(value).trim()
  if (!trimmed) return ''
  if (!ISO_DATE_REGEX.test(trimmed)) return trimmed
  const [year, month, day] = trimmed.split('-')
  return `${day.padStart(2, '0')}.${month.padStart(2, '0')}.${year}`
}
