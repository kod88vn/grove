'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { DEFAULT_SETTINGS, readSettings, writeSettings } from '../lib/kidSettings'

const defaultContext = {
  settings: DEFAULT_SETTINGS,
  setSetting: () => {},
  motionAllowed: true,
  soundsAllowed: true,
  prefersReducedMotion: false,
}

const KidSettingsContext = createContext(defaultContext)

export function KidSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const motionAllowed = settings.animations && !prefersReducedMotion
  const soundsAllowed = settings.sounds

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        setSettings(readSettings(window.localStorage))
      }
    } catch {
      setSettings(readSettings(null))
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)

    if (typeof mql.addEventListener !== 'function') return

    const handler = (event) => setPrefersReducedMotion(event.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    if (typeof document === 'undefined') return

    if (settings.dyslexiaFont) {
      document.documentElement.setAttribute('data-font', 'dyslexic')
    } else {
      document.documentElement.removeAttribute('data-font')
    }

    if (motionAllowed) {
      document.documentElement.removeAttribute('data-motion')
    } else {
      document.documentElement.setAttribute('data-motion', 'reduced')
    }

    return () => {
      document.documentElement.removeAttribute('data-font')
      document.documentElement.removeAttribute('data-motion')
    }
  }, [settings.dyslexiaFont, motionAllowed])

  const setSetting = (key, value) => {
    const next = { ...settings, [key]: value }
    let normalized = next
    if (typeof window !== 'undefined') {
      try {
        normalized = writeSettings(window.localStorage, next)
      } catch {
        normalized = writeSettings(null, next)
      }
    }
    setSettings(normalized)
  }

  const contextValue = useMemo(() => ({
    settings,
    setSetting,
    motionAllowed,
    soundsAllowed,
    prefersReducedMotion,
  }), [settings, motionAllowed, soundsAllowed, prefersReducedMotion])

  return <KidSettingsContext.Provider value={contextValue}>{children}</KidSettingsContext.Provider>
}

export function useKidSettings() {
  return useContext(KidSettingsContext)
}