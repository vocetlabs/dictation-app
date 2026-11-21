# /// script
# requires-python = ">=3.11,<3.14"
# dependencies = ["sounddevice==0.5.1", "soundfile==0.12.1", "numpy==2.2.4", "soxr==0.5.0.post1",
#                 "pyobjc-framework-Quartz==11.0", "pyobjc-framework-ApplicationServices==11.0",
#                 "pyobjc-framework-Cocoa==11.0"]
# ///
"""BENCH1 acceptance criterion 2, internal to this repo: does the black-box path change what Vocet
transcribes?

Vocet's debug builds take `--debug-audio-file <wav>`: the app records that file instead of the microphone,
reading it on each press. `run` drives the bench's clip loop (eval/app_bench/harness.py: same clips,
padding, TextEdit read, outcomes) with a driver that writes each clip to that WAV and sends --press /
--release to the running app. `compare` pairs it with a black-box run of the same build and settings.

    open -g /Applications/Vocet.app --args --debug-audio-file ~/bench/shortcut.wav     # a debug build
    uv run bench1_vocet_check.py run --clips clips -o out/vocet-shortcut
    python3 eval/bench1_vocet_check.py compare out/vocet-mac-vm out/vocet-shortcut eval/app_bench/clips/manifest.csv

Agreement, fixed before running: both runs cover exactly the same clips with app outcomes, and their
intended-text WERs differ by at most MARGIN_PTS points. The report also gives the discordance (clips whose
edit counts differ) and the share of clips with identical normalized text. Never used for published
numbers: there Vocet runs through the microphone and its key like every app.
"""
from __future__ import annotations

import argparse
import json
import os
import pathlib
import subprocess
import sys
import time
from dataclasses import asdict

_here = pathlib.Path(__file__).resolve().parent
sys.path[:0] = [str(_here / "app_bench"), str(_here)]  # the repo layout, or flat next to harness.py in the VM
import harness as hn  # noqa: E402
import score as sc  # noqa: E402

MARGIN_PTS = 1.5


class VocetShortcutDriver(hn.Driver):
    def __init__(self, app_path: str, wav: pathlib.Path, timing: hn.Timing) -> None:
        self.app_path, self.wav, self.timing = app_path, wav, timing

    def load(self, clip: hn.Clip) -> None:
        import numpy as np
        import soundfile as sf
        import soxr
        a, sr = sf.read(clip.path, dtype="float32", always_2d=True)
        a = a.mean(axis=1)
        clip.speech_end_s = hn.speech_end(a, sr)
        if sr != 16000:
            a = soxr.resample(a, sr, 16000).astype("float32")
        pad = np.zeros(int(16000 * self.timing.pad_ms / 1000), dtype="float32")
        sf.write(self.wav, np.concatenate([pad, a, pad]), 16000, subtype="PCM_16")

    def _send(self, flag: str) -> float:
        t = time.monotonic()
        subprocess.run(["open", "-g", "-n", os.path.expanduser(self.app_path), "--args", flag], check=True)
        return t

    def press(self) -> float:
        return self._send("--press")

    def play(self, clip: hn.Clip) -> float:
        return time.monotonic()  # the app reads the whole file on --release

    def release(self) -> float:
        return self._send("--release")


def compare(a_dir: pathlib.Path, b_dir: pathlib.Path, manifest: pathlib.Path) -> dict:
    """Paired comparison of two runs; raises sc.Incomplete unless both cover the same clips completely."""
    sa, sb = sc.score_run(a_dir, manifest), sc.score_run(b_dir, manifest)
    pa = {c["clip_id"]: c for c in sa["per_clip"]}
    pb = {c["clip_id"]: c for c in sb["per_clip"]}
    if set(pa) != set(pb):
        raise sc.Incomplete(f"the runs cover different clips ({len(set(pa) ^ set(pb))} differ)")
    ta = {r["clip_id"]: sc.words(r["transcript"]) for r in sc.read_csv(a_dir / "results.csv")}
    tb = {r["clip_id"]: sc.words(r["transcript"]) for r in sc.read_csv(b_dir / "results.csv")}
    discordant = sorted(c for c in pa if pa[c]["intended_edits"] != pb[c]["intended_edits"])
    same_text = sum(ta[c] == tb[c] for c in pa)
    diff = round(sa["wer_intended"] - sb["wer_intended"], 2)
    return {"clips": len(pa), "wer_intended_a": sa["wer_intended"], "wer_intended_b": sb["wer_intended"],
            "diff_pts": diff, "margin_pts": MARGIN_PTS, "discordant_clips": len(discordant),
            "identical_text_share": round(100 * same_text / len(pa), 1), "agree": abs(diff) <= MARGIN_PTS}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--clips", type=pathlib.Path, required=True)
    r.add_argument("-o", "--output", type=pathlib.Path, required=True)
    r.add_argument("--app-path", default="/Applications/Vocet.app")
    r.add_argument("--wav", type=pathlib.Path, default=pathlib.Path.home() / "bench" / "shortcut.wav")
    r.add_argument("--limit", type=int)
    c = sub.add_parser("compare")
    c.add_argument("blackbox", type=pathlib.Path)
    c.add_argument("shortcut", type=pathlib.Path)
    c.add_argument("manifest", type=pathlib.Path)
    a = ap.parse_args()
    if a.cmd == "compare":
        res = compare(a.blackbox, a.shortcut, a.manifest)
        print(json.dumps(res, indent=1))
        return 0 if res["agree"] else 1
    from macos import TextEditTarget
    timing = hn.Timing(tail=0.5)
    clips = hn.load_clips(a.clips, a.limit)
    info = {"app": "vocet-shortcut", "harness": hn.HARNESS_VERSION, "timing": asdict(timing), "timed": True,
            "manifest_sha256": sc.digest(a.clips / "manifest.csv"), "clip_ids": [x.clip_id for x in clips]}
    info["fingerprint"] = hn.fingerprint(**info)
    hn.run_all(clips, VocetShortcutDriver(a.app_path, a.wav, timing),
               TextEditTarget(pathlib.Path.home() / "bench" / "scratch.txt"), hn.Clock(), timing, a.output,
               run=info, restart_after_ambiguous=False)
    return 0


if __name__ == "__main__":
    sys.exit(main())
