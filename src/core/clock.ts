/**
 * Time is injected, never read.
 *
 * The stall engine decides that a PR has been unmerged "for more than a day". If it read the
 * wall clock itself, every threshold test would be a race against midnight. `ai-guard` enforces
 * this by banning direct clock access inside pure layers.
 */
export interface Clock {
  /** Milliseconds since the Unix epoch. */
  now(): number;
}

/** An ISO-8601 timestamp as returned by both Jira and GitHub, e.g. `2026-08-24T16:08:00.000Z`. */
export type Iso8601 = string;

/**
 * A clock pinned to a fixed instant.
 *
 * Used by tests, and by each sync run so that every staleness comparison within one run is
 * made against the same instant. The real system clock lives in `src/config/`, because
 * reading it is I/O and this layer is pure.
 */
export function fixedClock(instant: number): Clock {
  return { now: () => instant };
}

export function parseIso(value: Iso8601): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    throw new Error(`Not an ISO-8601 timestamp: ${value}`);
  }
  return ms;
}

const MS_PER_DAY = 86_400_000;

/** Whole and fractional days between an ISO timestamp and now. Negative if the value is future. */
export function ageInDays(since: Iso8601, clock: Clock): number {
  return (clock.now() - parseIso(since)) / MS_PER_DAY;
}
