#!/bin/bash
# ============================================================================
# scripts/loop-reap.sh <folder> [<archive-dir>]
#
# Closes the VS Code window(s) the loop driver opened on <folder> and deletes
# their workspaceStorage (chat sessions included). If <archive-dir> is given,
# each matching storage dir's chatSessions/ is copied to
# <archive-dir>/sessions/<hash>/ before the storage dir is removed, so the
# referee can still read the transcript after the window is gone.
#
# Refuses anything whose absolute path has no `/tmp/` segment — this script
# reaps loop.sh's own scratch worktrees, never a real work window.
#
# Idempotent: nothing to close/remove -> exit 0, one line each for what (if
# anything) was found.
# ============================================================================
set -u

CODE="/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code"
STORAGE_ROOT="$HOME/Library/Application Support/Code/User/workspaceStorage"

FOLDER="${1:-}"
ARCHIVE_DIR="${2:-}"

if [ -z "$FOLDER" ]; then
  echo "usage: loop-reap.sh <folder> [<archive-dir>]"
  exit 2
fi

case "$FOLDER" in
  /*) ;;
  *)
    echo "REFUSED — folder must be an absolute path: $FOLDER"
    exit 2
    ;;
esac

# Normalize: no trailing slash, so string comparisons against --status titles
# and workspace.json's file:// URI are exact.
FOLDER="${FOLDER%/}"

case "$FOLDER" in
  */tmp/*) ;;
  *)
    echo "REFUSED — $FOLDER has no /tmp/ segment; loop-reap only closes scratch loop windows."
    exit 2
    ;;
esac

BASE="$(basename "$FOLDER")"
echo "loop-reap: folder=$FOLDER base=($BASE) archive=${ARCHIVE_DIR:-<none>}"

# --------------------------------------------------------------- windows
# `code --status` prints one line per window like:
#   0   225179981369      5698  window [57] (grove-f5)
#   0   225179981369      5698  window [58] (file.ts — grove-f5)
# plus a tree-section line "|  Window (grove-f5)" that must be ignored.
# Field 3 is the renderer PID. The folder part of the title is whatever
# follows the last " — " (em dash) inside the parens, or the whole
# parenthesised text if there is no dash.
find_matching_pids() {
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
    if [ "$folder_part" = "$BASE" ]; then
      pid="$(printf '%s\n' "$line" | awk '{print $3}')"
      case "$pid" in
        ''|*[!0-9]*) continue ;;
      esac
      echo "$pid"
    fi
  done
}

WINDOW_GONE=1
pids="$(find_matching_pids)"
if [ -z "$pids" ]; then
  echo "window: none open on ($BASE)"
else
  for pid in $pids; do
    echo "window: closing pid=$pid ($BASE)"
    kill -TERM "$pid" 2>/dev/null
  done
  waited=0
  remaining="$pids"
  while [ "$waited" -lt 15 ]; do
    sleep 1
    waited=$((waited + 1))
    remaining="$(find_matching_pids)"
    [ -z "$remaining" ] && break
  done
  if [ -n "$remaining" ]; then
    echo "window: WARNING still open after ${waited}s: $remaining"
    WINDOW_GONE=0
  else
    echo "window: closed after ${waited}s"
  fi
fi

# --------------------------------------------------------- workspaceStorage
FOLDER_URI="file://$FOLDER"
reaped_any=0

if [ "$WINDOW_GONE" -eq 1 ]; then
  for ws in "$STORAGE_ROOT"/*/workspace.json; do
    [ -f "$ws" ] || continue
    dir="$(dirname "$ws")"
    hash="$(basename "$dir")"
    folder_val="$(sed -nE 's/.*"folder"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' "$ws" | head -1)"
    folder_val="${folder_val%/}"
    if [ "$folder_val" = "$FOLDER_URI" ]; then
      reaped_any=1
      if [ -n "$ARCHIVE_DIR" ] && [ -d "$dir/chatSessions" ]; then
        mkdir -p "$ARCHIVE_DIR/sessions/$hash"
        cp -R "$dir/chatSessions/." "$ARCHIVE_DIR/sessions/$hash/"
        echo "storage: archived chatSessions $hash -> $ARCHIVE_DIR/sessions/$hash"
      fi
      rm -rf "$dir"
      echo "storage: removed $hash ($FOLDER_URI)"
    fi
  done
  [ "$reaped_any" -eq 1 ] || echo "storage: none found for $FOLDER_URI"
else
  echo "storage: skipped — window did not confirm closed"
fi

exit 0
