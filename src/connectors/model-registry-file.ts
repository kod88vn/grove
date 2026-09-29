import { readFileSync } from 'node:fs';
import { parseRegistry, type Registry } from '../core/model/tiers.ts';

/** Reads and parses `registry/model-tiers.json` from an exact path. */
export function loadRegistry(path: string): Registry {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return parseRegistry(raw);
}
