#!/usr/bin/env bash
# LCL1: run every candidate in eval/local_cleanup_candidates.json through local_cleanup_screen.py,
# one model at a time, one request at a time, waiting while the Mac is busy (load average above 4).
#
#   DRAFTS=/path/to/oruk.csv MODEL_DIRS="$HOME/vocet-cleanup-models /path/to/downloads" \
#       eval/local_cleanup_run.sh [label ...]        # default: every candidate
#
# MODEL_DIRS: directories searched for each candidate's GGUF file name. Each file's SHA-256 is checked
# against the candidates file before it runs. Outputs: eval/work/local-cleanup/<label>/ (git-ignored).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
: "${DRAFTS:?set DRAFTS to the OrukQwen drafts CSV (clip_id, transcript, status)}"
: "${MODEL_DIRS:?set MODEL_DIRS to the directories holding the GGUF files}"
out=${OUT:-$here/work/local-cleanup}
variant=${VARIANT:-app}

labels=("$@")
if [ ${#labels[@]} -eq 0 ]; then
  while IFS= read -r l; do labels+=("$l"); done < <(python3 -I -c "import json,sys;print(*[c['label'] for c in json.load(open(sys.argv[1]))['candidates']],sep='\n')" "$here/local_cleanup_candidates.json")
fi

for label in "${labels[@]}"; do
  read -r file sha < <(python3 -I -c "import json,sys;c=[c for c in json.load(open(sys.argv[1]))['candidates'] if c['label']==sys.argv[2]][0];print(c['file'],c['sha256'])" "$here/local_cleanup_candidates.json" "$label")
  path=""
  for d in $MODEL_DIRS; do [ -f "$d/$file" ] && path="$d/$file" && break; done
  [ -n "$path" ] || { echo "$label: $file not found in $MODEL_DIRS" >&2; exit 1; }
  got=$(shasum -a 256 "$path" | cut -d' ' -f1)
  [ "$got" = "$sha" ] || { echo "$label: SHA-256 mismatch for $path" >&2; exit 1; }
  run_label=$label; [ "$variant" = app ] || run_label="$label-$variant"
  [ -f "$out/$run_label/summary.json" ] && { echo "$run_label: done, skipping"; continue; }
  python3 -I "$here/local_cleanup_screen.py" --model "$path" --label "$run_label" --drafts "$DRAFTS" \
    --variant "$variant" --out "$out"
done
