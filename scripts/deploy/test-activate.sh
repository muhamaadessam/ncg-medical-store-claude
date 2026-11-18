#!/usr/bin/env bash
# Regression test for scripts/deploy/activate.sh (runs in CI, no cPanel needed).
#
# CloudLinux's generated ~/nodevenv/<app>/<ver>/bin/activate reads variables it never sets
# (e.g. CL_VIRTUAL_ENV). activate.sh runs with `set -u`, so it must source that file with nounset
# off, then turn it back on. This builds a fake home with such an activate script and checks that
# activate.sh gets past sourcing it (it then stops at its own, expected ".env missing" check).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

APP="$TMP/ncg-app"
VENV="$TMP/nodevenv/ncg-app/24"
mkdir -p "$APP/deploy" "$VENV/bin"
cp "$ROOT/scripts/deploy/activate.sh" "$APP/deploy/activate.sh"

# Fake CloudLinux activate: reads unset variables like the real one, and puts node on PATH.
cat > "$VENV/bin/activate" <<ACTIVATE
if [ -n "\$CL_VIRTUAL_ENV" ]; then echo "unexpected"; fi
_OLD_PATH="\$PATH\$UNSET_SECOND_VARIABLE"
export PATH="$(dirname "$(command -v node)"):\$PATH"
ACTIVATE

fail() {
  echo "FAIL: $1"
  echo "--- output ---"
  echo "$output"
  exit 1
}

set +e
output="$(HOME="$TMP" bash "$APP/deploy/activate.sh" 24 2>&1)"
status=$?
set -e

echo "$output" | grep -q 'unbound variable' && fail 'activate.sh aborted while sourcing the venv (set -u)'
echo "$output" | grep -q '^\[activate\] .* with Node.js v' || fail 'activate.sh did not reach the Node.js line'
echo "$output" | grep -q '\.env with DATABASE_URL is missing' || fail 'expected the .env check to run next'
[ "$status" -ne 0 ] || fail 'expected a non-zero exit from the missing .env check'

# nounset must be back on after sourcing: an undefined variable later in the script still fails.
grep -q '^set -u$' "$ROOT/scripts/deploy/activate.sh" || fail 'activate.sh no longer restores set -u'

echo "PASS: activate.sh sources a CloudLinux-style activate script under set -u"
