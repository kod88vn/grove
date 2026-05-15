export function getGomokuWorkerUrl(pathname = '/') {
  // Next.js with basePath: '/games' serves public files at /games/<file>.
  // Use an absolute origin-relative path so the worker URL is consistent
  // regardless of which page the user is on.
  return '/games/gomoku-ai-worker.js'
}

/**
 * Build a Worker instance from the current page context.
 * 
 * In production (basePath + gateway proxy), `new Worker('/games/gomoku-ai-worker.js')`
 * can fail because the browser resolves it against the gateway origin, not the games app.
 * 
 * This helper builds a URL relative to `window.location.origin` so it always resolves
 * correctly whether the page is served from /games, /games/gomoku, or behind a proxy.
 */
export function createWorker(pathname) {
  const url = getGomokuWorkerUrl(pathname)
  // Use an absolute URL (with trailing slash on origin) to avoid basePath resolution issues.
  const absoluteUrl = `${window.location.origin}${url}`
  return new Worker(absoluteUrl)
}
