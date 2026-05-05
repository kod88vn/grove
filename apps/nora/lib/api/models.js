/** Fetch the list of available Ollama models. Returns [] on failure. */
export async function fetchModels() {
  try {
    const res = await fetch('/api/models', { cache: 'no-store' })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data?.models) ? data.models : []
  } catch {
    return []
  }
}
