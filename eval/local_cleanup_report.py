"""Builds eval/reports/local-cleanup.md's tables from the summary.json files of local_cleanup_screen.py.

Numbers only: it reads summary.json (never results.csv) and the candidates file (repo, file, licence).

    python3 eval/local_cleanup_report.py --candidates eval/local_cleanup_candidates.json \\
        --runs eval/work/local-cleanup > tables.md
"""
from __future__ import annotations

import argparse
import json
import pathlib


def cell(v, fmt="{}"):
    return "–" if v is None else fmt.format(v)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", type=pathlib.Path, required=True)
    ap.add_argument("--runs", type=pathlib.Path, required=True)
    ap.add_argument("--vm", type=pathlib.Path, help="runs directory of the dictation-vm-bench repeat")
    a = ap.parse_args()
    cands = json.loads(a.candidates.read_text())["candidates"]
    print("| Model (label) | Size | Licence | Guard fallbacks | Changed | Cleanup p50 / p95 (ms) | "
          "First token p50 (ms) | Load (s) | Peak RSS (MB) | VM p50 / p95 (ms) | Judge ZER |")
    print("| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |")
    for c in cands:
        for variant_dir, suffix in ((c["label"], ""), (c["label"] + "-muesli", " (Muesli framing)")):
            p = a.runs / variant_dir / "summary.json"
            if not p.exists():
                continue
            s = json.loads(p.read_text())
            vm = "–"
            if a.vm and (a.vm / variant_dir / "summary.json").exists():
                v = json.loads((a.vm / variant_dir / "summary.json").read_text())
                vm = f"{v['total_ms_p50']} / {v['total_ms_p95']}"
            print(f"| {c['name']}{suffix} (`{variant_dir}`) | {s['model_bytes'] / 1e9:.2f} GB | {c['licence']} | "
                  f"{s['guard_fallbacks']}/{s['asked']} | {cell(s['changed_share'], '{:.1%}')} | "
                  f"{s['total_ms_p50']} / {s['total_ms_p95']} | {s['first_token_ms_p50']} | {s['load_s']} | "
                  f"{s['peak_rss_mb']} | {vm} | |")


if __name__ == "__main__":
    main()
