const hash = process.env.COMMIT_HASH || 'dev'
const date = process.env.COMMIT_DATE || 'unknown'

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
