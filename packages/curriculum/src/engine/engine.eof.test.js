/**
 * P1.5 hygiene — every file in the engine tree ends with exactly one newline.
 *
 * The PR #81 reviewer found `check.js` ending on `}` with no newline. It is true, and it is
 * not new: `check.js`, `fraction.js`, `render.js` and `rng.js` have shipped that way since
 * P1.2. A byte-level survey of the package puts the damage exactly there — of the 41 `.js`
 * files under `packages/curriculum/src`, those four are the only ones whose last byte is not
 * `0a`; `src/`, `src/catalog`, `src/content` and `src/problems` are already clean.
 *
 * POSIX defines a line as ending in a newline, so a file without one has a last line that
 * formally is not one; `git` says `\ No newline at end of file`, `cat` runs the next shell
 * prompt into the code, and every future diff that touches the last line rewrites it twice.
 *
 * Scoped to `src/engine`, mirroring `src/problems/problems.eof.test.js` — one guard per tree,
 * which is the pattern already in the package. A single `src`-wide guard was considered and
 * rejected: it would either duplicate the problems tree's existing coverage or require
 * deleting that test, and neither buys anything while the two are the only trees with a
 * guard. The other trees are covered by their own file when they get one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(fileURLToPath(import.meta.url))

async function files(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) found.push(...(await files(path)))
    else if (entry.name.endsWith('.js')) found.push(path)
  }
  return found.sort()
}

test('every file in the engine tree ends with exactly one newline', async () => {
  const paths = await files(ROOT)
  assert.ok(paths.length > 0, 'the engine tree is empty')
  for (const path of paths) {
    const text = await readFile(path, 'utf8')
    const relative = path.slice(ROOT.length + 1)
    assert.ok(text.endsWith('\n'), `${relative} does not end with a newline`)
    assert.ok(!text.endsWith('\n\n'), `${relative} ends with a blank line`)
  }
})
