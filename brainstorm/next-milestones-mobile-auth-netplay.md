# Candidate milestones: Mobile touch support, Google-authenticated webapp feedback, and 2P online networking

Status: exploring (unordered — to be planned/prioritized) · 2026-10-25

Following the live launch of [`https://demo.yolo-dev.ai`](https://demo.yolo-dev.ai) (`v0.15.0`), this document captures the candidate major milestones on the table (unordered; sequence and scope to be planned):

- **Candidate A — Common Control-Plane & UI Layer Refactoring into `yolo-dev`** (tracked upstream in [`normzhou/yolo-dev#285`](https://github.com/normzhou/yolo-dev/issues/285) and in [`brainstorm/framework-settings-ui.md`](framework-settings-ui.md)).
- **Candidate B — Mobile & Tablet Touch Support** (play Tetris and Puzzle Bobble on a phone or tablet with no keyboard).
- **Candidate C — Hosted Webapp Feedback via Google Sign-In + Scoped Bot Token** (allow users on `demo.yolo-dev.ai` on another computer/phone to sign in with Google and submit feedback/requests without local `gh`).
- **Candidate D — 2-Player Online Networking Protocol** (play 2P Puzzle Bobble over the network across devices).

---

## Candidate B: Mobile & Tablet Touch Support (Zero-Keyboard Play)

### Priority & Device-Tier Segregation (2026-10-25 Update)
- **Leading priority:** Mobile/tablet touch support is the highest-leverage next step because `https://demo.yolo-dev.ai` is now public and visitors opening the link on a phone or iPad currently have no way to play without a physical keyboard.
- **Good news — Puzzle Bobble 1P mode already exists!** `src/shared/puzzleBobble.ts` (`createMatch('1p')`) and `PuzzleBobbleView.tsx` already implement a full **1-Player mode** where clearing a board awards the speed bonus and automatically advances through `Stage 1` → `Stage 15`. Today it simply defaults to `'2p'` on all screen sizes, which causes the two `360px` boards to stack vertically on a `390px` phone screen.
- **Three-Tier Device Segregation (`Phone` vs. `Tablet / iPad` vs. `Desktop`):**

| Device Tier | Viewport / Input Detection | Tetris Mode | Puzzle Bobble Mode | Control Surface |
| --- | --- | --- | --- | --- |
| **1. Phone (Portrait / Narrow)** | `width < 768px` | **1 Player** (compact board + bottom touch pad) | **1 Player only** (auto-selects `'1p'` and hides the `2 Players` toggle so a second board never stacks below the fold) | Single-player touch controls (drag on board to aim + bottom `◀` `FIRE` `▶` bar) |
| **2. Tablet / iPad & Wide Touch** | `width >= 768px` and `(pointer: coarse)` | **1 Player** (full board + touch pad) | **2 Players side-by-side** (two `360px` cards = `736px`, fitting `768px+` iPad screens side-by-side!) *or* **1 Player** | **Independent per-card multi-touch:** each player's card has its own touch SVG aim + its own `◀` `FIRE` `▶` touch bar, using `PointerEvent.pointerId` so P1 (left side of iPad) and P2 (right side of iPad) can aim and fire simultaneously with zero interference! |
| **3. Desktop / Laptop** | `width >= 768px` and `(pointer: fine)` | **1 Player** (keyboard + optional pointer/click) | **2 Players side-by-side** (`ASDF` vs `Arrows`) *or* **1 Player** | Keyboard (`ASDF` / `Arrows` / `Space`) + mouse/trackpad drag-to-aim and click controls |

### Proposed UX & Input Architecture

1. **Home Slide Deck:**
   - Horizontal touch swipe (`onPointerDown` / `onPointerUp` delta-X) on `.deck-slide-card` flips to the previous/next game slide, alongside existing tap targets (`Play`, stacked preview cards, header switcher).
2. **Puzzle Bobble — Direct Pointer Aiming + Per-Board Touch Arcade Bar:**
   - **Direct Drag-to-Aim on the Board SVG (`PointerEvents` with `pointerId` capture):**
     - Touching/dragging anywhere on a player's board SVG computes the exact angle from that board's launcher pivot `(LAUNCHER_X, LAUNCHER_Y)` to the pointer `(svgX, svgY)`:
       $$\theta = \operatorname{clamp}\left(\operatorname{atan2}(x - x_0,\; y_0 - y) \cdot \frac{180}{\pi},\; -75^\circ,\; +75^\circ\right)$$
     - Because each `<PlayerArena>` tracks its own `activePointerId`, on an iPad in 2P mode **Player 1 and Player 2 can both drag on their own boards at the exact same time** (true multi-touch!).
   - **Tactile Touch Control Bar Inside Each `<PlayerArena>` Card:**
     - Dedicated touch buttons inside the card: **`◀ -0.5°`** (tap for `0.5°` micro-step, hold for smooth sweep), **`FIRE`** (prominent primary pill), and **`+0.5° ▶`** (tap for `0.5°` micro-step, hold for smooth sweep).
     - Putting the touch bar inside `<PlayerArena>` means in 1P phone mode there is one bar at the bottom of the screen, and in 2P iPad mode each player has their own bar directly under their own board.
   - **Automatic Phone `< 768px` 1P Enforcement:**
     - When `window.innerWidth < 768`, initialize Puzzle Bobble in `'1p'` mode (and if resized below `768px`, switch to `'1p'`) and hide the `2 Players` mode button so phones always get a clean single-board layout that fits in one viewport.
3. **Tetris — On-Screen Arcade Pad + Board Gestures:**
   - **On-Screen Touch Pad (`←`, `→`, `↻ Rotate`, `↓ Soft`, `⤓ Drop`):**
     - Rendered below the board, with press-and-hold auto-repeat (`160ms` initial delay, `55ms` repeat) for left/right/soft-drop.
   - **Direct Board Touch Gestures:**
     - Drag horizontally across the board to move column-by-column; tap board to rotate; flick down to hard-drop.
   - `touch-action: none` / `user-select: none` on game surfaces so rapid taps never trigger mobile browser pinch-zoom or text selection.

---

## Candidate C: Hosted Webapp Feedback via Google Sign-In + Scoped Bot Token

### Problem
Locally (`npx`), the Express backend (`server/app.js`) uses the user's local `gh` CLI session. On `https://demo.yolo-dev.ai`, the static Cloudflare Worker (`hosting/cloudflare/worker.mjs`) has no backend, so `/api/session` returns `503 Backend configuration unavailable`. We want remote visitors on `demo.yolo-dev.ai` to be able to submit feedback and requests **after signing in with Google** (without needing a GitHub account or an Oracle Cloud VM).

### Proposed Serverless Architecture (Cloudflare Worker + D1 + GitHub Bot Token)

Because Cloudflare Workers can make outbound HTTPS `fetch()` calls directly to `https://api.github.com`, **no Oracle Cloud VM is needed** to support full feedback and request submission on `demo.yolo-dev.ai`:

```text
Browser (https://demo.yolo-dev.ai)
  │  1. Sign in with Google -> /auth/yolo/login -> https://login.yolo-dev.ai
  │  2. Host-only Secure HttpOnly session cookie (verified in client D1 `APP_DB`)
  ▼
Cloudflare Worker (hosting/cloudflare/worker.mjs + yolo-client-identity-v1)
  ├── Static Assets (`env.ASSETS` -> dist/client)
  ├── GET /api/session
  │     Returns { authenticated: true, identity: "user_8f92a1", role: "requester", authProvider: "google" }
  │     (or { authenticated: false, loginUrl: "/auth/yolo/login" } when not signed in)
  ├── GET /api/issues & GET /api/issues/:n(/comments)
  │     Reads public issues/comments from GitHub API (cached / ETag-backed, filters out yolo:control & yolo:manual for non-maintainers)
  └── POST /api/issues & POST /api/issues/:n/comments
        Requires verified Google principal (`principal !== null && principal.emailVerified === true`)
        Calls GitHub REST API using `env.GITHUB_BOT_TOKEN` (scoped to regular-user permissions)
        Stamps `<!-- yolo:requester id="user_8f92a1" issuer="login.yolo-dev.ai" -->`
```

### Key Security & Governance Properties
1. **Google Login Required for Writes:** Anonymous visitors on `demo.yolo-dev.ai` can play games and browse existing requests, but clicking **Start a request**, **Feedback**, or **Reply** prompts **Sign in with Google** (`POST /auth/yolo/login`).
2. **Privacy-Preserving Attribution (`user_8f92a1`):** The Worker derives a stable opaque user ID (`HMAC-SHA256(APP_IDENTITY_SALT, principal.issuer + ":" + principal.subject).slice(0, 8)`) so the user's raw email is **never** written to the public GitHub issue, yet the user can see their own handle (`user_8f92a1`) and filter **"My requests"**.
3. **Scoped Bot Token & Rate Limiting:**
   - `GITHUB_BOT_TOKEN` is stored as an encrypted Cloudflare Worker secret (`wrangler secret put GITHUB_BOT_TOKEN`).
   - The Worker's requester route only permits `POST /repos/normzhou/yolo-blank-canvas/issues` (`title` + `body` only, no `labels`/`assignees`) and `POST /repos/normzhou/yolo-blank-canvas/issues/:n/comments` on unlocked non-control issues, with per-`subject` rate limiting enforced in D1.
4. **Dependencies on `yolo-dev`:**
   - Requires `login.yolo-dev.ai` (`normzhou/yolo-dev#178–#181`) to be active and `yolo-demo` registered as an OIDC client, plus a client-owned D1 database (`APP_DB`) bound in `hosting/cloudflare/wrangler.json`.

---

## Candidate D: 2-Player Online Networking Protocol (Puzzle Bobble)

### Problem
Today, 2-Player Puzzle Bobble runs two boards side-by-side in a single browser window (`ASDF` vs. `Arrows`). Supporting 2-player play over the network lets two people on different computers or phones battle in real time with rooms, matchmaking, or invite links (`https://demo.yolo-dev.ai/?app=puzzle-bobble&room=BUB7`).

### Why Puzzle Bobble Fits an Event-Driven + Deterministic Seed Protocol
Puzzle Bobble has two kinds of state:
1. **High-frequency local visual state (Aim angle):**
   - Each player's launcher angle (`-75°..+75°`) changes smoothly at 60fps while aiming, but **nothing on the grid changes until a bubble is fired and settles**.
   - Sending unreliable/throttled `aim` updates at **10–15 Hz** (`~40 bytes/msg`) is plenty for rendering the opponent's aiming arrow smoothly (with client-side interpolation).
2. **Discrete authoritative board events (Shots, Pops, Drops, Garbage, Ceiling, KO):**
   - At match start, the room coordinator generates a shared 32-bit `seed` and `stagePreset`. Both clients initialize `createMatch('2p', mulberry32(seed))` so both players start with the **exact same opening grid and bubble sequence**.
   - When a player fires a shot, their client steps the projectile (so local play feels **zero-latency**) and emits `shot_fired` (so the opponent sees the flying bubble immediately) followed by `shot_settled` (or the room coordinator validates `settleBubbleAt` deterministically from `(shotId, aimAngle)`).
   - When a shot pops 4+ bubbles or drops hanging clusters, the resulting `garbage_attack { count, colors, fromShotId }` event is delivered over the ordered channel into the opponent's `incomingQueue`, triggering the existing side-rail warning orbs and bottom-up rising bubble animation!

### Candidate Transport & Room Topologies

| Option | Architecture | Pros | Cons / Requirements |
| --- | --- | --- | --- |
| **Option A: WebSocket Room Relay (Local Node `ws` + Cloudflare Durable Object)** | Browser 1 ⟷ WebSocket Room (`?room=ABCD`) ⟷ Browser 2. Locally backed by `ws` in `server/app.js`; in production backed by a Cloudflare Durable Object (`MatchRoomDO`). | - **Works through 100% of firewalls/NATs** (no STUN/TURN failures)<br>- `hosting/cloudflare/transport.mjs` & `preview.mjs` **already support WebSocket upgrades**<br>- Room coordinator owns authoritative 10s shot timer, reconnect grace, and spectator support | - Cloudflare Durable Objects require verify against Free/Paid plan policy (or can run on the local/backend server first). |
| **Option B: WebRTC DataChannel (P2P) + Lightweight Signaling** | Browsers exchange SDP offer/answer via a short-lived room code endpoint, then send `aim` and `shot` messages directly peer-to-peer. | - Zero relay server compute during gameplay<br>- Ultra-low P2P latency on same LAN/region | - Fails on symmetric NATs / strict corporate/mobile firewalls (~15% of connections) without a TURN relay server. |
| **Option C: Hybrid (Shared Wire Protocol over `BroadcastChannel` / `WebSocket` / `WebRTC`)** | Define a transport-agnostic `NetplayTransport` interface (`send(msg)`, `onMessage(cb)`). Support: (1) `WebSocket` in `server/app.js`, (2) `BroadcastChannel` (instant 2-tab testing on one machine), and (3) Cloudflare edge / WebRTC. | - **Cleanest architecture:** game logic (`puzzleBobble.ts`) and UI (`PuzzleBobbleView.tsx`) don't care which transport carries the messages; 100% testable in Playwright with 2 browser contexts! | - Still needs a signaling/relay choice (Option A or B) for cross-machine play on `demo.yolo-dev.ai`. |

### Proposed Wire Protocol (`yolo-pb-net-v1`)

```ts
type NetplayMessage =
  | { type: 'room_joined'; roomId: string; role: 'p1' | 'p2' | 'spectator'; seed: number; stage: number }
  | { type: 'player_ready'; player: 0 | 1; character: CharacterId; stage: number }
  | { type: 'match_start'; seed: number; stage: number; characters: [CharacterId, CharacterId]; startAtMs: number }
  | { type: 'aim_update'; player: 0 | 1; angle: number; seq: number }
  | { type: 'shot_fired'; player: 0 | 1; shotId: number; angle: number; color: BubbleColor }
  | {
      type: 'shot_settled';
      player: 0 | 1;
      shotId: number;
      row: number;
      col: number;
      color: BubbleColor;
      sentGarbage: BubbleColor[];
      status: 'playing' | 'won' | 'ko';
      score: number;
    }
  | { type: 'rematch_request'; player: 0 | 1; stage: number };
```

---

## Open Questions (`Q1–Q4`)

- **Q1 (Planning & Sequencing):** These candidates are deliberately unordered. When we plan our next steps, which candidate(s) should we design/tackle first, and what dependencies exist between them (e.g., `login.yolo-dev.ai` readiness in `yolo-dev`)?
- **Q2 (Mobile Touch UX for Puzzle Bobble):** On mobile, should dragging on the board **only aim** (with a dedicated **`FIRE`** button to shoot, preventing accidental misfires), or should **releasing your finger (`pointerup`)** also fire? (Or a toggle between *Drag + Tap Fire* and *Drag & Release to Fire*?)
- **Q3 (Hosted Feedback Auth Before `login.yolo-dev.ai` Is Live):** For Candidate C, `login.yolo-dev.ai` in `yolo-dev` (`#178–#181`) is currently a local preview (`hosting/yolo-identity`). Do we want to wait for `login.yolo-dev.ai` to go live in `yolo-dev`, or set up direct Google OIDC / GitHub OAuth in `yolo-demo-app` in the meantime?
- **Q4 (2P Netplay Transport on `demo.yolo-dev.ai`):** For Candidate D on `demo.yolo-dev.ai`, do we prefer **WebSocket rooms** (local Node `ws` + Cloudflare Durable Object / Worker) or **WebRTC P2P DataChannels** with Worker signaling?

## Governing record

- Current architecture & contracts: [`.yolo/governance/ARCHITECTURE.md`](../.yolo/governance/ARCHITECTURE.md)
- Shared login & client identity preview: [`.agents/skills/yolo/references/client-identity.md`](../.agents/skills/yolo/references/client-identity.md)
- Session log: [`brainstorm/log/2026-10-25-01-mobile-auth-and-netplay-milestones.md`](log/2026-10-25-01-mobile-auth-and-netplay-milestones.md)
