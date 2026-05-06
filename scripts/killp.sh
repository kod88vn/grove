#!/usr/bin/env bash

set -euo pipefail

usage() {
  echo "Usage: $(basename "$0") <port> [port ...]"
}

if [[ $# -eq 0 ]]; then
  usage
  exit 1
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "Error: lsof is required but not installed." >&2
  exit 1
fi

overall_status=0

for port in "$@"; do
  if [[ ! "$port" =~ ^[0-9]+$ ]]; then
    echo "Skipping invalid port: $port" >&2
    overall_status=1
    continue
  fi

  pids=$(lsof -ti "tcp:$port" || true)

  if [[ -z "$pids" ]]; then
    echo "Port $port is clear"
    continue
  fi

  echo "Stopping processes on port $port: $pids"
  kill $pids 2>/dev/null || true

  for _ in 1 2 3 4 5; do
    remaining=$(lsof -ti "tcp:$port" || true)
    if [[ -z "$remaining" ]]; then
      break
    fi
    sleep 0.2
  done

  remaining=$(lsof -ti "tcp:$port" || true)
  if [[ -n "$remaining" ]]; then
    echo "Force killing remaining processes on port $port: $remaining"
    kill -9 $remaining 2>/dev/null || true
  fi

  final=$(lsof -ti "tcp:$port" || true)
  if [[ -n "$final" ]]; then
    echo "Failed to clear port $port" >&2
    overall_status=1
  else
    echo "Port $port cleared"
  fi
done

exit $overall_status