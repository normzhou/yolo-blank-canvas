# Next milestones: Mobile touch support, Google-authenticated webapp feedback, and 2P online networking

2026-10-25

## Context

With `https://demo.yolo-dev.ai` live (`v0.15.0`) and the 15 Puzzle Bobble stages shipped (#210), the maintainer noted the next set of major candidate milestones to record in `brainstorm/` first (explicitly **unordered** — to be planned and sequenced together):

- **Common control-plane / UI overlay refactoring into `yolo-dev`** (tracked upstream in `normzhou/yolo-dev#285` and [`brainstorm/framework-settings-ui.md`](../framework-settings-ui.md)).
- **Mobile & tablet touch support:** Play Tetris and Puzzle Bobble on a phone or tablet with no keyboard.
- **Hosted webapp feedback with Google Sign-In:** Migrate from local-only `gh` login to token-based GitHub submission gated behind Google login so users on `demo.yolo-dev.ai` on another computer/phone can submit feedback.
- **2-Player online networking protocol:** Support 2-player Puzzle Bobble over the network across devices, starting with brainstorming and architecture.

## Summary of Architectural Proposals

Recorded in [`brainstorm/next-milestones-mobile-auth-netplay.md`](../next-milestones-mobile-auth-netplay.md):

1. **Mobile & Tablet Touch Support:**
   - **Puzzle Bobble:** Direct pointer/touch drag-to-aim on the SVG playfield (`atan2` angle from launcher pivot) + tactile bottom bar (`◀ -0.5°`, `FIRE`, `+0.5° ▶`) with press-and-hold sweep, defaulting to 1-Player view on narrow/coarse-pointer screens so the board + controls fit on one screen without scrolling.
   - **Tetris:** On-screen tactile arcade pad (`←`, `→`, `↻`, `↓`, `⤓`) with DAS auto-repeat + direct board touch gestures.
2. **Hosted Webapp Feedback (Google Sign-In + Scoped Bot Token):**
   - Serverless Cloudflare Worker + D1 (`yolo-client-identity-v1`) calling `https://api.github.com` directly with an encrypted `GITHUB_BOT_TOKEN` secret (no Oracle Cloud VM needed).
   - Anonymous visitors can play and read issues; `POST /api/issues` and `POST /api/issues/:n/comments` require a verified Google session and stamp `<!-- yolo:requester id="user_<hash>" issuer="login.yolo-dev.ai" -->` while enforcing append-only regular-user permissions.
3. **2-Player Online Networking Protocol (`yolo-pb-net-v1`):**
   - Hybrid deterministic seed (`mulberry32(seed)`) + event-driven protocol: 10–15 Hz throttled `aim_update` for smooth remote pointer movement, and reliable ordered `shot_fired` / `shot_settled` / `garbage_attack` events for deterministic board resolution and incoming garbage transfer.
   - Transport-agnostic `NetplayTransport` seam supporting local Node `ws` rooms (`server/app.js`), two-tab `BroadcastChannel`, and Cloudflare edge / WebRTC.
