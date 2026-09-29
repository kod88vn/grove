import { describe, expect, it } from 'vitest';
import { loadRegistry } from '../../../src/connectors/model-registry-file.ts';

const FIXTURE = new URL('../../fixtures/models/registry.json', import.meta.url).pathname;

describe('loadRegistry', () => {
  it('reads and parses a registry file from disk', () => {
    const registry = loadRegistry(FIXTURE);
    expect(registry.agents['loop-worker']).toBe('worker');
    expect(registry.tiers.map((t) => t.name)).toEqual(['worker', 'dispatcher', 'architect', 'oracle']);
  });

  it('throws a readable error for a file whose JSON is not a valid registry shape', () => {
    const catalogPath = new URL('../../fixtures/models/catalog.json', import.meta.url).pathname;
    expect(() => loadRegistry(catalogPath)).toThrow();
  });
});
