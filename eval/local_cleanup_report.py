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
    a = ap.parse_args()
    data = json.loads(a.candidates.read_text())
    cands, judge = data["candidates"], data.get("judge", {})
    print("| Model (label) | Size | Licence | Guard fallbacks | Changed | Cleanup p50 / p95 (ms) | "
          "First token p50 (ms) | Load (s) | Peak RSS (MB) | Judge ZER (AMEND) |")
    print("| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    for c in cands:
        for variant_dir, suffix in ((c["label"], ""), (c["label"] + "-muesli", " (Muesli framing)")):
            p = a.runs / variant_dir / "summary.json"
            if not p.exists():
                continue
            s = json.loads(p.read_text())
            j = judge.get(variant_dir)
            zer = f"{j[0]} ({j[1]})" if j else "–"
            print(f"| {c['name']}{suffix} (`{variant_dir}`) | {s['model_bytes'] / 1e9:.2f} GB | {c['licence']} | "
                  f"{s['guard_fallbacks']}/{s['asked']} | {cell(s['changed_share'], '{:.1%}')} | "
                  f"{s['total_ms_p50']} / {s['total_ms_p95']} | {s['first_token_ms_p50']} | {s['load_s']} | "
                  f"{s['peak_rss_mb']} | {zer} |")


if __name__ == "__main__":
    main()
