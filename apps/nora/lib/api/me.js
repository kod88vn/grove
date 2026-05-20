import { apiPath } from './path.js'

/**
 * Module-level stable Promise for the current user's Tailscale identity.
 * Created once when the module loads — safe to pass to React 19 `use()`.
 */
const fetchMe = typeof fetch === 'function'
  ? fetch(apiPath('/api/me')).then((r) => (r.ok ? r.json() : null))
  : Promise.resolve(null)

export const mePromise = fetchMe.catch(() => null)
