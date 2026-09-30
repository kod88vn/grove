#!/usr/bin/env bash
# Run a loop driver so it outlives whatever launched it, and re-attach to it later.
#
#   bash scripts/loop-detach.sh tmp/<KEY>-loop.sh
#
# A chat turn owns the terminal it runs commands in. When the turn ends, the terminal's process
# group dies, and a driver started with `bash`, `&` or `nohup` dies with it (it did, at 09:58:07
# on 2026-09-30). This starts the driver in its own session instead, records its pid, streams its
# log while it runs, and exits with the driver's exit code. Called again while that driver is
# alive, it attaches to it rather than starting a second copy — which is how a resumed architect
# picks the work back up.
#
# State lives next to the driver: <driver>.pid, <driver>.log, <driver>.exit.
set -u

DRIVER="${1:?usage: loop-detach.sh <path to tmp/<KEY>-loop.sh>}"
[ -f "$DRIVER" ] || { echo "ABORT — no driver at $DRIVER"; exit 1; }
DRIVER="$(cd "$(dirname "$DRIVER")" && pwd)/$(basename "$DRIVER")"
BASE="${DRIVER%.sh}"
PIDFILE="$BASE.pid" LOG="$BASE.log" EXITFILE="$BASE.exit"
POLL="${LOOP_DETACH_POLL:-5}"

alive() {
  local pid
  pid="$(cat "$PIDFILE" 2>/dev/null)"
  [ -n "$pid" ] && ps -ww -o command= -p "$pid" 2>/dev/null | grep -qF "$DRIVER" && return 0
  # The pid file is only a hint. If it was lost, a driver may still be running, and starting a
  # second copy truncates the first one's log and exit file (run 147, 2026-09-30).
  # `ps`, not `pgrep`: pgrep cannot list processes inside the VS Code terminal sandbox.
  pid="$(ps ax -ww -o pid=,command= | awk -v want="bash $DRIVER" '{ p = $1; sub(/^ *[0-9]+ /, ""); if ($0 == want) { print p; exit } }')"
  [ -n "$pid" ] || return 1
  echo "$pid" > "$PIDFILE"
}

if alive; then
  echo "attached to running driver pid $(cat "$PIDFILE") — $DRIVER"
else
  rm -f "$EXITFILE"
  : > "$LOG"
  # setsid: a new session and process group, so killing the launcher's group cannot reach it.
  nohup perl -MPOSIX -e 'POSIX::setsid(); exec @ARGV' \
    bash -c 'bash "$1"; echo $? > "$2"' _ "$DRIVER" "$EXITFILE" \
    < /dev/null >> "$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  # Right after the fork, the first alive() check has been seen to miss the child (one bash -x
  # trace, 2026-09-30). A miss there removes the pid file and says "re-run", and a re-run starts
  # a second driver on the same repo. Wait until the wrapper is visible before polling.
  for _ in $(seq 1 50); do
    ps -ww -o command= -p "$!" 2>/dev/null | grep -qF "$DRIVER" && break
    kill -0 "$!" 2>/dev/null || break
    sleep 0.1
  done
  echo "started driver pid $! detached — log $LOG"
fi

SHOWN=0
show_new() {
  local size
  size=$(wc -c < "$LOG" 2>/dev/null | tr -d ' ')
  [ "${size:-0}" -gt "$SHOWN" ] && tail -c +"$((SHOWN + 1))" "$LOG" | head -c "$((size - SHOWN))"
  SHOWN=${size:-0}
}

while alive; do
  show_new
  sleep "$POLL"
done
rm -f "$PIDFILE"
# When attached via the driver's own pid, its wrapper writes the exit file a moment later.
for _ in 1 2 3 4 5 6 7 8 9 10; do [ -f "$EXITFILE" ] && break; sleep 0.2; done
show_new

if [ -f "$EXITFILE" ]; then
  RC=$(cat "$EXITFILE")
  echo "driver finished, exit $RC"
  exit "$RC"
fi
echo "driver ended without an exit code — it was killed; re-run to start a new run"
exit 1
