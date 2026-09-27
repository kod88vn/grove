// Merge gate for pr-auto-merge. Branch protection is unavailable on this private free-plan
// repo (the API returns 403), so this script is the only thing standing between a review
// and a merge. PR #45 merged with 8 open Copilot findings because the old gate read only
// the AI reviewer's verdict output; this reads the PR's actual review state instead.
import { execFileSync } from 'node:child_process'

const BOT_LOGIN = 'github-actions[bot]'
const BOT_REVIEW_MARKER = '## AI Code Review'
const REVIEW_WORKFLOW_PATTERN = /Copilot Code Review/i
const VERDICT_STATES = new Set(['APPROVED', 'CHANGES_REQUESTED'])

const short = (sha) => (sha || '').slice(0, 7)
const byTime = (a, b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at)

function latestBotVerdict(reviews) {
  return reviews
    .filter((r) => r.user?.login === BOT_LOGIN)
    .filter((r) => (r.body || '').startsWith(BOT_REVIEW_MARKER))
    .filter((r) => VERDICT_STATES.has(r.state))
    .sort(byTime)
    .at(-1)
}

function reviewersRequestingChanges(reviews) {
  const latestByUser = new Map()
  for (const r of [...reviews].sort(byTime)) {
    if (r.user?.login === BOT_LOGIN) continue
    if (!VERDICT_STATES.has(r.state)) continue
    latestByUser.set(r.user.login, r.state)
  }
  return [...latestByUser].filter(([, state]) => state === 'CHANGES_REQUESTED').map(([u]) => u)
}

export function evaluateMergeGate({ headSha, reviews, unresolvedThreads, reviewRunsInProgress }) {
  const reasons = []
  const bot = latestBotVerdict(reviews)
  if (!bot) {
    reasons.push('no AI Code Review verdict from the bot yet')
  } else if (bot.state !== 'APPROVED') {
    reasons.push(`latest AI Code Review is ${bot.state}`)
  } else if (bot.commit_id !== headSha) {
    reasons.push(`AI Code Review approved ${short(bot.commit_id)}, not the head ${short(headSha)}`)
  }
  for (const user of reviewersRequestingChanges(reviews)) {
    reasons.push(`${user} requested changes`)
  }
  if (unresolvedThreads > 0) {
    reasons.push(`${unresolvedThreads} unresolved review thread(s)`)
  }
  if (reviewRunsInProgress > 0) {
    reasons.push(`${reviewRunsInProgress} review run still in progress`)
  }
  return { mergeable: reasons.length === 0, reasons }
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
    '--jq', '[.workflow_runs[] | {name, status}]',
  ]))
  const inProgress = runs.filter((r) => REVIEW_WORKFLOW_PATTERN.test(r.name) && r.status !== 'completed')
  return { reviews, unresolvedThreads: threads, reviewRunsInProgress: inProgress.length }
}

function main() {
  const { REPO, PR_NUMBER, HEAD_SHA, HEAD_REF } = process.env
  if (!REPO || !PR_NUMBER || !HEAD_SHA || !HEAD_REF) {
    throw new Error('merge-gate needs REPO, PR_NUMBER, HEAD_SHA and HEAD_REF')
  }
  const state = fetchState({ repo: REPO, number: Number(PR_NUMBER), headRef: HEAD_REF })
  const result = evaluateMergeGate({ headSha: HEAD_SHA, ...state })
  if (!result.mergeable) {
    console.log(`Not merging PR #${PR_NUMBER}:`)
    for (const reason of result.reasons) console.log(`  - ${reason}`)
    process.exit(1)
  }
  console.log(`PR #${PR_NUMBER} passes the merge gate at ${short(HEAD_SHA)}.`)
}

if (import.meta.url === `file://${process.argv[1]}`) main()
