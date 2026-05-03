import { appendFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const LOG_DIR = join(process.cwd(), 'logs')
const LOG_FILE = join(LOG_DIR, 'chat-audit.log')

// Overwrite once per process startup, then append for the rest of the session
let sessionStarted = false

function write(entry) {
  try {
    mkdirSync(LOG_DIR, { recursive: true })
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'
    if (!sessionStarted) {
      writeFileSync(LOG_FILE, line, 'utf8')
      sessionStarted = true
    } else {
      appendFileSync(LOG_FILE, line, 'utf8')
    }
  } catch {
    // never crash the request over logging
  }
}

export const log = {
  /** Start of a new chat request */
  request(model, userMessage) {
    write({ event: 'request', model, userMessage })
  },

  /** Raw planning-pass response from Ollama */
  planningResponse(pass, message) {
    write({
      event: 'planning_response',
      pass,
      toolCalls: message?.tool_calls ?? null,
      contentLength: message?.content?.length ?? 0,
      contentSnippet: message?.content?.slice(0, 200) ?? '',
    })
  },

  /** Tool calls extracted (structured or XML fallback) */
  toolCallsExtracted(pass, calls) {
    write({ event: 'tool_calls_extracted', pass, calls })
  },

  /** A tool is about to execute */
  toolExecute(name, args) {
    write({ event: 'tool_execute', name, args })
  },

  /** Tool result summary */
  toolResult(name, summary) {
    write({ event: 'tool_result', name, summary })
  },

  /** Short-circuit: answering from planning pass without streaming */
  shortCircuit(contentSnippet) {
    write({ event: 'short_circuit', contentSnippet })
  },

  /** Entering the streaming final-answer pass */
  streamingPass() {
    write({ event: 'streaming_pass' })
  },

  /** Unhandled error */
  error(err) {
    write({ event: 'error', message: err?.message, stack: err?.stack?.slice(0, 400) })
  },
}
