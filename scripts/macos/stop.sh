#!/usr/bin/env bash
set -euo pipefail

PIDS="$(lsof -ti tcp:3000 || true)"
if [ -z "$PIDS" ]; then
  echo "系统未在运行"
  exit 0
fi

kill $PIDS
echo "系统已停止"
