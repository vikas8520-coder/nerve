#!/usr/bin/env bash
#
# nerve-orbstack-autopause.sh
# ---------------------------------------------------------------------------
# Auto-pause OrbStack (and the Nerve production containers) when the Mac is
# running on battery, and resume it when the Mac is on AC power.
#
# Run as a launchd agent (see com.nerve.orbstack-autopause.plist). It polls the
# power source every 60s and only acts on a *transition*, so it is cheap and
# never flaps.
#
# WHY: OrbStack's built-in `power.pause_in_sleep` only pauses the VM when the
# Mac *sleeps*. On battery while awake the VM keeps running and burns CPU
# (we measured a 26%-CPU OrbStack VM as the single biggest live battery
# consumer on this machine). This addresses the unplugged-drain case, which is
# exactly what `power.pause_in_sleep` does NOT cover.
#
# SAFE:
#   - No-op on first run if already in the target power state.
#   - Skips entirely if `orbctl` is missing or OrbStack is not installed.
#   - Honors a disable flag: touch ~/.nerve-autopause-disabled to turn off.
#   - Debounced with a state file; only acts on power-source transitions.
#
# MODES:
#   Default: `orbctl stop` / `orbctl start` (pauses the whole OrbStack VM).
#   Container-only: set PAUSE_CONTAINERS_ONLY=1 (in the plist or env) to just
#   stop/start the nerve-prod + nerve-redis-prod containers instead, leaving
#   the OrbStack VM up for any other workloads.
#
set -euo pipefail

ORBCTL="$(command -v orbctl || true)"
DOCKER="$(command -v docker || true)"
STATE_FILE="${HOME}/.cache/nerve-orbstack-autopause.state"
DISABLE_FILE="${HOME}/.nerve-autopause-disabled"
PAUSE_CONTAINERS_ONLY="${PAUSE_CONTAINERS_ONLY:-0}"

NERVE_CONTAINERS=(nerve-prod nerve-redis-prod)

mkdir -p "$(dirname "$STATE_FILE")"

log() { echo "[nerve-orbstack-autopause $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

on_battery() {
  # pmset -g ps prints "Now drawing from 'Battery Power'" or "'AC Power'".
  if [[ "$(pmset -g ps 2>/dev/null)" == *"AC Power"* ]]; then
    return 1
  fi
  return 0
}

# --- guards -----------------------------------------------------------------
if [[ -f "$DISABLE_FILE" ]]; then
  log "disabled via $DISABLE_FILE; exiting"
  exit 0
fi

if [[ -z "$ORBCTL" ]]; then
  log "orbctl not found; exiting"
  exit 0
fi

if ! orbctl status >/dev/null 2>&1; then
  # Still record state so we don't flap on the next AC transition.
  if on_battery; then echo "battery" > "$STATE_FILE"; else echo "ac" > "$STATE_FILE"; fi
  log "OrbStack not running; recorded state, exiting"
  exit 0
fi

prev="$(cat "$STATE_FILE" 2>/dev/null || echo unknown)"

# First run (no state yet) = no-op. We only act on a *transition* so install/
# load never surprises the user by pausing/resuming on the very first tick.
if [[ "$prev" == "unknown" ]]; then
  if on_battery; then echo "battery" > "$STATE_FILE"; else echo "ac" > "$STATE_FILE"; fi
  log "first run; recorded state '$(cat "$STATE_FILE")', no action"
  exit 0
fi

# --- act on transition ------------------------------------------------------
if on_battery; then
  if [[ "$prev" == "battery" ]]; then
    log "already on battery; no action"
    exit 0
  fi
  log "battery detected -> pausing OrbStack"
  if [[ "$PAUSE_CONTAINERS_ONLY" == "1" && -n "$DOCKER" ]]; then
    for c in "${NERVE_CONTAINERS[@]}"; do
      "$DOCKER" stop "$c" >/dev/null 2>&1 || true
    done
  else
    orbctl stop >/dev/null 2>&1 || true
  fi
  echo "battery" > "$STATE_FILE"
else
  if [[ "$prev" == "ac" ]]; then
    log "already on AC; no action"
    exit 0
  fi
  log "AC detected -> resuming OrbStack"
  if [[ "$PAUSE_CONTAINERS_ONLY" == "1" && -n "$DOCKER" ]]; then
    for c in "${NERVE_CONTAINERS[@]}"; do
      "$DOCKER" start "$c" >/dev/null 2>&1 || true
    done
  else
    orbctl start >/dev/null 2>&1 || true
  fi
  # Containers with `restart: unless-stopped` (nerve-prod, nerve-redis-prod)
  # come back automatically once the VM is up; the loop above is a belt-and-
  # braces nudge for container-only mode.
  echo "ac" > "$STATE_FILE"
fi
