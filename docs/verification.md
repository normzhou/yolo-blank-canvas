# Verification record — yolo-blank-canvas

Tested revision: see "Tested revision" below.
Environment: macOS (darwin), Node v24.20.0, npm 11.19.0, GitHub CLI installed and authenticated as `normzhou`.
Target repository for live checks: `normzhou/yolo-blank-canvas` (the app's own repository).

## Deterministic tests (`npm test`)

```
 ✓ test/status.test.ts (17 tests)          status/summary derivation from fixtures
 ✓ test/github-client.test.ts (8 tests)    target validation, argument isolation, PR exclusion, pagination
 ✓ test/gh-process.test.ts (4 tests)       real process boundary against a stand-in `gh` executable
 ✓ test/app-api.test.ts (13 tests)         session, cross-site, host, identity, write-ambiguity, endpoint scope
 ✓ test/launcher.test.ts (12 tests)        gh missing, first login, cancellation, noninteractive, port fallback
 ✓ test/markdown.test.tsx (5 tests)        untrusted Markdown cannot execute; links stay safe
 ✓ test/drafts.test.ts (5 tests)           draft preservation and clearing only after confirmation

 Test Files  7 passed (7)
      Tests  64 passed (64)
```

Also run: `npx tsc --noEmit` (clean), `npm run build` (clean).

Fixture coverage required by the spec, all in `test/status.test.ts`: untagged open issue → **Request open**; all four managed states; missing state, duplicate states, and state without `yolo:work` → **Status needs reconciliation** with raw labels; closure reasons `not_planned` / `duplicate` / `completed`; **Completed (reported)** vs **Closed**; unknown reason → **Closed — reason unavailable**; leftover state labels on a closed issue; reported-summary detection rules, most-recent-match selection, and `No progress summary yet.` / `Delivery timing not yet estimated.` fallbacks. No fixture asserts scheduling or availability.

## Live integration (real GitHub records)

Run through the local backend at `http://localhost:4317` (`node server/cli.js --no-open`), which reused the existing `gh` login with no extra step.

| Step | Result |
| --- | --- |
| Launcher with existing login | Printed repository `normzhou/yolo-blank-canvas`, `signed in as: normzhou (via GitHub CLI)`, `http://localhost:4317` |
| `GET /api/version` | `{"serverBuild":"<sha>","clientBuild":"<sha>"}` — matches the build identity |
| Session bootstrap (no Connect step) | `{"authenticated":true,"identity":"normzhou","repo":"normzhou/yolo-blank-canvas"}` |
| Issue creation through the app | [#1](https://github.com/normzhou/yolo-blank-canvas/issues/1) created with only the entered title/body |
| Managed-state issue created | [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2) + labels `yolo:work`, `yolo:state:active` |
| Conflicting-label issue created | [#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) + `yolo:work`, `yolo:state:queued`, `yolo:state:waiting` |
| Reply through the app | [comment 5973676276](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973676276) |
| Reply added outside the app | [comment 5973676365](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973676365) appeared in the app's comment list on refresh |
| `## YOLO status` summary comment | [comment 5974369089](https://github.com/normzhou/yolo-blank-canvas/issues/2#issuecomment-5974369089) rendered as the Reported summary with its source link and PR link clickable |
| Reply on a closed issue | [#1 closed as completed](https://github.com/normzhou/yolo-blank-canvas/issues/1), then reply accepted: [comment 5973677292](https://github.com/normzhou/yolo-blank-canvas/issues/1#issuecomment-5973677292) |
| Cross-site mutation (`Origin: https://evil.example`, `Sec-Fetch-Site: cross-site`) | `403`, no issue created |
| Unauthenticated mutation without a session cookie | `401` |
| Request addressed to a non-loopback `Host` | `400` |
| UI served | `GET /` returned the built canvas; assets served from `dist/client` |

Browser-driven checks (headless Chrome against the running app):

- Canvas renders the prompt and Requests button; the session is established automatically.
- List shows `#3 … Status needs reconciliation` and `#2 … In progress` (live label mapping).
- Detail shows the reported summary, the full discussion, and the reply box; footer shows last refresh and `UI build: <sha>`.
- Escape closes the panel and focus returns to the Requests button.
- A draft typed into **New request** survived closing the panel and reopening it.
- Changing the served client build ID produced the banner **“App version changed — reload to use the version this server is running.”** with user-initiated Reload / Not now.
- No console errors during these runs.

## Unverified / gaps

- **First-login path was not exercised end-to-end**: this machine already had an authenticated `gh`, so the interactive `gh auth login --web` branch is covered by unit tests (spawn arguments, single invocation, cancellation, and the noninteractive print-the-command path) but was not run against a real browser authorization.
- **`gh` missing path** is unit tested with a failing runner; it was not observed on a machine without the CLI.
- **The `--repo` flag targeting a second repository** was not exercised live; repository access checking was verified only for `normzhou/yolo-blank-canvas`.
- **Pagination beyond one page** was verified only with fixtures (`hasMore`, page parameters); the live repository has too few issues to exercise multi-page loads.
- **Browser-open behaviour** (`open`, `xdg-open`, `start`) was not observed live; the launcher prints the URL regardless, so it remains a best-effort convenience.
- **Lost authentication during a running session** was verified through the API surface and unit tests (explicit `auth_required` state with the login command and Retry connection), not by revoking real credentials mid-session.

## Tested revision

Source revision `3b507ee` ("Add README and verification record"); release tag `v0.1.0` points at the follow-up commit that carries the assets built from that source (`dist/client/.build-id` and `server/build-id.generated.js` both report `3b507ee…`). The build ID identifies the source revision the running assets were produced from; the assets-only commit follows it, which is the usual ordering for a committed build output.