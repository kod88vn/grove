'use client'

import { useState, useEffect } from 'react'
import { fetchModels } from '@/lib/api/models'
import { DEFAULT_MODEL } from './defaultModel.js'

const ENV_DEFAULT = DEFAULT_MODEL

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
