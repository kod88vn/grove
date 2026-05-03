#!/usr/bin/env sh
# Link ai-skill-library/skills into this project's .github/skills for Copilot
set -e

# Script is expected at apps/<consumer>/link-skills.sh
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# source (library) is at ../ai-skill-library/skills
SKILLS_SRC="$ROOT_DIR/../ai-skill-library/skills"
# destination must be at monorepo root .github/skills so Copilot sees it
MONOREPO_ROOT="$(cd "$ROOT_DIR/../.." && pwd)"
SKILLS_DEST="$MONOREPO_ROOT/.github/skills"

echo "Linking $SKILLS_SRC -> $SKILLS_DEST"
mkdir -p "$(dirname "$SKILLS_DEST")"
if [ -L "$SKILLS_DEST" ] || [ -e "$SKILLS_DEST" ]; then
  echo "Removing existing $SKILLS_DEST"
  rm -rf "$SKILLS_DEST"
fi
ln -s "$SKILLS_SRC" "$SKILLS_DEST"
echo "Linked. Reload VS Code (Developer: Reload Window) if open."
