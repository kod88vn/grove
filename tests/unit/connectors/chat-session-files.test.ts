import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chatSessionDir, readRecentSessions } from '../../../src/connectors/chat-session-files.ts';

// VS Code keeps one workspaceStorage/<hash>/ per window folder; <hash>/workspace.json maps it back
// ({"folder":"file:///Users/…/cloverpedia"}) and <hash>/chatSessions/*.jsonl holds its chats.

const made: string[] = [];
afterEach(() => {
  for (const dir of made.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function storage(): string {
  const root = mkdtempSync(join(tmpdir(), 'cc-chat-storage-'));
  made.push(root);
  return root;
}

function window(root: string, hash: string, folder: string): string {
  mkdirSync(join(root, hash, 'chatSessions'), { recursive: true });
  writeFileSync(join(root, hash, 'workspace.json'), JSON.stringify({ folder: `file://${folder}` }));
  return join(root, hash, 'chatSessions');
}

describe('finding the chat sessions of the target repo window', () => {
  it('maps the repo to its workspaceStorage folder, ignoring other windows', () => {
    const root = storage();
    window(root, 'aaa', '/Users/me/dev/other');
    const sessions = window(root, 'bbb', '/Users/me/dev/cloverpedia');
    expect(chatSessionDir(root, '/Users/me/dev/cloverpedia')).toBe(sessions);
    expect(chatSessionDir(root, '/Users/me/dev/cloverpedia/')).toBe(sessions);
    expect(chatSessionDir(root, '/Users/me/dev/absent')).toBeNull();
  });

  it('decodes a percent-encoded folder uri', () => {
    const root = storage();
    const sessions = window(root, 'ccc', '/Users/me/My%20Repo');
    expect(chatSessionDir(root, '/Users/me/My Repo')).toBe(sessions);
  });

  it('reads only sessions touched since the dispatch, oldest first', () => {
    const root = storage();
    const dir = window(root, 'ddd', '/r');
    const at = (name: string, seconds: number): void => {
      writeFileSync(join(dir, name), `{"kind":0,"v":{"name":"${name}"}}\n`);
      utimesSync(join(dir, name), seconds, seconds);
    };
    at('old.jsonl', 1000);
    at('newer.jsonl', 3000);
    at('new.jsonl', 2000);
    writeFileSync(join(dir, 'notes.txt'), 'x');
    const read = readRecentSessions(dir, 1500 * 1000);
    expect(read.map((lines) => lines[0])).toEqual([
      '{"kind":0,"v":{"name":"new.jsonl"}}',
      '{"kind":0,"v":{"name":"newer.jsonl"}}',
    ]);
  });
});
