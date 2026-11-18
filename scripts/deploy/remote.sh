#!/usr/bin/env bash
# Runs ON the cPanel server (over SSH, from .github/workflows/deploy.yml) after the new files were
# synced into the app folder. Usage: bash remote.sh <app-dir relative to $HOME> [--seed]
#
# - Uses the app's CloudLinux Node.js virtual environment (created once in cPanel > Setup Node.js
#   App), so `node`/`npm` are the versions the app runs with.
# - Needs $APP_PATH/.env (DATABASE_URL, UPLOAD_DIR, NODE_ENV): see docs/DEPLOY.md.
# - Dependencies are installed INSIDE the virtual environment (<venv>/lib/node_modules), the way
#   CloudLinux's own "Run NPM Install" does. Never run npm in the app folder: there node_modules is
#   a symlink into the venv, and npm 7+ replaces that symlink with a real folder, which breaks the
#   CloudLinux app.
# - Restarts the app through Passenger (tmp/restart.txt).
set -euo pipefail

APP_DIR="${1:?usage: remote.sh <app-dir> [--seed]}"
SEED="${2:-}"
APP_PATH="$HOME/$APP_DIR"

cd "$APP_PATH"

# Newest Node virtual environment for this app (e.g. ~/nodevenv/ncg-app/22/bin/activate).
ACTIVATE="$(ls -d "$HOME"/nodevenv/"$APP_DIR"/*/bin/activate 2>/dev/null | sort -V | tail -n 1 || true)"
if [ -z "$ACTIVATE" ]; then
  echo "::error::No Node.js virtual environment for '$APP_DIR'. Create the app once in cPanel > Setup Node.js App."
  exit 1
fi
# shellcheck disable=SC1090
source "$ACTIVATE"
echo "[deploy] node $(node -v), npm $(npm -v), app $APP_PATH"

VENV_LIB="$(dirname "$(dirname "$ACTIVATE")")/lib"
if [ -e node_modules ] && [ ! -L node_modules ]; then
  echo "::error::$APP_PATH/node_modules is a real folder; CloudLinux expects a symlink to $VENV_LIB/node_modules. Delete it, then click Run NPM Install once in cPanel."
  exit 1
fi

# Variables set in cPanel's UI reach the running app, but NOT commands run over SSH. The app also
# reads ./.env (never synced or deleted by the deploy), so migrations find DATABASE_URL there.
if [ -z "${DATABASE_URL:-}" ] && ! grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  echo "::error::$APP_PATH/.env with DATABASE_URL is missing (see docs/DEPLOY.md, automatic deploys)."
  exit 1
fi

echo "[deploy] installing production dependencies into $VENV_LIB"
mkdir -p "$VENV_LIB"
ln -sf "$APP_PATH/package.json" "$VENV_LIB/package.json"
ln -sf "$APP_PATH/package-lock.json" "$VENV_LIB/package-lock.json"
(cd "$VENV_LIB" && npm ci --omit=dev --no-audit --no-fund)
# The app's node_modules link (normally created by cPanel) must point into the venv.
[ -L node_modules ] || ln -s "$VENV_LIB/node_modules" node_modules

echo "[deploy] applying database migrations"
npm run db:migrate

if [ "$SEED" = "--seed" ]; then
  echo "[deploy] seeding demo data (idempotent)"
  npm run db:seed
fi

echo "[deploy] restarting the app"
mkdir -p tmp
touch tmp/restart.txt
echo "[deploy] done"
