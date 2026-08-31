/**
 * A domain value paired with the untouched API response it came from.
 *
 * The mirror stores both. When a connector turns out to have parsed a field wrongly, the fix
 * is to re-parse what we already hold rather than re-fetch — upstream history is mutable, so a
 * re-fetch can return something different from what we originally saw and quietly erase the
 * evidence of the bug.
 */
export interface Mirrored<T> {
  readonly value: T;
  /** JSON text exactly as the API returned it. Never parsed except to repair a mapping. */
  readonly raw: string;
}
