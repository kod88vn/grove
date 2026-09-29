import { describe, expect, it, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readAgentFile, writeAgentFile } from '../../../src/connectors/agent-frontmatter-file.ts';

describe('readAgentFile / writeAgentFile', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('round-trips file content unchanged', () => {
    dir = mkdtempSync(join(tmpdir(), 'cc-agent-file-'));
    const path = join(dir, 'loop-worker.agent.md');
    writeAgentFile(path, '---\nmodel: ["A"]\n---\nbody\n');
    expect(readAgentFile(path)).toBe('---\nmodel: ["A"]\n---\nbody\n');
  });
});
