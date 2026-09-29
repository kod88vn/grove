import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parseCatalog, type CatalogueModel } from '../core/model/catalog.ts';

/**
 * The catalogue is not checked into this repo — it is whatever `models.json` Copilot Chat most
 * recently wrote under VS Code's workspace storage. Reading it is therefore a filesystem
 * search, not a fixed path, and belongs in the connectors layer alongside every other "talks
 * outward" concern.
 */

/** Reads and parses a catalogue file from an exact path. */
export function loadCatalog(path: string): CatalogueModel[] {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseCatalog(raw);
}

interface Found {
  readonly path: string;
  readonly mtimeMs: number;
}

function walk(dir: string): Found[] {
  const found: Found[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return found;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full, { throwIfNoEntry: false });
    if (stat === undefined) {
      continue;
    }
    if (stat.isDirectory()) {
      found.push(...walk(full));
    } else if (entry === 'models.json') {
      found.push({ path: full, mtimeMs: stat.mtimeMs });
    }
  }
  return found;
}

/** Walks `searchRoot` recursively and returns the most recently modified `models.json`, or null. */
export function findNewestCatalogFile(searchRoot: string): string | null {
  const found = walk(searchRoot);
  if (found.length === 0) {
    return null;
  }
  found.sort((a, b) => b.mtimeMs - a.mtimeMs);
  const newest = found[0];
  return newest === undefined ? null : newest.path;
}
