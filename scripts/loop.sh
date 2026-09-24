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
# It does not open a window. Each iteration dispatches into the window you are
# already in, and `code chat` starts a fresh chat session per invocation, so the
# worker never inherits the previous attempt's context. Verified 2026-09-23: two
# dispatches four minutes apart produced two new session files, one turn each.
#
# The full method, including the states that are neither red nor green, is in
# LOOP.md.
# ============================================================================
set -u

# ---------------------------------------------------------------- CHANGE THESE
# REPO must be a worktree under tmp/ — see the guard below for why.
#   git -C ~/dev/web-storefront-engine worktree add \
#       /Users/jay.quach/dev/bot/tmp/WS-1234 feature/WS-1234-desc
REPO="/Users/jay.quach/dev/bot/tmp/WS-0000"
TICKET="WS-0000"
SPEC="path/to/spec.test.ts"   # RELATIVE to $REPO. Checksum-locked; must be RED now.
BASELINE=0                    # current passing test count. Must GROW, never shrink.
MAX_ITER=4                    # agent turns you are willing to buy
POLL_LIMIT=72                 # x5s = 6 min of polling per iteration
WORKER="loop-worker"          # the cheap model does the grinding. See .github/agents/
EXPECTED_MODEL="gpt-5.6-luna" # the pin. The agent frontmatter lists Sonnet 5 as a fallback,
                               # and a dispatch that fell back to it is still a failure here.

# The command whose exit code IS "done". If you cannot write one that exits
# non-zero today, stop: you have a wish, not a loop. Sets RC and TOTAL.
verify() {
  ( cd "$REPO" && ./node_modules/.bin/jest --passWithNoTests > "$OUT/verify.txt" 2>&1 )
  RC=$?
  TOTAL=$(grep -oE "Tests:.*[0-9]+ total" "$OUT/verify.txt" | grep -oE "[0-9]+" | tail -1)
  TOTAL=${TOTAL:-0}
}

# Written for a stranger who has never seen the ticket. Numbered requirements,
# file paths not adjectives. The prohibitions are NOT here on purpose — they live
# in the worker agent, so every dispatch carries them and this briefing does not
# spend the worker's context restating rules it already has.
TASK="Ticket $TICKET in this repo.

The acceptance criteria are already written as an executable spec: $SPEC
It is the definition of done. Make it pass. Concretely it requires:
  1. <requirement, with the file path it touches>
  2. <requirement>
Follow the patterns already used in <path to imitate>.

Verify with: cd $REPO && ./node_modules/.bin/jest"
# ------------------------------------------------------------ END CHANGE THESE

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
BOT="/Users/jay.quach/dev/bot"
CC="npm --prefix $BOT run --silent cc --"
OUT="$BOT/tmp/loop-$TICKET"
AGENT="$BOT/.github/agents/$WORKER.agent.md"

# Ground truth for "did the dispatch actually run on $EXPECTED_MODEL": the agent's own
# self-report is useless (it always answers "GitHub Copilot", never its real model), and
# the frontmatter above is intent, not proof. VS Code drops a session record with a real
# modelId into this window's workspaceStorage the instant a `code chat` invocation starts.
# This hash is THIS window's, so it only proves dispatches made from this script/session.
SESS="$HOME/Library/Application Support/Code/User/workspaceStorage/4dca35a9800ac0c38e22ac549607ff3f/chatSessions"

# If the agent file is missing, `code chat -m` silently falls back to the default
# agent on whatever the window last used. The loop still runs; it just costs
# what it was built not to cost. Fail loudly instead.
[ -f "$AGENT" ] || { echo "ABORT — no agent file at $AGENT"; exit 1; }
MODEL=$(grep -m1 '^model:' "$AGENT")

# The dispatch lands in the last active window, and the worker's tools are scoped
# to THAT window's workspace. So the target must sit inside this one. Two
# separate things break if it does not:
#   - editing outside the workspace root raises a permission prompt per file, so
#     an unattended loop stalls on the worker's first write;
#   - $WORKER resolves only through this repo's .github/agents (chat.promptFiles
#     Locations in .vscode/settings.json is workspace-relative, and the user-level
#     prompts folder has no loop agent), so a window rooted elsewhere silently
#     runs the default agent on whatever model it last used.
# tmp/ is gitignored and is where .github/instructions/scratch-space.instructions.md
# already requires throwaway clones and worktrees to live.
#
# These run BEFORE any mkdir, so the script cannot create the thing it validates.
case "$REPO" in
  "$BOT"/tmp/?*) ;;
  *) echo "ABORT — REPO must be a worktree under $BOT/tmp/, got: $REPO"
     echo "  git -C <source repo> worktree add $BOT/tmp/$TICKET <branch>"
     exit 1 ;;
esac
[ -d "$REPO" ] || { echo "ABORT — no such directory: $REPO"; exit 1; }
[ -d "$SESS" ] || { echo "ABORT — no chat session directory: $SESS"; exit 1; }

# A bare directory under tmp/ is still INSIDE the bot repo, so every `git -C
# "$REPO"` would silently operate on central-command itself — the loop would
# report bot's branch and diff bot's tree. Demand a real worktree root.
TOP=$(git -C "$REPO" rev-parse --show-toplevel 2>/dev/null || true)
[ "$TOP" = "$REPO" ] || {
  echo "ABORT — $REPO is not a git worktree root (resolves to: ${TOP:-none})."
  echo "  It is a plain directory inside $BOT, so git would act on central-command."
  exit 1; }

mkdir -p "$OUT"

# Proves a dispatch ran on the pinned model instead of trusting frontmatter or the
# agent's own claim. Args: the sorted session-file list captured immediately before
# the dispatch. Aborts the whole loop (not just the iteration) on any mismatch, so a
# silently-downgraded dispatch never gets counted as a real attempt.
assert_worker_model() {
  local before="$1"
  local polls=0 new_files="" new_count=0 model_line=""

  while [ "$polls" -lt 30 ]; do   # 30 x 2s = 60s
    sleep 2
    polls=$((polls + 1))
    local after
    after=$(ls -1 "$SESS"/*.jsonl 2>/dev/null | sort)
    new_files=$(comm -13 <(printf '%s\n' "$before") <(printf '%s\n' "$after"))
    new_count=$(printf '%s\n' "$new_files" | grep -c .)
    if [ "$new_count" -eq 1 ]; then
      model_line=$(grep -o '"modelId":"[^"]*"' "$new_files" 2>/dev/null | sed 's#"copilot/#"#' | sort -u)
      [ -n "$model_line" ] && break
    fi
  done

  if [ "$new_count" -ne 1 ]; then
    echo "ABORT — expected exactly 1 new chat session after ${polls}x2s, saw $new_count:"
    printf '%s\n' "$new_files"
    $CC loop finish --run="$RUN"
    exit 1
  fi
  if [ -z "$model_line" ]; then
    echo "ABORT — session $(basename "$new_files") had no modelId after 60s"
    $CC loop finish --run="$RUN"
    exit 1
  fi
  if [ "$model_line" != "\"modelId\":\"$EXPECTED_MODEL\"" ]; then
    echo "ABORT — session $(basename "$new_files") ran as $model_line, expected \"modelId\":\"$EXPECTED_MODEL\""
    $CC loop finish --run="$RUN"
    exit 1
  fi

  echo "worker session $(basename "$new_files" .jsonl | cut -c1-8) ran as $EXPECTED_MODEL"
}

echo "============================================================"
echo " $TICKET  |  $REPO"
echo " branch  : $(git -C "$REPO" rev-parse --abbrev-ref HEAD)"
echo " spec    : $SPEC"
echo " baseline: $BASELINE tests must grow"
echo " budget  : $MAX_ITER iterations"
echo " worker  : $WORKER — $MODEL"
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

  # No window is opened. `-r` targets the last active window, which is this one
  # so long as you do not click into another VS Code window mid-run.
  BEFORE_SESS=$(ls -1 "$SESS"/*.jsonl 2>/dev/null | sort)

  echo "dispatching $WORKER..."
  "$CODE" chat -m "$WORKER" -r "$TASK

Current verifier output:
$FAILURES" > "$OUT/cli-$ITER.out" 2>&1

  assert_worker_model "$BEFORE_SESS"

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
