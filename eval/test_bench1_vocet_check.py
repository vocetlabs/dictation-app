"""Tests for eval/bench1_vocet_check.py: the shortcut driver's calls, and the paired comparison (full
coverage required, the margin fixed in the file). No macOS or app needed."""
import csv
import json
import pathlib
import sys
import tempfile
import unittest
from unittest import mock

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import bench1_vocet_check as vc  # noqa: E402

MAN = [{"clip_id": f"c{i}", "spoken_text": f"word{i} one two three", "intended_text": f"Word{i} one two three."}
       for i in range(10)]


class DriverTests(unittest.TestCase):
    def test_press_and_release_go_to_the_running_app_with_open(self):
        drv = vc.VocetShortcutDriver("/Applications/Vocet.app", pathlib.Path("/tmp/x.wav"), vc.hn.Timing())
        with mock.patch.object(vc.subprocess, "run") as run:
            drv.press()
            drv.release()
        self.assertEqual([c.args[0] for c in run.call_args_list],
                         [["open", "-g", "-n", "/Applications/Vocet.app", "--args", f] for f in ("--press", "--release")])


class CompareTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.d = pathlib.Path(self.dir.name)
        self.man = self.d / "manifest.csv"
        with self.man.open("w", newline="") as fh:
            w = csv.DictWriter(fh, list(MAN[0]))
            w.writeheader()
            w.writerows(MAN)

    def tearDown(self):
        self.dir.cleanup()

    def run_dir(self, name, wrong=(), ids=None):
        d = self.d / name
        d.mkdir()
        ids = ids or [m["clip_id"] for m in MAN]
        rows = {c: {**{f: "" for f in vc.hn.FIELDS}, "clip_id": c, "status": "ok",
                    "transcript": ("x" if c in wrong else f"Word{c[1:]}") + " one two three."} for c in ids}
        vc.hn.write_rows(d / "results.csv", rows)
        (d / "run.json").write_text(json.dumps({"fingerprint": name, "clip_ids": ids, "timed": True,
                                                "manifest_sha256": vc.sc.digest(self.man)}))
        return d

    def test_identical_runs_agree_and_a_far_one_does_not(self):
        a, b = self.run_dir("a"), self.run_dir("b")
        res = vc.compare(a, b, self.man)
        self.assertEqual((res["agree"], res["discordant_clips"], res["identical_text_share"]), (True, 0, 100.0))
        far = self.run_dir("far", wrong={"c1", "c2", "c3"})  # 3 of 40 words wrong: 7.5 points
        res = vc.compare(a, far, self.man)
        self.assertEqual((res["agree"], res["discordant_clips"]), (False, 3))

    def test_runs_over_different_clips_are_refused(self):
        a = self.run_dir("a")
        b = self.run_dir("b9", ids=[m["clip_id"] for m in MAN[:9]])  # complete for its own selection
        with self.assertRaises(vc.sc.Incomplete):
            vc.compare(a, b, self.man)


if __name__ == "__main__":
    unittest.main()
