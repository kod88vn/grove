'use client'

import { use, useEffect, Suspense } from 'react'
import { mePromise } from '@/lib/api/me'

/**
 * Resolves user identity (React 19 `use()`), then fires `onGreet` once.
 * Suspends until the /api/me fetch settles so greetings include the real name.
 * In dev mode the resolved user is ignored and "Master" is used.
 */
function GreetingTriggerInner({ onGreet }) {
  const user = use(mePromise)

  useEffect(() => {
    const isDevMode = process.env.NODE_ENV !== 'production'
    const firstName = isDevMode
      ? 'Master'
      : (user?.name ? user.name.split(' ')[0] : user?.login?.split('@')[0] ?? null)
    onGreet(firstName)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // fire exactly once after identity resolves

  return null
}

export function GreetingTrigger({ onGreet }) {
  return (
    <Suspense fallback={null}>
      <GreetingTriggerInner onGreet={onGreet} />
    </Suspense>
  )
}
