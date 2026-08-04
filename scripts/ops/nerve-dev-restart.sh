#!/bin/bash
# nerve-dev-restart — proactively restart the nerve dev server (npm run dev on :20128)
# before its RSS balloons and causes swap thrashing + thermal heat.
#
# Designed to be called by launchd (com.vikas.nerve-dev-restart) every 6 hours.
# Safe to run manually too. Only restarts if the dev server is actually running
# AND either: (a) uptime > 6h, or (b) RSS > 3GB. Otherwise leaves it alone.
#
# The Docker prod deployment (ports 20130/20131/20132) is the always-on primary.
# This script only manages the dev server (port 20128) for active development.
#
# Usage:
#   nerve-dev-restart          # check + restart if needed
#   nerve-dev-restart --force  # restart regardless of uptime/RSS
#   nerve-dev-restart --status # just report, don't restart

set -euo pipefail

PORT=20128
MAX_RSS_KB=3145728  # 3GB in KB
MAX_UPTIME_SEC=21600  # 6 hours in seconds
LOG="$HOME/.nerve/logs/dev-restart.log"
NERVE_DIR="$HOME/Projects/nerve"

mkdir -p "$(dirname "$LOG")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# --- Find the dev server process (next-server or run-next on :20128, NOT Docker) ---
# lsof gives us the PID listening on :20128
PID=$(lsof -ti :${PORT} 2>/dev/null || true)

if [ -z "$PID" ]; then
  log "No process listening on :${PORT} — dev server is not running. Nothing to do."
  exit 0
fi

# Verify it's not the Docker container (Docker maps :20130→:20128 inside the container,
# but the host-side :20128 should only be the dev server)
COMMAND=$(ps -p "$PID" -o command= 2>/dev/null || true)
if echo "$COMMAND" | grep -q "docker\|containerd"; then
  log "PID $PID on :${PORT} is a Docker container — not the dev server. Skipping."
  exit 0
fi

# --- Gather stats ---
RSS_KB=$(ps -p "$PID" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
ELAPSED_SEC=$(ps -p "$PID" -o etime= 2>/dev/null | awk -F: '
  /-/ { split($1, a, "-"); print a[1]*86400 + a[2]*3600 + $2*60 + $3; next }
  NF==3 { print $1*3600 + $2*60 + $3; next }
  NF==2 { print $1*60 + $2; next }
  { print $1; next }
' 2>/dev/null || echo "0")

RSS_GB=$(echo "scale=2; $RSS_KB / 1048576" | bc 2>/dev/null || echo "?")
UPTIME_HR=$(echo "scale=1; $ELAPSED_SEC / 3600" | bc 2>/dev/null || echo "?")

# --- Status-only mode ---
if [ "${1:-}" = "--status" ]; then
  log "STATUS: PID=$PID RSS=${RSS_GB}GB uptime=${UPTIME_HR}h"
  exit 0
fi

# --- Decide whether to restart ---
SHOULD_RESTART=false
REASON=""

if [ "${1:-}" = "--force" ]; then
  SHOULD_RESTART=true
  REASON="forced (--force)"
elif [ "$RSS_KB" -gt "$MAX_RSS_KB" ] 2>/dev/null; then
  SHOULD_RESTART=true
  REASON="RSS ${RSS_GB}GB exceeds ${MAX_RSS_KB}KB threshold"
elif [ "$ELAPSED_SEC" -gt "$MAX_UPTIME_SEC" ] 2>/dev/null; then
  SHOULD_RESTART=true
  REASON="uptime ${UPTIME_HR}h exceeds ${MAX_UPTIME_SEC}s threshold"
fi

if [ "$SHOULD_RESTART" = "false" ]; then
  log "OK: PID=$PID RSS=${RSS_GB}GB uptime=${UPTIME_HR}h — within thresholds, no restart needed."
  exit 0
fi

log "RESTARTING: PID=$PID reason=$REASON"

# --- Kill the dev server process tree ---
kill "$PID" 2>/dev/null || true
sleep 3

# Verify it's dead
if lsof -ti :${PORT} >/dev/null 2>&1; then
  log "WARNING: PID $PID didn't die, sending SIGKILL"
  kill -9 "$PID" 2>/dev/null || true
  sleep 2
fi

# Also clean up any orphaned next-server / run-next children
pkill -f "run-next.mjs dev" 2>/dev/null || true
sleep 1

if lsof -ti :${PORT} >/dev/null 2>&1; then
  log "ERROR: :${PORT} still in use after kill — aborting restart"
  exit 1
fi

log "Dev server stopped. Starting fresh..."

# --- Start fresh dev server ---
cd "$NERVE_DIR"
nohup npm run dev > "$HOME/.nerve/logs/dev-server.log" 2>&1 &
NEW_PID=$!
log "Started new dev server (npm PID=$NEW_PID). Waiting for readiness..."

# Wait for it to come up (max 60s)
for i in $(seq 1 60); do
  if curl -s --max-time 2 "http://localhost:${PORT}/api/health" >/dev/null 2>&1; then
    NEW_RSS=$(ps -p "$NEW_PID" -o rss= 2>/dev/null | tr -d ' ' || echo "0")
    log "Dev server is ready (took ${i}s). New PID=$NEW_PID RSS=${NEW_RSS}KB"
    exit 0
  fi
  sleep 1
done

log "WARNING: Dev server didn't respond to health check in 60s — check $HOME/.nerve/logs/dev-server.log"
exit 1
