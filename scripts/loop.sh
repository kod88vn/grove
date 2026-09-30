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
# <worker>.m-<model-slug>.agent.md for each model in this and higher tiers.
# On a re-arm, choose a registered model and set WORKER_AGENT to its exact
# variant (see registry/model-tiers.json and LOOP.md "Model tiers").
WORKER_AGENT="${WORKER_AGENT:-$WORKER}"

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
CC="npm --prefix $CC_ROOT run --silent cc --"
OUT="$CC_ROOT/tmp/$TICKET"
AGENT="$CC_ROOT/.github/agents/$WORKER_AGENT.agent.md"
mkdir -p "$OUT"

# Does a window on $REPO already exist? Checked BEFORE the first "$CODE" "$REPO"
# call below, which then only focuses that window.
BASE="$(basename "$REPO")"
window_exists_for_base() {
  local base="$1"
  "$CODE" --status 2>/dev/null | while IFS= read -r line; do
    case "$line" in
      *"window ["*"("*")"*) ;;
      *) continue ;;
    esac
    title="$(printf '%s\n' "$line" | sed -E 's/^.*window \[[0-9]+\] \((.*)\)[[:space:]]*$/\1/')"
    folder_part="$title"
    case "$title" in
      *" — "*) folder_part="${title##*" — "}" ;;
    esac
    [ "$folder_part" = "$base" ] && { echo yes; break; }
  done
}
# Reuse an already-open window; never open a new one. A window this script
# opens cannot be closed reliably, so every new folder left an orphan behind
# (nine of them on 2026-09-27). Point REPO at a folder whose window is open —
# switch branches inside it rather than adding a fresh worktree per item.
if [ -z "$(window_exists_for_base "$BASE")" ]; then
  echo "ABORT — no open window on ($BASE). Reuse an existing loop folder"
  echo "        (git -C <folder> switch -c <branch> <base>) instead of opening a new one."
  exit 1
fi
trap 'exit 130' INT
trap 'exit 143' TERM

# If the agent file is missing, `code chat -m` silently falls back to the default
# agent on whatever model the window last used. The loop still runs; it just costs
# what it was built not to cost. Fail loudly instead.
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
echo "verifier exit: $RC ($TOTAL tests)"
RUN=$($CC loop start --ticket="$TICKET" --repo="$REPO" --spec="$SPEC" \
        --verifier="jest" --exit="$RC" --tests="$BASELINE" --budget="$MAX_ITER") || {
  echo "ABORT — refused to start: already green, or the spec is unreadable."; exit 1; }
echo "run $RUN — watch it at http://127.0.0.1:4747/loops/$RUN"

ITER=0
STATE=red
while [ "$ITER" -lt "$MAX_ITER" ]; do
  ITER=$((ITER + 1))
  echo "--- iteration $ITER of $MAX_ITER ---"

  # Feed back only the lines that matter. The whole log spends the turn's
  # context on noise.
  FAILURES="$(grep -E "^(  ●|Cannot find module|Tests:)" "$OUT/verify.txt" | head -25)"

  "$CODE" "$REPO" >/dev/null 2>&1        # focus the existing window on the target repo
  sleep 6
  echo "dispatching $WORKER_AGENT..."
  "$CODE" chat -m "$WORKER_AGENT" -r "$TASK

Current verifier output:
$FAILURES" > "$OUT/cli-$ITER.out" 2>&1

  POLLS=0
  while [ "$POLLS" -lt "$POLL_LIMIT" ]; do
    sleep 5; POLLS=$((POLLS + 1))
    verify
    [ "$RC" -eq 0 ] && { echo "verifier exit 0 after $((POLLS * 5))s"; break; }
    [ $((POLLS % 12)) -eq 0 ] && echo "  ...still red at $((POLLS * 5))s"
  done

  # The ledger judges, not this script. It re-reads the spec checksum here.
  STATE=$($CC loop record --run="$RUN" --iteration="$ITER" --exit="$RC" \
            --tests="$TOTAL" --tail="$OUT/verify.txt")
  echo "iteration $ITER: $STATE"
  [ "$STATE" != "red" ] && break
done

echo
echo "===================== RESULT ====================="
$CC loop finish --run="$RUN"
echo
echo "--- changes in $REPO ---"
git -C "$REPO" status --porcelain
git -C "$REPO" diff --stat
echo
echo "The loop stops at green. It does not commit, push, or open a PR — read the"
echo "diff yourself, then close the ticket with: npm run cc -- resolve --apply"
