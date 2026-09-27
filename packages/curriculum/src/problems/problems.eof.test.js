/**
 * P1.4 hygiene — every file in the problems tree ends with exactly one newline.
 *
 * `long-multiplication.js` shipped ending on `]` with no newline while both of its siblings
 * ended `0a`, which is the kind of thing a reviewer spends a round on and a spec can settle
 * once. POSIX defines a line as ending in a newline, so a file without one has a last line
 * that formally is not one; `git` says `\ No newline at end of file` and `cat` runs the next
 * prompt into it.
 *
 * Scoped to `src/problems`, the tree P1.4 owns. Files elsewhere in the package predate this
 * and are left alone rather than quietly reformatted from a test.
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

test('every file in the problems tree ends with exactly one newline', async () => {
  const paths = await files(ROOT)
  assert.ok(paths.length > 0, 'the problems tree is empty')
  for (const path of paths) {
    const text = await readFile(path, 'utf8')
    const relative = path.slice(ROOT.length + 1)
    assert.ok(text.endsWith('\n'), `${relative} does not end with a newline`)
    assert.ok(!text.endsWith('\n\n'), `${relative} ends with a blank line`)
  }
})
