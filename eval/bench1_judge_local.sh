#!/usr/bin/env bash
# REL2, internal: the bench's judge metrics (ZER, AMEND) for runs captured on this Mac or its VM, with the
# eval key from this Mac's Keychain. For the owner to run (agents never read keys):
#
#   eval/bench1_judge_local.sh <run> [<run>...]     # run folders under $BENCH_DIR/out, e.g. vocet-cloud-mac-vm
#
# The key goes from the Keychain item straight into the judge process's environment: never echoed, written
# to a file or passed as an argument (`set -x` is refused). Then the accuracy and speed tables, numbers only.
set -euo pipefail
case $- in *x*) echo "bench1_judge_local: refusing to run with set -x" >&2; exit 2 ;; esac
HERE=$(cd "$(dirname "$0")" && pwd)
common=$(cd "$HERE/.." && git rev-parse --path-format=absolute --git-common-dir)
BENCH=${BENCH_DIR:-$(dirname "$(dirname "$common")")/dictation-bench}
die() { echo "bench1_judge_local: $*" >&2; exit 1; }
[ $# -ge 1 ] || die "usage: $0 <run folder under $BENCH/out> [...]"
for run in "$@"; do
  [ -f "$BENCH/out/$run/results.csv" ] && [ -f "$BENCH/out/$run/run.json" ] || die "no run at $BENCH/out/$run"
done
key=$(security find-generic-password -s com.dictationapp.eval -a openrouter-api-key -w 2>/dev/null) ||
  die "no Keychain item com.dictationapp.eval / openrouter-api-key"
status=0
for run in "$@"; do
  JUDGE_API_KEY=$key "$BENCH/bench" judge "$BENCH/out/$run" || status=1
done
unset key
scores=()
for run in "$@"; do [ -f "$BENCH/out/$run/score.json" ] && scores+=("$BENCH/out/$run/score.json"); done
[ "${#scores[@]}" -eq 0 ] || "$BENCH/bench" table "${scores[@]}"
exit "$status"
