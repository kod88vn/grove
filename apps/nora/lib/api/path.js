export function apiPath(path) {
  if (!path.startsWith('/')) {
    throw new Error(`apiPath expects a leading slash: ${path}`)
  }

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''
  return `${basePath}${path}`
}
