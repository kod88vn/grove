import { execSync } from 'child_process'

function getGitInfo() {
  try {
    const hash = execSync('git rev-parse --short HEAD', { cwd: new URL('.', import.meta.url).pathname }).toString().trim()
    const date = execSync('git log -1 --format=%ci', { cwd: new URL('.', import.meta.url).pathname }).toString().trim()
    return { hash, date }
  } catch {
    return { hash: 'unknown', date: 'unknown' }
  }
}

const { hash, date } = getGitInfo()

/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: '/chat',
  reactStrictMode: true,
  serverExternalPackages: ['better-sqlite3'],
  env: {
    NEXT_PUBLIC_COMMIT_HASH: hash,
    NEXT_PUBLIC_COMMIT_DATE: date,
    NEXT_PUBLIC_BASE_PATH: '/chat',
  },
  // Dev-time rewrite: forward /ingest to OpenObserve Caddy proxy so browser logs reach production
  async rewrites() {
    return [
      {
        source: '/ingest',
        destination: process.env.OPENOBSERVE_URL
          ? `${process.env.OPENOBSERVE_URL}/api/default/grove_all_logs/_json`
          : '/chat/api/ingest', // fallback: local ingest endpoint (no-op in dev)
      },
    ]
  },
}

export default nextConfig
