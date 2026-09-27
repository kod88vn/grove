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

// The first UTC instant whose local date in `timeZone` is year-month-day. That is local
// midnight, or the moment the clocks jump when a zone skips midnight (PR #53 review).
function localMidnight(year, month, day, timeZone) {
  const guess = Date.UTC(year, month - 1, day)
  const first = guess - offsetAt(guess, timeZone)
  const estimate = guess - offsetAt(first, timeZone)
  const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  let low = estimate - 48 * 60 * 60 * 1000
  let high = estimate + 48 * 60 * 60 * 1000

  while (localDateOf(low, timeZone) >= targetDate) low -= 48 * 60 * 60 * 1000
  while (localDateOf(high, timeZone) < targetDate) high += 48 * 60 * 60 * 1000

  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (localDateOf(middle, timeZone) < targetDate) low = middle
    else high = middle
  }

  return high
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
  const calendarDate = new Date(Date.UTC(year, month - 1, day))
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw new Error(`invalid calendar date: "${dayStr}"`)
  }
  const next = new Date(Date.UTC(year, month - 1, day + 1))
  return {
    start: localMidnight(year, month, day, timeZone),
    end: localMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone),
  }
}
