/**
 * Async generator that parses a Server-Sent Events response body.
 * Yields each parsed JSON event object; skips malformed lines and [DONE].
 *
 * @param {Response} response
 * @yields {object}
 */
export async function* parseSseStream(response) {
  if (!response?.body) return

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (value) buffer += decoder.decode(value, { stream: !done })

      const blocks = buffer.split('\n\n')
      buffer = blocks.pop() ?? ''

      for (const block of blocks) {
        const data = block.replace(/^data: /, '').trim()
        if (!data || data === '[DONE]') continue
        try {
          yield JSON.parse(data)
        } catch {
          // skip malformed chunk
        }
      }

      if (done) break
    }
  } finally {
    reader.releaseLock()
  }
}
