# SITE-EMAIL test report, run 1

PR: #380 at 6aef2a0b
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Diff is only the 3 email lines | `git diff origin/main...HEAD` | pass | 2 files (`site/privacy.html` 2 lines, `site/terms.html` 1 line), each swapping `vocetlabs@gmail.com` for `hello@vocetlabs.com` in the link and its text |
| 2 | Both pages render | Tag-balance parse of both files; headless Chrome `--dump-dom` on both local files | pass | No unclosed or mismatched tags; both pages load with their full text |
| 3 | mailto links point to hello@vocetlabs.com | Grep, and the rendered DOM from headless Chrome | pass | 3 `mailto:hello@vocetlabs.com` links (2 in privacy, 1 in terms); no other mailto in `site/`; the old address remains only in the TOS1 milestone spec, which is history |
| 4 | Gate passes | CI on the PR | see PR comment | CI was pending when checked; the pre-push gate runs on push |

## Untested behaviour found
Mail delivery to hello@vocetlabs.com was not tested; the mailbox is outside this repo.

## Failures
None.
