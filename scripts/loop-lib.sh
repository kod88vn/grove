#!/usr/bin/env bash
# Helpers sourced by every loop driver (scripts/loop.sh and its tmp/<KEY>-loop.sh copies).
# Kept apart from the template so they can be tested without VS Code, a ledger, or a model.

# Print what the worker needs to see from a verifier log. Never prints nothing: run 147 sent an
# empty `Current verifier output:` for a `node --test` suite, because the filter only knew jest,
# and every iteration was spent on a worker that refused the dispatch.
failure_lines() {
  local log="$1" found
  [ -s "$log" ] || { echo "(the verifier printed nothing — run it yourself)"; return 0; }
  if grep -q '^✖ failing tests:' "$log"; then
    grep -E '^ℹ (tests|pass|fail) ' "$log"
    sed -n '/^✖ failing tests:/,$p' "$log" | head -40
    return 0
  fi
  found="$(grep -E -A3 '^(  ●|Cannot find module|not ok | FAIL | +× |Error:)' "$log" | head -40)"
  if [ -n "$found" ]; then
    printf '%s\n' "$found"
    grep -E '^(Tests:| +Tests +)' "$log"
    return 0
  fi
  echo "(no failure lines recognised; last 40 lines of the verifier log follow)"
  tail -40 "$log"
}

# Suppressions a worker could add instead of a fix. Counted before the first turn and after every
# turn; any increase is the `suppressed` verdict.
SUPPRESSION_RE='eslint-disable|@ts-ignore|@ts-expect-error|@ts-nocheck|istanbul ignore|c8 ignore|(it|test|describe)\.(skip|only|todo)\(|(^|[^A-Za-z0-9_.])x(it|test|describe)\(|[{,] *(skip|todo): *true'
count_suppressions() {
  git -C "$1" grep -I -o -h -E --untracked "$SUPPRESSION_RE" -- . ':(exclude)node_modules' 2>/dev/null \
    | wc -l | tr -d ' '
}

# One driver per target repo. Two drivers on one repo dispatch two workers into one window and
# judge each other's edits; run 147 did exactly that. mkdir is atomic; a lock whose holder is
# dead is taken over. Released on exit.
acquire_repo_lock() {
  local cc_root="$1" repo="$2" holder
  mkdir -p "$cc_root/tmp/loop-locks"
  REPO_LOCK="$cc_root/tmp/loop-locks/$(printf '%s' "$repo" | tr -c 'A-Za-z0-9._-' '_').lock"
  if ! mkdir "$REPO_LOCK" 2>/dev/null; then
    holder="$(cat "$REPO_LOCK/pid" 2>/dev/null)"
    if [ -n "$holder" ] && kill -0 "$holder" 2>/dev/null; then
      echo "ABORT — another loop driver (pid $holder) holds $repo. Attach to it with"
      echo "        scripts/loop-detach.sh, or wait for it to finish."
      return 1
    fi
    rm -rf "$REPO_LOCK"
    mkdir "$REPO_LOCK" 2>/dev/null || { echo "ABORT — lost the race for $REPO_LOCK"; return 1; }
  fi
  echo "$$" > "$REPO_LOCK/pid"
  trap release_repo_lock EXIT
}

release_repo_lock() {
  [ -n "${REPO_LOCK:-}" ] && [ "$(cat "$REPO_LOCK/pid" 2>/dev/null)" = "$$" ] && rm -rf "$REPO_LOCK"
  return 0
}

# What the poll loop does with `cc loop watch`'s status, given seconds since the dispatch.
# refused: the agent rejected the dispatch — every further poll is wasted; stop the run.
# lost:    no chat request carries the sentinel after the grace period — the dispatch never landed.
# idle:    the worker finished and the verifier is still red — end this iteration now.
# wait:    anything else, including a status this function does not know.
DISPATCH_GRACE="${DISPATCH_GRACE:-60}"
dispatch_action() {
  case "$1" in
    refused) echo refused ;;
    done) echo idle ;;
    none) if [ "$2" -ge "$DISPATCH_GRACE" ]; then echo lost; else echo wait; fi ;;
    *) echo wait ;;
  esac
}
