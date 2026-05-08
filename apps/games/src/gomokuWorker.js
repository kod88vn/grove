export function getGomokuWorkerUrl(pathname = '/') {
  const basePath = pathname.startsWith('/games') ? '/games' : ''
  return `${basePath}/gomoku-ai-worker.js`
}