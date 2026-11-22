"""Tests for local_cleanup_screen.py's pure parts: the app's token cap, the two request shapes, reply
stripping and percentiles. No model or server is started."""
import pathlib
import sys
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


if __name__ == "__main__":
    unittest.main()
