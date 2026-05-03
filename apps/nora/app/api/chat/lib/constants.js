export const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'qwen3.5:9b'

// Rolling window config
export const ROLLING_WINDOW = 20
export const RECENT_KEEP = 10

export const MAX_TOOL_PLANNING_PASSES = 3

export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream; charset=utf-8',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
}
