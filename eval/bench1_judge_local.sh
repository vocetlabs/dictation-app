#!/usr/bin/env bash
# REL2, internal: the bench's judge metrics (ZER, AMEND) for runs captured on this Mac or its VM, with the
# eval key from this Mac's Keychain. For the owner to run (agents never read keys):
#
#   eval/bench1_judge_local.sh <run> [<run>...]     # run folders under $BENCH_DIR/out, e.g. vocet-cloud-mac-vm
#
# The key goes from the Keychain item into the environment of each judge call only: never exported to this
# script's other commands (auto-export is switched off first, whatever `bash -a` or the caller set), echoed,
# written to a file or passed as an argument (`set -x` is refused). The bench must be a clean checkout; its
# commit is printed so the numbers can be traced to the judge code. Then the tables, numbers only.
set -euo pipefail
set +a
case $- in *x*) echo "bench1_judge_local: refusing to run with set -x" >&2; exit 2 ;; esac
HERE=$(cd "$(dirname "$0")" && pwd)
common=$(cd "$HERE/.." && git rev-parse --path-format=absolute --git-common-dir)
BENCH=${BENCH_DIR:-$(dirname "$(dirname "$common")")/dictation-bench}
die() { echo "bench1_judge_local: $*" >&2; exit 1; }
[ $# -ge 1 ] || die "usage: $0 <run folder under $BENCH/out> [...]"
for run in "$@"; do
  [[ $run =~ ^[A-Za-z0-9._-]+$ && $run != . && $run != .. ]] || die "not a run folder name: '$run'"
  [ -f "$BENCH/out/$run/results.csv" ] && [ -f "$BENCH/out/$run/run.json" ] || die "no run at $BENCH/out/$run"
done
commit=$(git -C "$BENCH" rev-parse HEAD 2>/dev/null) || die "$BENCH is not a git checkout of the bench"
[ -z "$(git -C "$BENCH" status --porcelain --untracked-files=no)" ] ||
  die "$BENCH has uncommitted changes: commit or stash them before judging with the key"
echo "bench1_judge_local: judging with dictation-bench $commit ($(git -C "$BENCH" rev-parse --abbrev-ref HEAD))"
unset JUDGE_API_KEY
declare +x key 2>/dev/null || true
key=$(security find-generic-password -s com.dictationapp.eval -a openrouter-api-key -w 2>/dev/null) ||
  die "no Keychain item com.dictationapp.eval / openrouter-api-key"
declare +x key
status=0
for run in "$@"; do
  JUDGE_API_KEY=$key "$BENCH/bench" judge "$BENCH/out/$run" || status=1  # that one call's environment only
done
unset key
scores=()
for run in "$@"; do [ -f "$BENCH/out/$run/score.json" ] && scores+=("$BENCH/out/$run/score.json"); done
[ "${#scores[@]}" -eq 0 ] || "$BENCH/bench" table "${scores[@]}"
exit "$status"
