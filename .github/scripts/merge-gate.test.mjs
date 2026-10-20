import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMergeGate, isTrustedReviewer } from './merge-gate.mjs'

const HEAD = '29afcc04f88eaff7217bed4b874796e24cbf10e6'
const OLD = 'a6f3fcc33d89f1b582ebc9c18435894b4ffa3e27'
const AGENT = 'kod88vn' // the coding agent reviews as its working (human) account
const BOT = 'github-actions[bot]'
const COPILOT_BOT = 'copilot-pull-request-reviewer[bot]'
const COPILOT = 'Copilot'

const review = (user, state, commit, at, body = '') => ({
  user: { login: user }, state, commit_id: commit, submitted_at: at, body,
})

const ciRun = (status, conclusion, sha, at, name = 'PR CI') => ({
  name, status, conclusion, head_sha: sha, created_at: at,
})

const GREEN_CI = () => ciRun('completed', 'success', HEAD, '2026-09-27T02:20:00Z')

const agentApprovedHead = (at = '2026-09-27T02:26:42Z') =>
  review(AGENT, 'APPROVED', HEAD, at, '## AI Code Review\n\nApproved — reviewed per code-review skill.')

test('isTrustedReviewer excludes bots and GitHub AI accounts', () => {
  assert.equal(isTrustedReviewer('kod88vn'), true)
  assert.equal(isTrustedReviewer('github-actions[bot]'), false)
  assert.equal(isTrustedReviewer('copilot-pull-request-reviewer[bot]'), false)
  assert.equal(isTrustedReviewer('Copilot'), false)
  assert.equal(isTrustedReviewer(null), false)
})

test('allows merge when the agent approved the head commit and CI is green', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.deepEqual(result, { mergeable: true, reasons: [], ciRunning: false })
})

test('refuses when there is no approval at all', () => {
  const result = evaluateMergeGate({
    headSha: HEAD, reviews: [], unresolvedThreads: 0, reviewRunsInProgress: 0, ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /no approval from a trusted reviewer/)
})

test('a bot approval alone is not a trusted approval', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [review(BOT, 'APPROVED', HEAD, '2026-09-27T02:26:42Z', '## AI Code Review\n')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /no approval from a trusted reviewer/)
})

test('a Copilot (GitHub AI) approval is not a trusted approval', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [review(COPILOT, 'APPROVED', HEAD, '2026-09-27T02:26:42Z')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
})

test('refuses when the agent approval is for an older commit', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [review(AGENT, 'APPROVED', OLD, '2026-09-27T02:23:47Z')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /a6f3fcc.*not the head 29afcc0/)
})

test('refuses when the agent\'s latest review requests changes, even after an older approval', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [
      agentApprovedHead('2026-09-27T02:26:42Z'),
      review(AGENT, 'CHANGES_REQUESTED', HEAD, '2026-09-27T02:30:00Z'),
    ],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /kod88vn requested changes/)
})

test('a dismissed change request no longer blocks, even after an older one', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [
      review(AGENT, 'CHANGES_REQUESTED', HEAD, '2026-09-27T02:27:00Z', 'no'),
      agentApprovedHead('2026-09-27T02:28:00Z'),
      review(AGENT, 'DISMISSED', HEAD, '2026-09-27T02:29:00Z'),
    ],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.deepEqual(result, { mergeable: true, reasons: [], ciRunning: false })
})

test('refuses when review threads are unresolved (PR #45 regression)', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [
      agentApprovedHead(),
      review(COPILOT, 'COMMENTED', OLD, '2026-09-27T02:27:02Z', '<!-- ccr-overview-v2 -->'),
    ],
    unresolvedThreads: 8,
    reviewRunsInProgress: 0,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /8 unresolved review thread/)
})

test('refuses while a review run is still in progress', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 1,
    ciRuns: [GREEN_CI()],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /1 review run still in progress/)
})

test('refuses when no PR CI run exists for the head commit', () => {
  const result = evaluateMergeGate({
    headSha: HEAD, reviews: [agentApprovedHead()], unresolvedThreads: 0,
    reviewRunsInProgress: 0, ciRuns: [],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /no PR CI run for the head commit/)
})

test('refuses while the PR CI run is still in progress', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [ciRun('in_progress', null, HEAD, '2026-09-27T02:20:00Z')],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /PR CI tests are still running/)
})

test('refuses when the PR CI run failed', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [ciRun('completed', 'failure', HEAD, '2026-09-27T02:20:00Z')],
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /no green test run for the head commit \(latest: failure\)/)
})

test('trusts the green test job even when the run overall failed (red merge job)', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [{ ...ciRun('completed', 'failure', HEAD, '2026-09-27T02:20:00Z'), prCi: { status: 'completed', conclusion: 'success' } }],
  })
  assert.deepEqual(result, { mergeable: true, reasons: [], ciRunning: false })
})

test('skips its own unread run so an in-progress self-run does not deadlock the gate', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [
      { ...ciRun('in_progress', null, HEAD, '2026-09-27T02:30:00Z'), id: 42, prCi: null },
      GREEN_CI(),
    ],
    ownRunId: 42,
  })
  assert.deepEqual(result, { mergeable: true, reasons: [], ciRunning: false })
})

test('waits while a test run is still going, instead of failing on the older red result', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [
      { ...ciRun('in_progress', null, HEAD, '2026-09-27T02:30:00Z'), id: 42, prCi: { status: 'in_progress', conclusion: null } },
      { ...ciRun('completed', 'failure', HEAD, '2026-09-27T02:20:00Z'), prCi: { status: 'completed', conclusion: 'failure' } },
    ],
    ownRunId: 42,
  })
  assert.equal(result.mergeable, false)
  assert.equal(result.ciRunning, true)
  assert.match(result.reasons.join('\n'), /tests are still running/)
})

test('ignores a PR CI run for a different commit and uses the newest matching one', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [agentApprovedHead()],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
    ciRuns: [
      ciRun('completed', 'failure', OLD, '2026-09-27T01:00:00Z'),
      ciRun('completed', 'success', HEAD, '2026-09-27T02:20:00Z'),
    ],
  })
  assert.deepEqual(result, { mergeable: true, reasons: [], ciRunning: false })
})
