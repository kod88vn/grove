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
}

export default nextConfig
