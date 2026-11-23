#!/usr/bin/env bash
# LCL1: run every candidate in eval/local_cleanup_candidates.json through local_cleanup_screen.py,
# one model at a time, one request at a time, waiting while the Mac is busy (load average above 4).
#
#   DRAFTS=/path/to/oruk.csv eval/local_cleanup_run.sh -d "$HOME/vocet-cleanup-models" \
#       -d "/path/with spaces/downloads" [label ...]        # default: every candidate
#
# -d DIR (repeatable, each one quoted argument): a directory searched for each candidate's GGUF file name.
# Each file's SHA-256 is checked against the candidates file before it runs. Outputs: OUT (default
# eval/work/local-cleanup, git-ignored, made private 0700) / <label>/. VARIANT=muesli runs the Muesli framing.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
: "${DRAFTS:?set DRAFTS to the OrukQwen drafts CSV (clip_id, transcript, status)}"
model_dirs=()
while getopts "d:" opt; do
  case $opt in
  d) model_dirs+=("$OPTARG") ;;
  *) exit 2 ;;
  esac
done
shift $((OPTIND - 1))
[ ${#model_dirs[@]} -gt 0 ] || { echo "give at least one -d DIR holding the GGUF files" >&2; exit 2; }
out=${OUT:-$here/work/local-cleanup}
variant=${VARIANT:-app}

labels=("$@")
if [ ${#labels[@]} -eq 0 ]; then
  while IFS= read -r l; do labels+=("$l"); done < <(python3 -I -c "import json,sys;print(*[c['label'] for c in json.load(open(sys.argv[1]))['candidates']],sep='\n')" "$here/local_cleanup_candidates.json")
fi

for label in "${labels[@]}"; do
  read -r file sha < <(python3 -I -c "import json,sys;c=[c for c in json.load(open(sys.argv[1]))['candidates'] if c['label']==sys.argv[2]][0];print(c['file'],c['sha256'])" "$here/local_cleanup_candidates.json" "$label")
  path=""
  for d in "${model_dirs[@]}"; do [ -f "$d/$file" ] && path="$d/$file" && break; done
  [ -n "$path" ] || { echo "$label: $file not found in: ${model_dirs[*]}" >&2; exit 1; }
  got=$(shasum -a 256 "$path" | cut -d' ' -f1)
  [ "$got" = "$sha" ] || { echo "$label: SHA-256 mismatch for $path" >&2; exit 1; }
  run_label=$label; [ "$variant" = app ] || run_label="$label-$variant"
  [ -f "$out/$run_label/summary.json" ] && { echo "$run_label: done, skipping"; continue; }
  python3 -I "$here/local_cleanup_screen.py" --model "$path" --label "$run_label" --drafts "$DRAFTS" \
    --variant "$variant" --out "$out"
done
