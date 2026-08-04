#!/bin/bash
# install-nerve-server.sh — install nerve CLI server launchd agent + nerve-up/down scripts (macOS)
#
# Detects the globally-installed nerve CLI path, generates a launchd plist with
# the correct paths, copies nerve-up/nerve-down to ~/.local/bin/, and loads the
# agent (in disabled state — use nerve-up to start it on-demand).
#
# Usage:
#   scripts/ops/install-nerve-server.sh              # install
#   scripts/ops/install-nerve-server.sh --uninstall  # unload + remove
#
# Not macOS? On Linux, run the nerve CLI directly or via systemd:
#   nerve serve --no-open
# Or create a systemd user service.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_BIN="$HOME/.local/bin"
LAUNCHAGENT_DISABLED="$HOME/Library/LaunchAgents/com.vikas.nerve.plist.disabled"
LABEL="com.vikas.nerve"
NERVE_LOG_DIR="$HOME/.nerve/logs"

# --- Uninstall mode ---
if [ "${1:-}" = "--uninstall" ]; then
  echo "Unloading $LABEL..."
  launchctl bootout gui/$(id -u)/"$LABEL" 2>/dev/null || true
  rm -f "$LAUNCHAGENT_DISABLED"
  rm -f "$HOME/Library/LaunchAgents/com.vikas.nerve.plist"
  rm -f "$LOCAL_BIN/nerve-up" "$LOCAL_BIN/nerve-down"
  echo "Removed plist and scripts. Done."
  exit 0
fi

# --- Preflight checks ---
if [ "$(uname)" != "Darwin" ]; then
  echo "ERROR: This installer is for macOS (launchd)."
  echo "On Linux, run nerve directly: nerve serve --no-open"
  exit 1
fi

if [ ! -f "$SCRIPT_DIR/com.vikas.nerve.plist.template" ]; then
  echo "ERROR: plist template not found next to this installer."
  exit 1
fi

# --- Detect nerve CLI installation ---
echo "Detecting nerve CLI installation..."

# Try: globally installed via npm
NERVE_BIN=""
NERVE_DIR=""
NODE_BIN=""

# Find nerve.mjs in global node_modules
for candidate in \
  "$HOME/.local/lib/node_modules/nerve/bin/nerve.mjs" \
  "$(npm root -g 2>/dev/null)/nerve/bin/nerve.mjs" \
  "$(npm root -g 2>/dev/null)/@nerve/nerve/bin/nerve.mjs"; do
  if [ -f "$candidate" ]; then
    NERVE_BIN="$candidate"
    NERVE_DIR="$(dirname "$(dirname "$candidate")")"
    break
  fi
done

if [ -z "$NERVE_BIN" ]; then
  echo "ERROR: Could not find nerve CLI in global node_modules."
  echo "Install it first: npm install -g nerve"
  exit 1
fi

# Find node binary
NODE_BIN=$(which node 2>/dev/null || true)
if [ -z "$NODE_BIN" ]; then
  for candidate in "$HOME/.local/bin/node" "/opt/homebrew/bin/node" "/usr/local/bin/node"; do
    if [ -x "$candidate" ]; then
      NODE_BIN="$candidate"
      break
    fi
  done
fi

if [ -z "$NODE_BIN" ]; then
  echo "ERROR: Could not find node binary."
  exit 1
fi

echo "  Node:   $NODE_BIN"
echo "  Nerve:  $NERVE_BIN"
echo "  Dir:    $NERVE_DIR"

# --- Install nerve-up / nerve-down to ~/.local/bin/ ---
mkdir -p "$LOCAL_BIN"
cp "$SCRIPT_DIR/nerve-up.sh" "$LOCAL_BIN/nerve-up"
cp "$SCRIPT_DIR/nerve-down.sh" "$LOCAL_BIN/nerve-down"
chmod +x "$LOCAL_BIN/nerve-up" "$LOCAL_BIN/nerve-down"
echo "Installed scripts → $LOCAL_BIN/nerve-up, $LOCAL_BIN/nerve-down"

# --- Generate plist from template ---
mkdir -p "$(dirname "$LAUNCHAGENT_DISABLED")"
mkdir -p "$NERVE_LOG_DIR"
sed \
  -e "s|__HOME__|$HOME|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__NERVE_BIN__|$NERVE_BIN|g" \
  -e "s|__NERVE_DIR__|$NERVE_DIR|g" \
  "$SCRIPT_DIR/com.vikas.nerve.plist.template" > "$LAUNCHAGENT_DISABLED"
echo "Generated plist → $LAUNCHAGENT_DISABLED"

# --- Unload any existing instance ---
launchctl bootout gui/$(id -u)/"$LABEL" 2>/dev/null || true

echo ""
echo "✓ Nerve CLI server agent installed (disabled state — won't auto-start at login)"
echo ""
echo "  Start:  nerve-up    (starts nerve on port 20128)"
echo "  Stop:   nerve-down  (stops nerve)"
echo ""
echo "  The plist is at: $LAUNCHAGENT_DISABLED"
echo "  Logs:            $NERVE_LOG_DIR/"
echo ""
echo "  Pair with nerve-dev-restart for periodic restarts:"
echo "    scripts/ops/install-dev-restart.sh"
echo ""
echo "Uninstall:"
echo "  $SCRIPT_DIR/install-nerve-server.sh --uninstall"
