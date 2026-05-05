'use client'

import { use, Suspense } from 'react'
import { mePromise } from '@/lib/api/me'

/**
 * Reads resolved Tailscale identity via React 19 `use()`.
 * Suspends during fetch; renders nothing while loading or when identity is absent.
 */
function UserBadgeInner() {
  const user = use(mePromise)
  if (!user?.name && !user?.login) return null
  return (
    <span className="text-sm text-gray-600 font-medium">
      {user.name || user.login}
    </span>
  )
}

export function UserBadge() {
  return (
    <Suspense fallback={null}>
      <UserBadgeInner />
    </Suspense>
  )
}
