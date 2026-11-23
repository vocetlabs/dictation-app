#!/usr/bin/env bash
# Checks the on-device cleanup helper in a built Vocet.app (REL2): the
# `llama-server` Tauri bundles next to the app's executable
# (`bundle.externalBin`) is a second executable, signed before the app is
# sealed, so it gets its own checks:
#
#   scripts/check-helper.sh path/to/Vocet.app
#
# It must be there and executable; its signature must verify; it must carry
# the app's identity and the hardened runtime, a secure timestamp when the app
# has one, and exactly the entitlements (names and values) in
# src-tauri/Entitlements.plist. An entitlements read that fails or comes back
# empty is a failure, not a pass. Used by scripts/check-dmg.sh and tested
# without stubbing it by scripts/test-release.sh.
set -euo pipefail

app=${1:?usage: check-helper.sh path/to/Vocet.app}
root=$(cd "$(dirname "$0")/.." && pwd)
expected=${ENTITLEMENTS:-$root/src-tauri/Entitlements.plist}
helper=$app/Contents/MacOS/llama-server

fail() {
  echo "check-helper: $*" >&2
  exit 1
}

# entitlements_json <code>: the signed entitlements as sorted compact JSON,
# so that names and values are compared. Fails on a read error or no result.
entitlements_json() {
  local xml json
  xml=$(codesign -d --entitlements :- "$1" 2>/dev/null) || return 1
  [ -n "$xml" ] || return 1
  json=$(plutil -convert json -o - - <<<"$xml" 2>/dev/null) || return 1
  jq -cS . <<<"$json"
}

[ -f "$helper" ] || fail "no on-device cleanup helper at Contents/MacOS/llama-server"
[ -x "$helper" ] || fail "the helper is not executable"
codesign --verify --strict "$helper" || fail "the helper's signature does not verify"
app_details=$(codesign -dvvv "$app" 2>&1 || true)
helper_details=$(codesign -dvvv "$helper" 2>&1 || true)
app_authority=$(sed -n 's/^Authority=//p' <<<"$app_details" | head -1)
helper_authority=$(sed -n 's/^Authority=//p' <<<"$helper_details" | head -1)
[ "$app_authority" = "$helper_authority" ] ||
  fail "the helper is signed by '${helper_authority:-nobody}', the app by '${app_authority:-nobody}'"
grep -q '^CodeDirectory .*flags=[^ ]*runtime' <<<"$helper_details" ||
  fail "the helper is not signed with the hardened runtime"
want=$(plutil -convert json -o - "$expected" | jq -cS .) || fail "could not read $expected"
[ -n "$want" ] && [ "$want" != "{}" ] || fail "$expected has no entitlements"
have=$(entitlements_json "$helper") || fail "could not read the helper's entitlements"
[ -n "$have" ] || fail "the helper has no entitlements"
[ "$have" = "$want" ] || fail "the helper's entitlements are $have, not the ones in $expected: $want"
if grep -q '^Timestamp=' <<<"$app_details"; then
  grep -q '^Timestamp=' <<<"$helper_details" || fail "the helper's signature has no secure timestamp"
fi
echo "check-helper: ok: llama-server in $(basename "$app")"
