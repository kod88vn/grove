'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/modules?domain=household', label: 'Utilities' },
  { href: '/modules?domain=learning', label: 'Games' },
  { href: '/chat', label: 'Nora' },
]

export function NoraNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {})
  }, [])

  const isActive = (href) => {
    const p = pathname ?? ''
    
    // Parse target href
    const targetUrl = new URL(href, 'http://localhost')
    const targetPath = targetUrl.pathname
    const targetDomain = targetUrl.searchParams.get('domain')

    // If target has a domain filter, we must be on the same path AND have that same domain in query
    if (targetDomain) {
      if (p !== targetPath) return false
      return searchParams.get('domain') === targetDomain
    }

    // Special case for chat to prevent partial matches if we ever have sub-routes
    if (targetPath === '/chat') return p.startsWith('/chat')

    // Exact match for root, otherwise prefix match
    return targetPath === '/' ? p === '/' : p.startsWith(targetPath)
  }

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-1">
        <Link href="/" className="mr-3 text-base font-semibold text-slate-800 hover:text-cyan-600 transition">
          Grove
        </Link>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 shadow-sm border-b-2',
              isActive(href)
                ? 'bg-indigo-50 text-indigo-700 border-indigo-600 shadow-indigo-100/50'
                : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-800 hover:border-slate-200',
            ].join(' ')}
          >
            {label}
          </Link>
        ))}
      </div>

      {user?.name && (
        <div className="flex items-center gap-2">
          {user.pic ? (
            <img
              src={user.pic}
              alt={user.name}
              className="h-7 w-7 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
              {user.name
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
          )}
          <span className="hidden text-sm text-slate-600 md:block">{user.name}</span>
        </div>
      )}
    </nav>
  )
}
