// Merge gate for pr-auto-merge. Branch protection is unavailable on this free-plan
// repo (the API returns 403), so this script is the only thing standing between a review
// and a merge. PR #45 merged with 8 open Copilot findings because the old gate read only
// the paid AI reviewer's verdict output; this reads the PR's actual review state instead.
//
// The code review itself is performed by the coding agent, free (see AGENTS.md,
// "Code Review (Agent-Performed)"). The agent reviews as its working (human) account,
// never as a bot — so this gate requires an approval from a trusted HUMAN account.
import { execFileSync } from 'node:child_process'

// GitHub's own AI review identities are AI, not trusted human reviewers.
const TRUSTED_AI_LOGINS = new Set(['copilot'])
// Bots are identified by the "[bot]" suffix on the login.
const REVIEW_WORKFLOW_PATTERN = /Copilot Code Review/i
// The test/build workflow that must be green for the head commit before merging.
const CI_WORKFLOW_NAME = 'PR CI'
// The test/build job inside that workflow. The gate checks this job's own state:
// run-level status is unreliable here (the merge job itself keeps its run in
// progress, and a red merge job can fail an otherwise green run).
const CI_JOB_NAME = 'pr-ci'
// A user's LATEST review (any state, incl. plain comments). While that review
// is a change request it blocks the merge; any newer review by the same user
// (a re-review after fixes) clears it — which is also the only way the coding
// agent can clear its own change request on its own PR, because GitHub forbids
// approving one's own PR, so the agent's re-review is a comment.
function latestTrustedReview(reviews) {
  const latest = new Map()
  for (const r of [...reviews].sort(byTime)) {
    if (!isTrustedReviewer(r.user?.login)) continue
    latest.set(r.user.login, r.state)
  }
  return latest
}
// GitHub forbids approving a PR you created, so on the agent's OWN pull request
// the review is posted as a COMMENT whose body starts with this marker. A marked
// review by a trusted account on the current head satisfies the review
// requirement exactly like an approval does. (pr-ci.yml's review-status job
// accepts the same marker — keep the two in sync.)
export const AGENT_REVIEW_MARKER = '## AI Code Review'
// States of a marked review that count as "the agent reviewed this head" (a
// CHANGES_REQUESTED is a block, not a satisfaction).
const AGENT_REVIEW_COUNT_STATES = new Set(['COMMENTED', 'APPROVED'])

const short = (sha) => (sha || '').slice(0, 7)
const byTime = (a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at)

/**
 * Trusted reviewer = a real human account. Bots (`[bot]` suffix) and GitHub's own
 * AI review accounts are excluded. The coding agent posts its approval as the working
 * account, which is a human login — that is the required verdict.
 */
export function isTrustedReviewer(login) {
  if (!login) return false
  if (login.endsWith('[bot]')) return false
  if (TRUSTED_AI_LOGINS.has(login.toLowerCase())) return false
  return true
}

function latestAgentReview(reviews) {
  return reviews
    .filter((r) => isTrustedReviewer(r.user?.login) && (r.body || '').startsWith(AGENT_REVIEW_MARKER))
    .sort(byTime)
    .at(-1)
}
export function evaluateMergeGate({
  headSha,
  reviews,
  unresolvedThreads,
  reviewRunsInProgress,
  ciRuns,
  ownRunId = Number(process.env.GITHUB_RUN_ID || 0),
}) {
  const reasons = []

  // 1) The review must be satisfied on the current head commit: either an
  //    approval from a trusted reviewer, or the coding agent's own marked
  //    review (a comment — GitHub forbids approving one's own PR).
  const approvals = reviews
    .filter((r) => isTrustedReviewer(r.user?.login) && r.state === 'APPROVED')
    .sort(byTime)
  const latestApproval = approvals.at(-1)
  const agentReview = latestAgentReview(reviews)
  const reviewSatisfied =
    (latestApproval && latestApproval.commit_id === headSha) ||
    (agentReview && agentReview.commit_id === headSha && AGENT_REVIEW_COUNT_STATES.has(agentReview.state))
  if (!reviewSatisfied) {
    if (latestApproval) {
      reasons.push(`latest approval is for ${short(latestApproval.commit_id)}, not the head ${short(headSha)}`)
    } else {
      reasons.push('no approval from a trusted reviewer yet (the coding agent must review first)')
    }
    if (agentReview) {
      if (agentReview.commit_id === headSha) {
        reasons.push(`the coding agent's marked review for the head is not a verdict yet (state ${agentReview.state})`)
      } else {
        reasons.push(`latest agent review is for ${short(agentReview.commit_id)}, not the head ${short(headSha)}`)
      }
    } else {
      reasons.push('no agent review posted yet (the coding agent must review and post its verdict first)')
    }
  }

  // 2) Any trusted reviewer whose LATEST review is CHANGES_REQUESTED blocks.
  //    The coding agent is included: its own marked change request blocks until
  //    it re-reviews (a newer review by the same user clears it).
  for (const [user, state] of latestTrustedReview(reviews)) {
    if (state === 'CHANGES_REQUESTED') reasons.push(`${user} requested changes`)
  }

  // 3) Open feedback must be closed.
  if (unresolvedThreads > 0) {
    reasons.push(`${unresolvedThreads} unresolved review thread(s)`)
  }
  if (reviewRunsInProgress > 0) {
    const s = reviewRunsInProgress === 1 ? '' : 's'
    reasons.push(`${reviewRunsInProgress} review run${s} still in progress`)
  }

  // 4) The PR CI test job must have gone green for the head commit. Job-level
  //    state is authoritative; runs whose job state is unread fall back to
  //    run-level. The run hosting this very gate is in progress by definition,
  //    but its test job already settled (we run after it) — so a self-run with
  //    an unread job is skipped rather than counted as still running.
  let ciRunning = false
  let green = false
  let latestOutcome = null
  const relevant = (ciRuns || []).filter((r) => r.name === CI_WORKFLOW_NAME && r.head_sha === headSha)
  for (const r of [...relevant].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))) {
    if (ownRunId && r.id === ownRunId && !r.prCi) continue
    const job = r.prCi || { status: r.status, conclusion: r.conclusion }
    if (job.status === 'queued' || job.status === 'in_progress') {
      ciRunning = true
      continue
    }
    if (job.status === 'completed' || job.conclusion) {
      if (job.conclusion === 'success') green = true
      latestOutcome = job.conclusion
    }
  }
  if (relevant.length === 0) {
    reasons.push(`no ${CI_WORKFLOW_NAME} run for the head commit yet`)
  } else if (ciRunning) {
    reasons.push(`${CI_WORKFLOW_NAME} tests are still running for the head commit`)
  } else if (!green) {
    reasons.push(`${CI_WORKFLOW_NAME} has no green test run for the head commit (latest: ${latestOutcome || 'unknown'})`)
  }

  return { mergeable: reasons.length === 0, reasons, ciRunning }
}

function gh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' })
}

const THREADS_QUERY = `query($owner:String!,$name:String!,$number:Int!){
  repository(owner:$owner,name:$name){ pullRequest(number:$number){
    reviewThreads(first:100){ nodes{ isResolved } } } } }`

function fetchState({ repo, number, headRef }) {
  const [owner, name] = repo.split('/')
  const pages = JSON.parse(gh(['api', `repos/${repo}/pulls/${number}/reviews`, '--paginate', '--slurp']))
  const reviews = pages.flat()
  const threads = JSON.parse(gh([
    'api', 'graphql', '-f', `query=${THREADS_QUERY}`,
    '-f', `owner=${owner}`, '-f', `name=${name}`, '-F', `number=${number}`,
    '--jq', '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)] | length',
  ]))
  const runs = JSON.parse(gh([
    'api', `repos/${repo}/actions/runs?branch=${encodeURIComponent(headRef)}&per_page=50`,
    '--jq', '[.workflow_runs[] | {id, name, status, conclusion, head_sha, created_at}]',
  ]))
  const inProgress = runs.filter((r) => REVIEW_WORKFLOW_PATTERN.test(r.name) && r.status !== 'completed')
  // Attach the test job's own state to each PR CI run of this head commit, so the
  // gate judges the tests, not the run as a whole.
  const headSha = process.env.HEAD_SHA || ''
  const ciRuns = runs.map((r) => ({
    ...r,
    prCi: r.name === CI_WORKFLOW_NAME && r.head_sha === headSha ? fetchCiJob(repo, r.id) : null,
  }))
  return { reviews, unresolvedThreads: threads, reviewRunsInProgress: inProgress.length, ciRuns }
}

/** Job-level state of the CI test job within a run (null if not found or on error). */
function fetchCiJob(repo, runId) {
  try {
    return JSON.parse(gh([
      'api', `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`,
      '--jq', `[.jobs[] | select(.name == "${CI_JOB_NAME}") | {status, conclusion}] | first // null`,
    ]))
  } catch (e) {
    console.log(`could not read ${CI_JOB_NAME} job state for run ${runId} (${e.message}) — falling back to run-level state`)
    return null
  }
}

// While the only blocker is a still-running PR CI, the gate re-checks until it
// settles. Without this, a review-triggered run would die while the earlier
// test run was still going, then that earlier run would see the dead red run
// and die too — a deadlock that only a manual re-run could break.
const WAIT_INTERVAL_MS = 30_000
const WAIT_LIMIT_MS = 25 * 60_000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  const { REPO, PR_NUMBER, HEAD_SHA, HEAD_REF } = process.env
  if (!REPO || !PR_NUMBER || !HEAD_SHA || !HEAD_REF) {
    throw new Error('merge-gate needs REPO, PR_NUMBER, HEAD_SHA and HEAD_REF')
  }
  const started = Date.now()
  let result
  for (;;) {
    const state = fetchState({ repo: REPO, number: Number(PR_NUMBER), headRef: HEAD_REF })
    result = evaluateMergeGate({ headSha: HEAD_SHA, ...state })
    if (!result.mergeable && result.ciRunning && Date.now() - started < WAIT_LIMIT_MS) {
      console.log(`${CI_WORKFLOW_NAME} still running — re-checking in ${WAIT_INTERVAL_MS / 1000}s (waiting up to ${WAIT_LIMIT_MS / 60000} min)…`)
      await sleep(WAIT_INTERVAL_MS)
      continue
    }
    break
  }
  if (!result.mergeable) {
    console.log(`Not merging PR #${PR_NUMBER}:`)
    for (const reason of result.reasons) console.log(`  - ${reason}`)
    process.exit(1)
  }
  console.log(`PR #${PR_NUMBER} passes the merge gate at ${short(HEAD_SHA)}.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
