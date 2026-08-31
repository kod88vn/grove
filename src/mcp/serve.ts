import { createInterface } from 'node:readline';
import { loadConfig } from '../config/config.ts';
import { openDatabase } from '../store/database.ts';
import { handleMessage, type ServerInfo } from './protocol.ts';
import { tools } from './tools.ts';

/**
 * Speak MCP over stdio.
 *
 * Nothing may be written to stdout except protocol messages — a stray log line corrupts the
 * stream and the client disconnects with an unhelpful parse error. Diagnostics go to stderr,
 * which the client shows in its output panel.
 */

const INFO: ServerInfo = { name: 'central-command', version: '0.1.0' };
const PARSE_ERROR = -32700;

export function serveMcp(): void {
  // Read-only: this server answers from the mirror and never calls Jira, so it must start even
  // where the token was never exported.
  const config = loadConfig(process.env, false);
  const db = openDatabase({ path: config.databasePath });
  const available = tools(db, config);

  const lines = createInterface({ input: process.stdin });
  lines.on('line', (line) => {
    if (line.trim() === '') {
      return;
    }
    respond(line, available);
  });
  lines.on('close', () => {
    db.close();
  });
  process.stderr.write(`central-command mcp ready, mirror at ${config.databasePath}\n`);
}

function respond(line: string, available: ReturnType<typeof tools>): void {
  let response: unknown | null;
  try {
    response = handleMessage(JSON.parse(line), available, INFO);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    response = { jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message } };
  }
  if (response !== null) {
    process.stdout.write(`${JSON.stringify(response)}\n`);
  }
}
