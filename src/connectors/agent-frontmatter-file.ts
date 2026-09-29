import { readFileSync, writeFileSync } from 'node:fs';

/** Reads an agent `.agent.md` file's raw content. */
export function readAgentFile(path: string): string {
  return readFileSync(path, 'utf8');
}

/** Writes an agent `.agent.md` file's raw content. */
export function writeAgentFile(path: string, content: string): void {
  writeFileSync(path, content, 'utf8');
}
