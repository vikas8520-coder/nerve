#!/bin/bash
# install-dev-restart.sh — install the nerve dev server auto-restart timer (macOS)
#
# Copies nerve-dev-restart.sh to ~/.local/bin/, generates a launchd plist with the
# correct $HOME path, and loads it via launchctl. Runs every 6 hours.
#
# The script is a safe no-op when the dev server isn't running, so this timer is
# harmless even if you only use Docker prod.
#
# Usage:
#   scripts/ops/install-dev-restart.sh           # install + load
#   scripts/ops/install-dev-restart.sh --uninstall  # unload + remove
#
# Not macOS? The same nerve-dev-restart.sh works with cron on Linux:
#   0 */6 * * * "$HOME/Projects/nerve/scripts/ops/nerve-dev-restart.sh"

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOCAL_BIN="$HOME/.local/bin"
LAUNCHAGENT="$HOME/Library/LaunchAgents/com.vikas.nerve-dev-restart.plist"
LABEL="com.vikas.nerve-dev-restart"
NERVE_LOG_DIR="$HOME/.nerve/logs"

# --- Uninstall mode ---
if [ "${1:-}" = "--uninstall" ]; then
  echo "Unloading $LABEL..."
  launchctl bootout gui/$(id -u)/"$LABEL" 2>/dev/null || true
  rm -f "$LAUNCHAGENT"
  rm -f "$LOCAL_BIN/nerve-dev-restart"
  echo "Removed plist and script. Done."
  exit 0
fi

# --- Preflight checks ---
if [ "$(uname)" != "Darwin" ]; then
  echo "ERROR: This installer is for macOS (launchd)."
  echo "On Linux, use cron instead:"
  echo "  crontab -e"
  echo "  0 */6 * * * \"$REPO_DIR/scripts/ops/nerve-dev-restart.sh\""
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/nerve-dev-restart.sh" ]; then
  echo "ERROR: nerve-dev-restart.sh not found next to this installer."
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/com.vikas.nerve-dev-restart.plist.template" ]; then
  echo "ERROR: plist template not found next to this installer."
  exit 1
fi

# --- Install script to ~/.local/bin/ ---
mkdir -p "$LOCAL_BIN"
cp "$SCRIPT_DIR/nerve-dev-restart.sh" "$LOCAL_BIN/nerve-dev-restart"
chmod +x "$LOCAL_BIN/nerve-dev-restart"
echo "Installed script → $LOCAL_BIN/nerve-dev-restart"

# --- Generate plist from template ---
mkdir -p "$(dirname "$LAUNCHAGENT")"
mkdir -p "$NERVE_LOG_DIR"
sed "s|__HOME__|$HOME|g" "$SCRIPT_DIR/com.vikas.nerve-dev-restart.plist.template" > "$LAUNCHAGENT"
echo "Generated plist → $LAUNCHAGENT"

# --- Unload any existing instance, then load ---
launchctl bootout gui/$(id -u)/"$LABEL" 2>/dev/null || true
launchctl bootstrap gui/$(id -u) "$LAUNCHAGENT" 2>&1

# --- Verify ---
if launchctl print gui/$(id -u)/"$LABEL" >/dev/null 2>&1; then
  INTERVAL=$(launchctl print gui/$(id -u)/"$LABEL" 2>/dev/null | grep "interval" | head -1 || echo "?")
  echo "✓ Timer loaded: $LABEL (runs every 6 hours)"
  echo "  Script:  $LOCAL_BIN/nerve-dev-restart"
  echo "  Plist:   $LAUNCHAGENT"
  echo "  Logs:    $NERVE_LOG_DIR/dev-restart-launchd.log"
  echo ""
  echo "Manual commands:"
  echo "  nerve-dev-restart --status   # check dev server state"
  echo "  nerve-dev-restart --force    # force restart now"
  echo ""
  echo "Uninstall:"
  echo "  $SCRIPT_DIR/install-dev-restart.sh --uninstall"
else
  echo "ERROR: Failed to load launchd timer. Check $LAUNCHAGENT is valid."
  exit 1
fi
