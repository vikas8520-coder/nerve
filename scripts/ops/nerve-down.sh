#!/bin/bash
# nerve-down.sh — stop the nerve CLI server on-demand
#
# Unloads the launchd agent and removes the active plist symlink.
# The .disabled plist is preserved so nerve-up can start it again.
#
# Usage: nerve-down

set -euo pipefail

ACTIVE="$HOME/Library/LaunchAgents/com.vikas.nerve.plist"

launchctl bootout gui/$(id -u)/com.vikas.nerve 2>/dev/null || true
rm -f "$ACTIVE"
echo "nerve stopped"
