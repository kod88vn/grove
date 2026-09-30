import { homedir } from 'node:os';
import { join } from 'node:path';
import { chatSessionDir, readRecentSessions } from '../connectors/chat-session-files.ts';
import { observeDispatch } from '../core/loops/dispatch-watch.ts';

/**
 * `cc loop watch` — what did the driver's last dispatch become?
 *
 * Prints `<status> <agent> <model>` on the first line (status: none|running|done|refused; `-`
 * for an unknown agent or model), then the first line of the agent's reply. The driver branches
 * on the first word only. Always exits 0 when the arguments parse: "no window, no session" is
 * the answer `none`, and the driver's grace period decides whether that is a lost dispatch.
 */

const DEFAULT_STORAGE = join(homedir(), 'Library', 'Application Support', 'Code', 'User', 'workspaceStorage');
const MS_PER_SECOND = 1000;

export interface LoopWatchInput {
  readonly repo: string;
  readonly sentinel: string;
  readonly sinceSeconds: number;
  readonly storage: string | null;
}

export function loopWatch(input: LoopWatchInput): number {
  const root = input.storage ?? process.env.CC_CHAT_STORAGE ?? DEFAULT_STORAGE;
  const dir = chatSessionDir(root, input.repo);
  const sessions = dir === null ? [] : readRecentSessions(dir, input.sinceSeconds * MS_PER_SECOND);
  const seen = observeDispatch(sessions, input.sentinel);
  const firstLine = seen.reply.split('\n')[0] ?? '';
  process.stdout.write(`${seen.status} ${seen.agent ?? '-'} ${seen.model ?? '-'}\n${firstLine}\n`);
  return 0;
}
