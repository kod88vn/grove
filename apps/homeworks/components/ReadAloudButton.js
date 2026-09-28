'use client'

import { useEffect, useRef } from 'react'

export function ReadAloudButton({ text }) {
  const speechSynthesisRef = useRef(null)
  const supported =
    typeof window !== 'undefined' &&
    window.speechSynthesis &&
    window.SpeechSynthesisUtterance

  speechSynthesisRef.current = supported ? window.speechSynthesis : null

  useEffect(() => () => {
    speechSynthesisRef.current?.cancel()
  }, [text])

  if (!supported) return null

  function readAloud() {
    const speechSynthesis = speechSynthesisRef.current
    speechSynthesis.cancel()
    speechSynthesis.speak(new window.SpeechSynthesisUtterance(text))
  }

  return (
    <button
      type="button"
      onClick={readAloud}
      aria-label="Read the question aloud"
      className="rounded bg-slate-100 px-4 py-2 font-semibold text-slate-900"
    >
      🔊
    </button>
  )
}