# SITE-README test report, run 1

PR: #363 at e9558a89
Result: PASS

| # | Criterion | Test(s) | Result | Notes |
| - | --------- | ------- | ------ | ----- |
| 1 | Only `site/README.md` changes | `git diff origin/main...HEAD --stat` | pass | 1 line replaced |
| 2 | Stated settings match the Cloudflare settings in the PR body | Read both | pass | Body names the repo `vocetlabs/dictation-app`, the reconnect after the repo move (#358) and include path `site/*`; README says the same. Branch `main`, root `/site`, no build command, deploy command and preview builds off are not in the body; they match the rest of the README (deploys from the default branch, `npx wrangler deploy`, no preview builds). |

## Gate
CI on the PR: not re-run locally (Markdown only).

## Untested behaviour found
The Cloudflare dashboard is not reachable from here, so the settings were compared to the PR text only. The Lead's post-merge check (new Deployments row, `terms.html` 200) covers the real deploy.

## Failures
None.
