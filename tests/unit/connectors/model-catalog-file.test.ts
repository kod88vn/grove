import { describe, expect, it, afterEach } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { findNewestCatalogFile, loadCatalog } from '../../../src/connectors/model-catalog-file.ts';

const FIXTURE = new URL('../../fixtures/models/catalog.json', import.meta.url).pathname;

describe('loadCatalog', () => {
  it('reads a catalogue file from disk and converts prices to AIC per 1M tokens', () => {
    const models = loadCatalog(FIXTURE);
    const luna = models.find((m) => m.name === 'GPT-5.6 Luna');
    expect(luna).toEqual({ name: 'GPT-5.6 Luna', inputPrice: 20, outputPrice: 120 });
  });

  it('drops the one entry with no usable billing information', () => {
    const models = loadCatalog(FIXTURE);
    expect(models.some((m) => m.name === 'Some Preview Model')).toBe(false);
  });
});

describe('findNewestCatalogFile', () => {
  let dir: string;

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('walks nested folders and returns the most recently modified models.json', () => {
    dir = mkdtempSync(join(tmpdir(), 'cc-catalog-'));
    const older = join(dir, 'a', 'models.json');
    const newer = join(dir, 'b', 'deep', 'models.json');
    for (const path of [older, newer]) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, '[]');
    }
    utimesSync(older, new Date('2026-01-01'), new Date('2026-01-01'));
    utimesSync(newer, new Date('2026-06-01'), new Date('2026-06-01'));

    expect(findNewestCatalogFile(dir)).toBe(newer);
  });

  it('returns null when the search root has no models.json anywhere', () => {
    dir = mkdtempSync(join(tmpdir(), 'cc-catalog-empty-'));
    expect(findNewestCatalogFile(dir)).toBeNull();
  });
});
