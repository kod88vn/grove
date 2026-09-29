import { describe, expect, it } from 'vitest';
import { buildModelLine, parseModelLine, replaceModelLine, replaceNameLine } from '../../../../src/core/model/frontmatter.ts';

const AGENT_FILE = `---
name: loop-worker
description: >
  The grinding half of a loop.
model: ["GPT-5.6 Luna", "Claude Sonnet 5"]
---

You are the worker in a verified loop.
`;

describe('parseModelLine', () => {
  it('parses the model array out of agent frontmatter', () => {
    expect(parseModelLine(AGENT_FILE)).toEqual(['GPT-5.6 Luna', 'Claude Sonnet 5']);
  });

  it('returns null when there is no model line', () => {
    expect(parseModelLine('---\nname: probe\n---\nbody\n')).toBeNull();
  });
});

describe('buildModelLine', () => {
  it('formats an ordered model list as a YAML flow sequence', () => {
    expect(buildModelLine(['GPT-5.6 Luna', 'GPT-6 Luna'])).toBe('model: ["GPT-5.6 Luna", "GPT-6 Luna"]');
  });
});

describe('replaceModelLine', () => {
  it('rewrites only the model line and leaves the rest of the file untouched', () => {
    const updated = replaceModelLine(AGENT_FILE, ['GPT-5.6 Luna', 'GPT-6 Luna']);
    expect(updated).toBe(AGENT_FILE.replace(
      'model: ["GPT-5.6 Luna", "Claude Sonnet 5"]',
      'model: ["GPT-5.6 Luna", "GPT-6 Luna"]',
    ));
  });

  it('throws when the file has no model line to replace', () => {
    expect(() => replaceModelLine('---\nname: probe\n---\n', ['x'])).toThrow();
  });
});

describe('replaceNameLine', () => {
  it('rewrites only the name line and leaves the rest of the file untouched', () => {
    const updated = replaceNameLine(AGENT_FILE, 'loop-worker-t2');
    expect(updated).toBe(AGENT_FILE.replace('name: loop-worker', 'name: loop-worker-t2'));
  });

  it('throws when the file has no name line to replace', () => {
    expect(() => replaceNameLine('model: ["x"]\n', 'probe')).toThrow();
  });
});
