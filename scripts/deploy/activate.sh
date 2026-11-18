#!/usr/bin/env bash
# Runs ON the cPanel server, from inside the uploaded release:
#   ssh user@host 'bash ncg-app/deploy/activate.sh'        (Node major defaults to 24)
#
# Installs production dependencies, applies migrations and restarts the app.
# - Uses the app's CloudLinux Node.js virtual environment (~/nodevenv/<app>/<major>), created once
#   in cPanel > Setup Node.js App.
# - Installs INSIDE the virtual environment (<venv>/lib/node_modules), like cPanel's
#   "Run NPM Install". Never run npm in the app folder: there node_modules is a symlink into the
#   venv, and npm 7+ replaces that symlink with a real folder, which breaks the CloudLinux app.
# - Needs <app>/.env (DATABASE_URL, UPLOAD_DIR, NODE_ENV): variables set in cPanel's UI reach the
#   running app but not commands run over SSH. The deploy never uploads or deletes .env.
set -euo pipefail

NODE_MAJOR="${1:-24}"
APP_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="$(basename "$APP_PATH")"
VENV="$HOME/nodevenv/$APP_NAME/$NODE_MAJOR"

if [ ! -f "$VENV/bin/activate" ]; then
  echo "::error::No Node.js $NODE_MAJOR virtual environment at $VENV. Create the app in cPanel > Setup Node.js App (Node.js $NODE_MAJOR, root $APP_NAME)."
  exit 1
fi
# CloudLinux's generated activate script reads variables it never sets (e.g. CL_VIRTUAL_ENV), so
# it must be sourced without `set -u`.
set +u
# shellcheck disable=SC1091
source "$VENV/bin/activate"
set -u
cd "$APP_PATH"
echo "[activate] $APP_PATH with Node.js $(node -v), npm $(npm -v)"

if [ -z "${DATABASE_URL:-}" ] && ! grep -q '^DATABASE_URL=' .env 2>/dev/null; then
  echo "::error::$APP_PATH/.env with DATABASE_URL is missing (see docs/DEPLOY.md)."
  exit 1
fi
if [ -e node_modules ] && [ ! -L node_modules ]; then
  echo "::error::$APP_PATH/node_modules is a real folder; CloudLinux expects a symlink into $VENV/lib/node_modules. Delete it, then click Run NPM Install once in cPanel."
  exit 1
fi

echo "[activate] installing production dependencies into $VENV/lib"
mkdir -p "$VENV/lib"
ln -sf "$APP_PATH/package.json" "$VENV/lib/package.json"
ln -sf "$APP_PATH/package-lock.json" "$VENV/lib/package-lock.json"
(cd "$VENV/lib" && npm ci --omit=dev --no-audit --no-fund)
[ -L node_modules ] || ln -s "$VENV/lib/node_modules" node_modules

echo "[activate] applying database migrations"
npm run db:migrate

echo "[activate] restarting the app"
mkdir -p tmp
touch tmp/restart.txt
echo "[activate] done"
