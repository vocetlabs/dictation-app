"""Tests for local_cleanup_screen.py's pure parts: the app's token cap, the two request shapes, reply
stripping and percentiles. No model or server is started."""
import os
import pathlib
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import local_cleanup_screen as s  # noqa: E402


class ScreenTests(unittest.TestCase):
    def test_max_tokens_is_the_apps_rule(self):
        self.assertEqual(s.max_tokens(""), 100)
        self.assertEqual(s.max_tokens("abcd"), 102)
        self.assertEqual(s.max_tokens("é" * 4), 102)

    def test_app_request_has_system_and_transcript_turns(self):
        m = s.messages("app", "RULES", "hello")
        self.assertEqual([x["role"] for x in m], ["system", "user"])
        self.assertEqual(m[1]["content"], "<transcript>\nhello\n</transcript>")

    def test_muesli_request_puts_the_rules_in_the_user_turn(self):
        m = s.messages("muesli", "RULES", "hello")
        self.assertEqual(len(m), 1)
        self.assertEqual(m[0]["role"], "user")
        self.assertIn("RULES", m[0]["content"])
        self.assertIn("<USER-INPUT>\nhello\n</USER-INPUT>", m[0]["content"])

    def test_strip_reply_drops_the_wrappers(self):
        self.assertEqual(s.strip_reply("app", "<transcript>\nHi.\n</transcript>"), "Hi.")
        self.assertEqual(s.strip_reply("muesli", "<USER-INPUT>\nHi.\n</USER-INPUT>"), "Hi.")

    def test_percentile(self):
        self.assertEqual(s.percentile([1, 2, 3, 4, 5], 0.5), 3)
        self.assertEqual(s.percentile([10], 0.95), 10)

    def test_server_args_match_the_apps(self):
        cmd = s.server_cmd("llama-server", pathlib.Path("m.gguf"), 1234)
        for flag, value in (("-ngl", "99"), ("-c", "4096"), ("-np", "1"), ("--reasoning", "off"),
                            ("--temp", "0"), ("--seed", "1")):
            self.assertEqual(cmd[cmd.index(flag) + 1], value)

    def test_unsafe_labels_are_rejected(self):
        for bad in ("../x", "/abs", "a/b", ".hidden", "..", "a b", ""):
            with self.assertRaises(SystemExit):
                s.check_label(bad)
        self.assertEqual(s.check_label("qwen3-1.7b_muesli"), "qwen3-1.7b_muesli")

    def test_private_dir_refuses_symlinks_and_open_modes(self):
        with tempfile.TemporaryDirectory() as t:
            root = pathlib.Path(t)
            ok = root / "ok"
            self.assertEqual(s.private_dir(ok, create=True), ok)
            self.assertEqual(os.stat(ok).st_mode & 0o777, 0o700)
            link = root / "link"
            link.symlink_to(ok)
            with self.assertRaises(SystemExit):
                s.private_dir(link, create=False)
            open_dir = root / "open"
            open_dir.mkdir(mode=0o755)
            os.chmod(open_dir, 0o755)
            with self.assertRaises(SystemExit):
                s.private_dir(open_dir, create=False)

    def test_write_private_does_not_follow_a_symlink(self):
        with tempfile.TemporaryDirectory() as t:
            root = pathlib.Path(t)
            target = root / "target.txt"
            target.write_text("keep")
            link = root / "out.csv"
            link.symlink_to(target)
            with self.assertRaises(OSError):
                s.write_private(link, lambda fh: fh.write("x"))
            self.assertEqual(target.read_text(), "keep")
            fresh = root / "fresh.csv"
            s.write_private(fresh, lambda fh: fh.write("x"))
            self.assertEqual(os.stat(fresh).st_mode & 0o777, 0o600)

    def test_the_client_ignores_proxies_and_redirects(self):
        import http.server
        import threading

        class H(http.server.BaseHTTPRequestHandler):
            def do_GET(self):  # noqa: N802
                if self.path == "/go":
                    self.send_response(302)
                    self.send_header("Location", "/ok")
                    self.end_headers()
                else:
                    self.send_response(200)
                    self.end_headers()
                    self.wfile.write(b"ok")

            def log_message(self, *args):
                pass

        srv = http.server.HTTPServer(("127.0.0.1", 0), H)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{srv.server_port}"
        saved = {k: os.environ.get(k) for k in ("http_proxy", "HTTP_PROXY")}
        os.environ["http_proxy"] = os.environ["HTTP_PROXY"] = "http://127.0.0.1:1"  # a dead proxy
        try:
            with s.OPENER.open(base + "/ok", timeout=5) as r:  # would fail if it went through the proxy
                self.assertEqual(r.read(), b"ok")
            with self.assertRaises(Exception):  # a redirect is an error, not followed
                s.OPENER.open(base + "/go", timeout=5)
        finally:
            srv.shutdown()
            for k, v in saved.items():
                if v is None:
                    os.environ.pop(k, None)
                else:
                    os.environ[k] = v

    def test_counts_keep_skipped_blank_and_failed_apart(self):
        def row(raw, reason, pasted=None):
            return {"raw_text": raw, "reason": reason, "transcript": raw if pasted is None else pasted}
        c = s.counts([row("", "skipped"), row("a b", "cleaned", "A b."), row("c", "empty"),
                      row("d", "error_TimeoutError"), row("e", "echo")])
        self.assertEqual((c["skipped_drafts"], c["asked"], c["request_failures"], c["blank_replies"],
                          c["guard_fallbacks"]), (1, 4, 1, 1, 2))
        self.assertEqual(c["changed_share"], 0.25)


if __name__ == "__main__":
    unittest.main()
