import { useEffect, useRef, useState } from 'react'

export function useCountdown({ duration, running, resetKey, onExpire }) {
  const [timeLeft, setTimeLeft] = useState(duration)
  const onExpireRef = useRef(onExpire)
  const expiredRef = useRef(false)
  const intervalRef = useRef(null)

  onExpireRef.current = onExpire

  useEffect(() => {
    setTimeLeft(duration)
    expiredRef.current = false
  }, [duration, resetKey])

  useEffect(() => {
    if (!running) {
      return undefined
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft((previous) => {
        const next = Math.max(0, Number((previous - 0.1).toFixed(1)))
        if (next === 0 && !expiredRef.current) {
          expiredRef.current = true
          onExpireRef.current()
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
        return next
      })
    }, 100)

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [duration, resetKey, running])

  return timeLeft
}
