// In production we run under Platformatic Watt, where @platformatic/gateway
// (apps/gateway) is the entrypoint and proxies each path prefix to the right
// app via the internal mesh. In local dev (`yarn dev`), each Next app runs on
// its own port, and the grove app uses Next rewrites to stitch them together.
const isDev = process.env.NODE_ENV !== 'production'

const NORA_URL = process.env.PLT_NORA_URL || 'http://localhost:3001'
const GAMES_URL = process.env.PLT_GAMES_URL || 'http://localhost:3002'
const SHOPPING_LIST_URL = process.env.PLT_SHOPPING_LIST_URL || 'http://localhost:3003'
const REMINDERS_URL = process.env.PLT_REMINDERS_URL || 'http://localhost:3004'

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    if (!isDev) return []
    return [
      { source: '/chat', destination: `${NORA_URL}/chat` },
      { source: '/chat/:path*', destination: `${NORA_URL}/chat/:path*` },
      { source: '/api/:path*', destination: `${NORA_URL}/chat/api/:path*` },
      { source: '/games', destination: `${GAMES_URL}/games` },
      { source: '/games/:path*', destination: `${GAMES_URL}/games/:path*` },
      { source: '/shopping-list', destination: `${SHOPPING_LIST_URL}/shopping-list` },
      { source: '/shopping-list/:path*', destination: `${SHOPPING_LIST_URL}/shopping-list/:path*` },
      { source: '/reminders', destination: `${REMINDERS_URL}/reminders` },
      { source: '/reminders/:path*', destination: `${REMINDERS_URL}/reminders/:path*` },
    ]
  },
}

export default nextConfig
