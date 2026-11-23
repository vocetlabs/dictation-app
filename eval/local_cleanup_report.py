"""Builds eval/reports/local-cleanup.md's tables from the summary.json files of local_cleanup_screen.py.

Numbers only: it reads summary.json (never results.csv) and the candidates file (repo, file, licence).

    python3 eval/local_cleanup_report.py --candidates eval/local_cleanup_candidates.json \\
        --runs eval/work/local-cleanup > tables.md
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys


sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))


def cell(v, fmt="{}"):
    return "–" if v is None else fmt.format(v)


def load_summary(run_dir: pathlib.Path) -> dict:
    """summary.json, with the counts added if it predates them (from results.csv, else marked unknown)."""
    s = json.loads((run_dir / "summary.json").read_text())
    if "skipped_drafts" in s:
        return s
    results = run_dir / "results.csv"
    if results.exists():
        import csv

        import local_cleanup_screen as screen

        with results.open(newline="", encoding="utf-8") as fh:
            s.update(screen.counts(list(csv.DictReader(fh))))
    else:
        s.update(skipped_drafts=0, asked=s.get("asked", s["clips"]), blank_replies="?", request_failures="?")
    return s


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--candidates", type=pathlib.Path, required=True)
    ap.add_argument("--runs", type=pathlib.Path, required=True)
    a = ap.parse_args()
    data = json.loads(a.candidates.read_text())
    cands, judge = data["candidates"], data.get("judge", {})
    print("| Model (label) | Size | Licence | Guard fallbacks of asked (blank replies, failed requests) | Changed | Cleanup p50 / p95 (ms) | "
          "First token p50 (ms) | Load (s) | Peak RSS (MB) | Judge ZER (AMEND) |")
    print("| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |")
    runs_seen: list[dict] = []
    for c in cands:
        for variant_dir, suffix in ((c["label"], ""), (c["label"] + "-muesli", " (Muesli framing)")):
            p = a.runs / variant_dir / "summary.json"
            if not p.exists():
                continue
            s = load_summary(a.runs / variant_dir)
            runs_seen.append(s)
            j = judge.get(variant_dir)
            zer = f"{j[0]} ({j[1]})" if j else "–"
            print(f"| {c['name']}{suffix} (`{variant_dir}`) | {s['model_bytes'] / 1e9:.2f} GB | {c['licence']} | "
                  f"{s['guard_fallbacks']}/{s['asked']} ({s['blank_replies']} blank, {s['request_failures']} failed) | {cell(s['changed_share'], '{:.1%}')} | "
                  f"{s['total_ms_p50']} / {s['total_ms_p95']} | {s['first_token_ms_p50']} | {s['load_s']} | "
                  f"{s['peak_rss_mb']} | {zer} |")
    print("\n| Downloaded for LCL1 | SHA-256 (checked before each run) | Deleted after the run |")
    print("| --- | --- | --- |")
    for c in cands:
        if c.get("downloaded_for_lcl1"):
            print(f"| `{c['file']}` | `{c['sha256']}` | {'yes' if c.get('deleted_after_sha256_check') else 'no'} |")
    skipped = sum(r['skipped_drafts'] for r in runs_seen)  # every run in the table, Muesli runs included
    print(f"\nSkipped (blank) drafts across the {len(runs_seen)} runs above: {skipped}.")


if __name__ == "__main__":
    main()
