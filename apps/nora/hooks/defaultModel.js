// Shared client-side default model resolver — uses unified NEXT_PUBLIC_MODEL.

/**
 * Returns the default model name for client-side components (FloatingChat, etc.).
 */
export function getDefaultModel() {
  return process.env.NEXT_PUBLIC_MODEL || 'qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx'
}

// Export a resolved constant for use at module initialization time.
export const DEFAULT_MODEL = getDefaultModel()
