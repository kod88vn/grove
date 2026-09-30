#!/usr/bin/env bash
# Install a loop worker agent into the target repo, where `code chat -m` looks for it.
# Usage: install-worker-agent.sh <cc-root> <target-repo> <agent-name>
#
# `code chat -m <agent>` resolves the agent in the target repo's window. If the file is only in
# central-command, VS Code silently runs plain agent mode on the window's model instead.
# The copy is listed in the target's git exclude file, so it never shows up in its status.
set -euo pipefail

CC_ROOT="$1"
REPO="$2"
AGENT="$3"

SRC="$CC_ROOT/.github/agents/$AGENT.agent.md"
DEST_DIR="$REPO/.github/agents"
DEST="$DEST_DIR/$AGENT.agent.md"

[ -f "$SRC" ] || { echo "ABORT — central-command has no agent $AGENT ($SRC)" >&2; exit 1; }

mkdir -p "$DEST_DIR"
[ "$(cd "$(dirname "$SRC")" && pwd -P)" = "$(cd "$DEST_DIR" && pwd -P)" ] || cp "$SRC" "$DEST"

EXCLUDE="$(cd "$REPO" && git rev-parse --path-format=absolute --git-path info/exclude)"
ENTRY="/.github/agents/$AGENT.agent.md"
mkdir -p "$(dirname "$EXCLUDE")"
grep -qxF "$ENTRY" "$EXCLUDE" 2>/dev/null || echo "$ENTRY" >> "$EXCLUDE"

echo "installed $AGENT -> $DEST"
