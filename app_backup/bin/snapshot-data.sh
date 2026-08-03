#!/usr/bin/env bash
# bin/snapshot-data.sh — consistent point-in-time snapshot of the Nerve data
# volume (the SQLite store under $DATA_DIR). Used by the data-layer
# incident-recovery flow before any restore.
#
# Output: a directory $DB_BACKUPS_DIR/snapshot_<UTC>[_<label>] holding a
# `VACUUM INTO` copy of storage.sqlite (consistent even with WAL writers active)
# plus any sibling *.sqlite files. The snapshot id (the timestamp) is printed on
# stdout so it can be fed straight to restore-data.sh / restore-policies.sh.
set -euo pipefail
SCRIPT_NAME="snapshot-data"
source "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/_ops-common.sh"

usage() {
  cat <<'EOF'
Usage: bin/snapshot-data.sh [--label <name>] [--data-dir <path>] [-h|--help]

Creates a consistent snapshot of the Nerve SQLite data under the backups dir
and prints the snapshot id (UTC timestamp) on stdout.

Env: DATA_DIR (default ~/.nerve), DB_BACKUPS_DIR (default $DATA_DIR/db_backups).
EOF
}

LABEL=""
while [ $# -gt 0 ]; do
  case "$1" in
    --label) LABEL="${2:?--label needs a value}"; shift 2 ;;
    --data-dir) ops_set_data_dir "${2:?--data-dir needs a value}"; shift 2 ;;
    -h | --help) usage; exit 0 ;;
    *) ops_die "unknown argument: $1 (see --help)" ;;
  esac
done

[ -f "$NERVE_SQLITE" ] || ops_die "no storage.sqlite at $NERVE_SQLITE (set DATA_DIR?)"

ts="$(date -u +%Y%m%dT%H%M%SZ)"
id="${ts}${LABEL:+_$LABEL}"
dest="$NERVE_BACKUPS_DIR/snapshot_$id"
mkdir -p "$dest"

if command -v sqlite3 >/dev/null 2>&1; then
  # VACUUM INTO yields a transactionally-consistent copy under WAL.
  sqlite3 "$NERVE_SQLITE" "VACUUM INTO '$dest/storage.sqlite'"
else
  ops_log "sqlite3 not found — copying files (stop writers first for a clean copy)"
  cp -a "$NERVE_SQLITE" "$dest/storage.sqlite"
  for ext in -wal -shm; do
    [ -f "${NERVE_SQLITE}${ext}" ] && cp -a "${NERVE_SQLITE}${ext}" "$dest/" || true
  done
fi

# Capture sibling SQLite DBs (analytics, etc.) if present.
for f in "$NERVE_DATA_DIR"/*.sqlite; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = "storage.sqlite" ] && continue
  cp -a "$f" "$dest/" || true
done

printf '%s\n' "$id"
ops_log "snapshot created: $dest"
