'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/chat', label: 'Chat' },
  { href: '/modules', label: 'Modules' },
]

export function NoraNav() {
  const pathname = usePathname()
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {})
  }, [])

  const isActive = (href) => {
    const p = pathname ?? ''
    return href === '/' ? p === '/' : p.startsWith(href)
  }

  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur md:px-6">
      <div className="flex items-center gap-1">
        <span className="mr-3 text-base font-semibold text-slate-800">Grove</span>
        {NAV_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={[
              'rounded-lg px-3 py-1.5 text-sm font-medium transition',
              isActive(href)
                ? 'bg-slate-100 text-slate-900'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800',
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
