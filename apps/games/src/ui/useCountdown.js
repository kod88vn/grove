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
        return Math.max(0, Number((previous - 0.1).toFixed(1)))
      })
    }, 100)

    return () => {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [duration, resetKey, running])

  useEffect(() => {
    if (running && timeLeft <= 0 && !expiredRef.current) {
      expiredRef.current = true
      clearInterval(intervalRef.current)
      intervalRef.current = null
      onExpireRef.current()
    }
  }, [timeLeft, running])

  return timeLeft
}
