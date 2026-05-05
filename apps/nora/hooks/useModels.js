'use client'

import { useState, useEffect } from 'react'
import { fetchModels } from '@/lib/api/models'

const ENV_DEFAULT = process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'qwen3.5:9b'

/**
 * Loads the available model list from /api/models (dev only).
 * Returns selected model state and a setter so the UI can switch models.
 */
export function useModels() {
  const [modelList, setModelList] = useState([ENV_DEFAULT])
  const [selectedModel, setSelectedModel] = useState(ENV_DEFAULT)

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return

    let cancelled = false

    fetchModels().then((models) => {
      if (cancelled || !models.length) return
      setModelList(models)
      setSelectedModel((current) => (models.includes(current) ? current : models[0]))
    })

    return () => {
      cancelled = true
    }
  }, [])

  return { modelList, selectedModel, setSelectedModel }
}
