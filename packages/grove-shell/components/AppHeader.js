'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getNavItems, isActiveNavPath } from '../navigation.js'
import { apiPath } from '../apiPath.js'

const NAV_ITEMS = getNavItems()

function UserAvatar() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch(apiPath('/api/me'))
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {})
  }, [])

  if (!user?.name) return null

  return (
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
  )
}

export function AppHeader({ trailingContent = null }) {
  const pathname = usePathname() ?? '/'

  return (
    <header data-grove-header="true" className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 md:px-6">
        <div className="flex items-center gap-1">
          <a href="/" className="mr-3 shrink-0 text-base font-semibold text-slate-800 transition hover:text-cyan-600">
            Grove
          </a>
          {NAV_ITEMS.map(({ href, label }) => {
            const active = isActiveNavPath(pathname, href)
            return (
              <a
                key={href}
                href={href}
                className={[
                  'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-200 border-b-2',
                  active
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-600'
                    : 'text-slate-500 border-transparent hover:bg-slate-50 hover:text-slate-800 hover:border-slate-200',
                ].join(' ')}
              >
                {label}
              </a>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          {trailingContent ? <>{trailingContent}</> : <UserAvatar />}
        </div>
      </div>
    </header>
  )
}