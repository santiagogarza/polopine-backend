#!/usr/bin/env bash
set -euo pipefail

INPUT=$(cat)

# Extract command from hook JSON (supports jq-free parsing)
COMMAND=$(printf '%s' "$INPUT" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)

if printf '%s' "$COMMAND" | grep -qE 'rm[[:space:]]+-rf|git[[:space:]]+push[[:space:]]+.*--force-with-lease|git[[:space:]]+push[[:space:]]+.*--force|git[[:space:]]+reset[[:space:]]+--hard'; then
  printf '%s\n' '{"permission":"deny","user_message":"Blocked by policy: destructive command","agent_message":"This command is blocked by repo policy. Use a safer alternative."}'
  exit 0
fi

printf '%s\n' '{"permission":"allow"}'
