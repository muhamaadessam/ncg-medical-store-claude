#!/usr/bin/env bash
# Sync package-deploy/ to the cPanel app folder and run remote.sh there.
# Used by .github/workflows/deploy.yml (Linux runner). Requires an SSH key and known_hosts already
# set up for the target. Env:
#   SSH_HOST, SSH_PORT (Namecheap: 21098), SSH_USER, APP_DIR (relative to $HOME, e.g. ncg-app)
#   SEED=true to also run the (idempotent) seed
set -euo pipefail

: "${SSH_HOST:?}" "${SSH_PORT:?}" "${SSH_USER:?}" "${APP_DIR:?}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/package-deploy/"
SSH="ssh -p $SSH_PORT -o BatchMode=yes -o ConnectTimeout=20"
TARGET="$SSH_USER@$SSH_HOST"

[ -f "$SRC/package.json" ] || { echo "::error::package-deploy/ missing: run npm run package"; exit 1; }

echo "[push] syncing to $TARGET:~/$APP_DIR"
# --delete removes files from older releases, except what lives only on the server:
# the node_modules symlink (CloudLinux venv), .env (secrets), Passenger's tmp/ and logs.
rsync -az --delete --stats \
  --exclude '/node_modules' \
  --exclude '/.env' \
  --exclude '/tmp/' \
  --exclude '/stderr.log' \
  --exclude '/*.log' \
  -e "$SSH" "$SRC" "$TARGET:$APP_DIR/" | grep -E 'Number of (regular )?files transferred|Total transferred file size' || true

echo "[push] running remote steps"
SEED_ARG=""
[ "${SEED:-false}" = "true" ] && SEED_ARG="--seed"
$SSH "$TARGET" "bash -s -- '$APP_DIR' $SEED_ARG" < "$ROOT/scripts/deploy/remote.sh"
