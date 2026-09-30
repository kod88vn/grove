#!/bin/bash
# ============================================================================
# Loop driver template. Copy it, change the block marked CHANGE THESE, run it.
#
#   cp scripts/loop.sh tmp/WS-1234-loop.sh
#   $EDITOR tmp/WS-1234-loop.sh
#   bash tmp/WS-1234-loop.sh
#
# What makes this a loop rather than a prompt you sent:
#
#   1. The stop condition is a command's exit code, never the agent's opinion.
#   2. The verdict is computed by `cc loop record`, which re-checksums the spec
#      itself — so editing this script mid-run cannot talk the run into a green.
#   3. It has a finite budget. It always terminates and always says why.
#
# `code chat` prints nothing useful and its exit code is meaningless, so it is
# never consulted. Everything is measured on disk.
#
# The full method, including the states that are neither red nor green, is in
# LOOP.md.
# ============================================================================
set -u

# ---------------------------------------------------------------- CHANGE THESE
REPO="/absolute/path/to/target/repo"
TICKET="WS-0000"               # the loop KEY: a Jira key, or <REPO>-<slug> for a prompt requirement
SPEC="path/to/spec.test.ts"   # RELATIVE to $REPO. Checksum-locked; must be RED now.
BASELINE=0                    # current passing test count. Must GROW, never shrink.
MAX_ITER=4                    # agent turns you are willing to buy
POLL_LIMIT=72                 # x5s = 6 min of polling per iteration
WORKER="loop-worker"          # the cheap model does the grinding. See .github/agents/
# `code chat` has no model override flag. `cc models apply` generates
# <worker>.m-<model-slug>.agent.md for each worker-tier model only; the registry
# `ceilings` keep the worker on Luna. On a re-arm you may pick another of those
# variants (see registry/model-tiers.json and LOOP.md "Model tiers").
WORKER_AGENT="${WORKER_AGENT:-$WORKER}"
# Set this (RELATIVE to $REPO) when the loop is unblocking a guard, so editing the guard's
# config instead of the code is recorded as `cfg-tampered`. Leave empty otherwise.
GUARD_CONFIG=""

# The command whose exit code IS "done". If you cannot write one that exits
# non-zero today, stop: you have a wish, not a loop. Sets RC and TOTAL.
verify() {
  ( cd "$REPO" && ./node_modules/.bin/jest --passWithNoTests > "$OUT/verify.txt" 2>&1 )
  RC=$?
  TOTAL=$(grep -oE "Tests:.*[0-9]+ total" "$OUT/verify.txt" | grep -oE "[0-9]+" | tail -1)
  TOTAL=${TOTAL:-0}
}

# Written for a stranger who has never seen the requirement. Numbered requirements,
# file paths not adjectives. The prohibitions are NOT here on purpose — they live
# in the worker agent, so every dispatch carries them and this briefing does not
# spend the worker's context restating rules it already has.
TASK="Requirement $TICKET in this repo.

The acceptance criteria are already written as an executable spec: $SPEC
It is the definition of done. Make it pass. Concretely it requires:
  1. <requirement, with the file path it touches>
  2. <requirement>
Follow the patterns already used in <path to imitate>.

Verify with: cd $REPO && ./node_modules/.bin/jest"
# ------------------------------------------------------------ END CHANGE THESE

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
# The driver lives in cc's scripts/ or tmp/, so cc is one directory up from it.
CC_ROOT="${CC_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
[ -f "$CC_ROOT/bin/cc.ts" ] || { echo "ABORT — $CC_ROOT is not central-command; set CC_ROOT"; exit 1; }
cc() { npm --prefix "$CC_ROOT" run --silent cc -- "$@"; }
# shellcheck source=loop-lib.sh
source "$CC_ROOT/scripts/loop-lib.sh"
# Before anything touches $REPO: a second driver on the same repo would dispatch a second
# worker into the same window and judge the first one's edits.
acquire_repo_lock "$CC_ROOT" "$REPO" || exit 1
OUT="$CC_ROOT/tmp/$TICKET"
# `code chat -m` resolves the agent in $REPO's window, so that is where the file must be.
AGENT="$REPO/.github/agents/$WORKER_AGENT.agent.md"
mkdir -p "$OUT"

# Reuse an existing dedicated repo window, or launch one once and verify readiness.
# The repo lock prevents two drivers from opening duplicate windows for the same repo.
ensure_repo_window "$CODE" "$REPO" || exit 3
trap 'exit 130' INT
trap 'exit 143' TERM

# If the agent file is missing from $REPO, `code chat -m` silently falls back to the
# default agent on whatever model the window last used (a Luna worker ran on GPT-6 Sol
# that way, 2026-09-30). Install it there, then fail loudly if it is still absent.
bash "$CC_ROOT/scripts/install-worker-agent.sh" "$CC_ROOT" "$REPO" "$WORKER_AGENT" || exit 1
[ -f "$AGENT" ] || { echo "ABORT — no agent file at $AGENT"; exit 1; }
MODEL=$(grep -m1 '^model:' "$AGENT")

echo "============================================================"
echo " $TICKET  |  $REPO"
echo " branch  : $(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
echo " spec    : $SPEC"
echo " baseline: $BASELINE tests must grow"
echo " budget  : $MAX_ITER iterations"
echo " worker  : $WORKER_AGENT — $MODEL"
echo "============================================================"

echo "--- iteration 0: confirm the work is genuinely undone ---"
verify
SUPPRESSIONS="$(count_suppressions "$REPO")"
echo "verifier exit: $RC ($TOTAL tests, $SUPPRESSIONS suppressions)"
RUN=$(cc loop start --ticket="$TICKET" --repo="$REPO" --spec="$SPEC" ${GUARD_CONFIG:+--config="$GUARD_CONFIG"} \
        --suppressions="$SUPPRESSIONS" --verifier="jest" --exit="$RC" --tests="$BASELINE" --budget="$MAX_ITER") || {
  echo "ABORT — refused to start: already green, or the spec is unreadable."; exit 1; }
echo "run $RUN — watch it at http://127.0.0.1:4747/loops/$RUN"

ITER=0
STATE=red
FAULT=""
while [ "$ITER" -lt "$MAX_ITER" ]; do
  ITER=$((ITER + 1))
  echo "--- iteration $ITER of $MAX_ITER ---"

  # Feed back only the lines that matter. The whole log spends the turn's
  # context on noise. failure_lines knows jest, vitest and node --test, and
  # falls back to the log tail; it never returns nothing.
  FAILURES="$(failure_lines "$OUT/verify.txt")"

  "$CODE" "$REPO" >/dev/null 2>&1        # focus the existing window on the target repo
  sleep 6
  echo "dispatching $WORKER_AGENT..."
  # The first line is the worker's preflight sentinel and the watch key. It names the run and
  # iteration, so `cc loop watch` finds exactly this dispatch. Keep it first and keep it literal.
  SENTINEL="LOOP DRIVER DISPATCH — $TICKET run $RUN iteration $ITER of $MAX_ITER"
  SENT_AT=$(date +%s)
  "$CODE" chat -m "$WORKER_AGENT" -r "$SENTINEL

$TASK

Current verifier output:
$FAILURES" > "$OUT/cli-$ITER.out" 2>&1

  POLLS=0
  while [ "$POLLS" -lt "$POLL_LIMIT" ]; do
    sleep 5; POLLS=$((POLLS + 1))
    verify
    [ "$RC" -eq 0 ] && { echo "verifier exit 0 after $((POLLS * 5))s"; break; }
    # Watch the dispatch itself, not just the verifier: a refusal used to cost the full poll
    # budget per iteration while the worker had already stopped.
    WATCH="$(cc loop watch --repo="$REPO" --sentinel="$SENTINEL" --since="$SENT_AT")"
    ACTION="$(dispatch_action "${WATCH%% *}" $(( $(date +%s) - SENT_AT )))"
    case "$ACTION" in
      refused|lost)
        FAULT="dispatch-$ACTION"
        echo "DRIVER_FAULT=$FAULT iteration=$ITER watch=$(printf '%s' "$WATCH" | tr '\n' ' ')"
        break ;;
      idle)
        verify   # the worker may have finished between the last verify and the watch
        echo "  worker finished at $((POLLS * 5))s; verifier exit $RC"
        break ;;
    esac
    [ $((POLLS % 12)) -eq 0 ] && echo "  ...still red at $((POLLS * 5))s ($WATCH)" | head -1
  done

  # The ledger judges, not this script. It re-reads the spec checksum here.
  STATE=$(cc loop record --run="$RUN" --iteration="$ITER" --exit="$RC" \
            --suppressions="$(count_suppressions "$REPO")" --tests="$TOTAL" --tail="$OUT/verify.txt")
  echo "iteration $ITER: $STATE"
  [ -n "$FAULT" ] && break
  [ "$STATE" != "red" ] && break
done

echo
echo "===================== RESULT ====================="
cc loop finish --run="$RUN"
if [ -n "$FAULT" ]; then
  # Not a verdict on the code: the machinery failed. The architect repairs the dispatch (agent
  # file in $REPO, sentinel, window, model) and re-launches; it does not re-arm the spec.
  echo "$FAULT" > "$OUT/fault"
  echo "DRIVER_FAULT=$FAULT — the dispatch failed, not the code. Repair the machinery and re-launch."
fi
echo
echo "--- changes in $REPO ---"
git -C "$REPO" status --porcelain
git -C "$REPO" diff --stat
echo
echo "The loop stops at green. It does not commit, push, or open a PR — read the"
echo "diff yourself, then close the ticket with: npm run cc -- resolve --apply"
# A distinct exit status, so loop-detach's .exit file tells a machinery fault from a red run.
[ -n "$FAULT" ] && exit 3
exit 0
