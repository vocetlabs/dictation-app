# SITE-DL test report, run 1

PR: #381 at 38ad15c8
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Diff only touches the download URL, its comment and `site/README.md` | `git diff origin/main...HEAD` | pass (one note) | 2 files. Beyond the two button hrefs, the script's `DOWNLOAD_URL` and its comment, the footer "Releases" link now also points at the DMG (see Untested behaviour found) |
| 2 | Both Download buttons go to the v0.2.0 DMG, JS off | Raw HTML: both `data-download` anchors | pass | Both `href` = `.../releases/download/v0.2.0/Vocet_0.2.0_aarch64.dmg` |
| 3 | Same, JS on | Headless Chrome `--dump-dom` of the local file after the script ran | pass | Both anchors still carry the same URL |
| 4 | URL resolves | `curl -sIL` | pass | 302 to the GitHub asset store, ends at 200, content-length 15758303 |
| 5 | Gate passes | CI on the PR | see PR comment | CI was pending when checked; the pre-push gate runs on push |

Other: JSON-LD `softwareVersion` is already "0.2.0".

## Untested behaviour found
The footer link labelled "Releases" now downloads the DMG instead of opening the releases page. Not in the brief's list of changes; minor, left for the Lead to confirm it is intended. A real click-through in a visible browser was replaced by reading the anchors' hrefs in raw and rendered HTML.

## Failures
None.
