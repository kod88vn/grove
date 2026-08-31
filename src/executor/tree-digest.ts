import { createHash } from 'node:crypto';
import { sourceFileHashes } from '../connectors/git.ts';

/**
 * The source roots the gate watches.
 *
 * Deliberately the same set the guards scan, plus the guard policy itself. Documentation is
 * excluded: a stamp that expires because a sentence in DESIGN.md was reworded trains people
 * to work around the gate, and a gate people work around is worse than none.
 */
export const GATED_ROOTS: readonly string[] = [
  'src',
  'bin',
  'scripts',
  'dashboard',
  'package.json',
  'tsconfig.json',
  'ai-guard.config.json',
];

/**
 * One digest standing for "the code, right now".
 *
 * Two trees with the same digest verify identically, so a stamp earned against one is honest
 * evidence about the other. Any edit, addition, rename or deletion inside GATED_ROOTS changes
 * it, which is what makes a stamp expire on its own rather than needing to be revoked.
 */
export async function treeDigest(repoPath: string): Promise<string> {
  const entries = await sourceFileHashes(repoPath, GATED_ROOTS);
  const hash = createHash('sha256');
  for (const entry of entries) hash.update(`${entry}\n`);
  return hash.digest('hex');
}

export function digestOf(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}
