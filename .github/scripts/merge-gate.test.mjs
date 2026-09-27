import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateMergeGate } from './merge-gate.mjs'

const HEAD = '29afcc04f88eaff7217bed4b874796e24cbf10e6'
const OLD = 'a6f3fcc33d89f1b582ebc9c18435894b4ffa3e27'
const BOT = 'github-actions[bot]'
const COPILOT = 'copilot-pull-request-reviewer[bot]'

const review = (user, state, commit, at, body = '## AI Code Review\n') => ({
  user: { login: user }, state, commit_id: commit, submitted_at: at, body,
})
const botApprovedHead = review(BOT, 'APPROVED', HEAD, '2026-09-27T02:26:42Z')

test('allows merge when the bot approved the head commit and nothing is open', () => {
  const result = evaluateMergeGate({
    headSha: HEAD, reviews: [botApprovedHead], unresolvedThreads: 0, reviewRunsInProgress: 0,
  })
  assert.deepEqual(result, { mergeable: true, reasons: [] })
})

test('refuses when there is no bot review at all', () => {
  const result = evaluateMergeGate({
    headSha: HEAD, reviews: [], unresolvedThreads: 0, reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /no AI Code Review/)
})

test('refuses when the bot approval is for an older commit', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [review(BOT, 'APPROVED', OLD, '2026-09-27T02:23:47Z')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /a6f3fcc.*not the head 29afcc0/)
})

test('refuses when the latest bot review requests changes, even after an older approval', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [botApprovedHead, review(BOT, 'CHANGES_REQUESTED', HEAD, '2026-09-27T02:30:00Z')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /latest AI Code Review is CHANGES_REQUESTED/)
})

test('ignores non-review comments from the bot account when picking its verdict', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [botApprovedHead, review(BOT, 'COMMENTED', HEAD, '2026-09-27T02:31:00Z', 'fyi')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.deepEqual(result, { mergeable: true, reasons: [] })
})

test('refuses when the bot\'s latest approval was dismissed, even if an older one stands', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [botApprovedHead, review(BOT, 'DISMISSED', HEAD, '2026-09-27T02:32:00Z')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /latest AI Code Review is DISMISSED/)
})

test('a dismissed change request no longer blocks, even after an older one', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [
      botApprovedHead,
      review('kod88vn', 'CHANGES_REQUESTED', HEAD, '2026-09-27T02:27:00Z', 'no'),
      review('kod88vn', 'DISMISSED', HEAD, '2026-09-27T02:28:00Z', 'no'),
    ],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.deepEqual(result, { mergeable: true, reasons: [] })
})

test('refuses when any other reviewer\'s latest review requests changes', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [botApprovedHead, review('kod88vn', 'CHANGES_REQUESTED', HEAD, '2026-09-27T02:27:00Z', 'no')],
    unresolvedThreads: 0,
    reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /kod88vn requested changes/)
})

// Reproduces PR #45: bot approved the head, Copilot left 8 findings as a COMMENTED review
// on the old commit, and auto-merge went ahead because it only read the bot verdict.
test('refuses when review threads are unresolved (PR #45 regression)', () => {
  const result = evaluateMergeGate({
    headSha: HEAD,
    reviews: [
      review(BOT, 'CHANGES_REQUESTED', OLD, '2026-09-27T02:23:47Z'),
      botApprovedHead,
      review(COPILOT, 'COMMENTED', OLD, '2026-09-27T02:27:02Z', '<!-- ccr-overview-v2 -->'),
    ],
    unresolvedThreads: 8,
    reviewRunsInProgress: 0,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /8 unresolved review thread/)
})

test('refuses while another automated review is still running', () => {
  const result = evaluateMergeGate({
    headSha: HEAD, reviews: [botApprovedHead], unresolvedThreads: 0, reviewRunsInProgress: 1,
  })
  assert.equal(result.mergeable, false)
  assert.match(result.reasons.join('\n'), /1 review run still in progress/)
})
