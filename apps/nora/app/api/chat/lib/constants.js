// Unified model config — single MODEL variable for all AI calls.
export const DEFAULT_MODEL = process.env.MODEL || 'qwen3.6-35b-a3b-mtp-holo3-qwopus-qx86-hi-mlx'

// Rolling window config
export const ROLLING_WINDOW = 20
export const RECENT_KEEP = 10

export const MAX_TOOL_PLANNING_PASSES = 3

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}
