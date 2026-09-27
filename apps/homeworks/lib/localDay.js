// Calendar-day arithmetic in an IANA time zone, so the review page groups work by the
// day the kid actually did it rather than by the UTC day (HOMEWORK_PLAN.md F1).

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function zonedParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms))
  const get = (type) => Number(parts.find((p) => p.type === type).value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour'), minute: get('minute'), second: get('second') }
}

// Offset of `timeZone` from UTC at instant `ms`, in ms (negative west of UTC).
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone)
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return wallClockAsUtc - Math.floor(ms / 1000) * 1000
}

// The UTC instant of local midnight on year-month-day in `timeZone`. The second pass
// corrects the guess when the offset at midnight differs from the offset at 00:00Z.
function localMidnight(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day)
  const first = guess - offsetAt(guess, timeZone)
  return guess - offsetAt(first, timeZone)
}

export function isValidTimeZone(timeZone) {
  if (typeof timeZone !== 'string' || timeZone === '') return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

// 'YYYY-MM-DD' of the instant `date` (ISO string, ms or Date) as seen in `timeZone`.
export function localDateOf(date, timeZone) {
  const { year, month, day } = zonedParts(new Date(date).getTime(), timeZone)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

// [start, end) in ms for the local calendar day `dayStr` in `timeZone`. Days are 23 or
// 25 hours long across DST changes.
export function dayBoundsInZone(dayStr, timeZone) {
  const match = DAY_PATTERN.exec(dayStr)
  if (!match) throw new Error(`day must be YYYY-MM-DD, got "${dayStr}"`)
  const [year, month, day] = match.slice(1).map(Number)
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return {
    start: localMidnight(year, month, day, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  }
}
