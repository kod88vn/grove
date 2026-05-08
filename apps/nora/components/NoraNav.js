'use client'

import { useEffect, useState } from 'react'
import { AppHeader as SharedAppHeader } from '@grove/shell'

export function NoraNav() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    fetch('/api/me')
      .then((r) => r.json())
      .then(setUser)
      .catch(() => {})
  }, [])

  const trailingContent = user?.name ? (
    <>
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
    </>
  ) : null

  return <SharedAppHeader trailingContent={trailingContent} />
}
