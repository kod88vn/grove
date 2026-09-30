import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Chat session files of one VS Code window, found by its folder.
 *
 * Each window folder gets `workspaceStorage/<hash>/`, whose `workspace.json` records the folder
 * as a file URI and whose `chatSessions/*.jsonl` hold that window's chats. Read-only.
 */

function normalise(path: string): string {
  return path.replace(/\/+$/, '');
}

function folderOf(workspaceJson: string): string | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(workspaceJson, 'utf8'));
    if (typeof parsed !== 'object' || parsed === null || !('folder' in parsed)) return null;
    const folder = parsed.folder;
    if (typeof folder !== 'string' || !folder.startsWith('file://')) return null;
    return normalise(decodeURIComponent(folder.slice('file://'.length)));
  } catch {
    return null;
  }
}

/** The chatSessions directory of the window open on `repo`, or null when none is recorded. */
export function chatSessionDir(storageRoot: string, repo: string): string | null {
  const wanted = normalise(repo);
  let hashes: string[];
  try {
    hashes = readdirSync(storageRoot);
  } catch {
    return null;
  }
  const match = hashes.find((hash) => folderOf(join(storageRoot, hash, 'workspace.json')) === wanted);
  return match === undefined ? null : join(storageRoot, match, 'chatSessions');
}

/** Lines of every session file modified at or after `sinceMs`, oldest first. */
export function readRecentSessions(dir: string, sinceMs: number): string[][] {
  let names: string[];
  try {
    names = readdirSync(dir).filter((name) => name.endsWith('.jsonl'));
  } catch {
    return [];
  }
  return names
    .map((name) => ({ path: join(dir, name), mtime: statSync(join(dir, name)).mtimeMs }))
    .filter((file) => file.mtime >= sinceMs)
    .sort((a, b) => a.mtime - b.mtime)
    .map((file) => readFileSync(file.path, 'utf8').split('\n'));
}
