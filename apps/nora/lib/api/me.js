/**
 * Module-level stable Promise for the current user's Tailscale identity.
 * Created once when the module loads — safe to pass to React 19 `use()`.
 */
export const mePromise = fetch('/api/me')
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null)
