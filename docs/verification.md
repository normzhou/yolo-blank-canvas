# Verification record — yolo-blank-canvas

Tested revision: see "Tested revision" below.
Environment: macOS (darwin), Node v24.20.0, npm 11.19.0, GitHub CLI installed and authenticated as `normzhou`.
Target repository for live checks: `normzhou/yolo-blank-canvas` (the app's own repository).

## Universal YouTube-Style Pause Icon & Pause Menu, Circular Translucent Mobile Overlay Controls, Natural Mobile Swipe Deck, and Animated Selector Game Previews with Per-Game Music (#242: #237, #238, #239, #240) — 2026-10-27

Source revision `8e4bbed` (the universal YouTube-style pause icon, Pause Menu, circular mobile overlay controls, swipe deck, and animated selector game previews commit); build and review evidence `2dc29d2`; release commit `510a920`; published as `v0.21.0` on 2026-10-27.

- **Universal YouTube-Style Pause Icon & In-Game Pause Menu (`src/client/gamePause.ts`, `src/client/App.tsx`, `src/client/views/TetrisView.tsx`, `src/client/views/PuzzleBobbleView.tsx`, #237):**
  - Added `button.pause-launcher` (`data-testid="pause-button"`) in the bottom-right control cluster alongside the YouTube-style sound (`button.sound-launcher`) and fullscreen (`button.fullscreen-launcher`) icons whenever a game is active, and removed the text `Pause` and `Close` buttons from the in-game header.
  - Pressing `Escape` or clicking `button.pause-launcher` opens the centered arcade **Pause Menu** (`data-testid="game-pause-menu"`, `role="dialog"`, `aria-label="Game paused"`) with **Continue** (`data-testid="pause-menu-resume"`), **New game** (`data-testid="pause-menu-restart"`), and **Exit to menu** (`data-testid="pause-menu-exit"`, `aria-label="Close Tetris"` / `aria-label="Close Puzzle Bobble"`).
- **Circular Translucent Mobile Virtual Overlay Buttons (`src/client/styles.css`, `src/client/views/TetrisView.tsx`, `src/client/views/PuzzleBobbleView.tsx`, #238):**
  - Styled `button.pb-touch-btn` as circular, semi-transparent arcade buttons (`border-radius: var(--radius-pill)`, `44px–48px` diameter) grouped into left/right clusters (`.touch-cluster-left`, `.touch-cluster-right`) with an active tap highlight (`border-color: var(--tetromino-o); color: var(--tetromino-o); transform: scale(1.1)`), floating cleanly over the bottom of the stage on phone viewports (`@media (max-width: 559px)`).
- **Natural Mobile Swipe Gesture on the Game Deck (`src/client/App.tsx`, `src/client/styles.css`, #239):**
  - Added `touch-action: pan-y` on `.deck-slide-card` plus real-time horizontal finger-tracking drag offset (`deckDragOffsetX`) for both pointer and touch events (`onPointerMove` / `onTouchMove`) and a responsive `36px` swipe threshold to flip between games naturally on mobile.
- **Animated Gameplay Previews with Delayed Fade-In & Per-Game Music on the Selector Screen (`src/client/App.tsx`, `src/client/styles.css`, #240):**
  - Added delayed fade-in (`450ms`) animated gameplay loops inside `DeckPreviewGraphic` (`data-testid="deck-live-preview"`, `data-preview-game={appId}`): falling/locking T-piece and line-clear flash on Tetris; sweeping aim pointer, flying bubble, and cluster pop ring on Puzzle Bobble.
  - Crossfades the selector screen soundtrack to the currently selected slide's own game playlist (`TETRIS_PLAYLIST` when viewing Tetris, `PUZZLE_BOBBLE_PLAYLIST` when viewing Puzzle Bobble).
- `npm test`: 23 files, 161 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 45 passed.

### Installed artifact (`v0.21.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.21.0 --no-open --port 4887` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `8e4bbed…`; the tagged package version is `0.21.0`. The tag points at release commit `510a920`, after the assets commit `2dc29d2`.

`YOLO_VERIFY_URL=http://127.0.0.1:4887 npm run e2e:verify-release`: **11 passed, 0 failed**. The report is [`.yolo/reports/releases-observed-2026-10-27-v0210.json`](../.yolo/reports/releases-observed-2026-10-27-v0210.json).

## 2-Player Online Networking for Tetris and Puzzle Bobble with Presence, Corner Invite Toast, Versus Garbage Rules, and Opponent Mini-Radar (#236) — 2026-10-27

Source revision `aeb69f1` (the 2P online networking, Versus garbage rules, and Opponent Mini-Radar commit); build and review evidence `6c3c675`; release commit `cefbdd6`; published as `v0.20.0` on 2026-10-27.

- **Multi-User Presence, Open Invites & Room Event Relay (`server/netplay.js`, `server/app.js`, `hosting/cloudflare/worker.mjs`, `src/client/netplay.ts`):**
  - Added `/api/netplay` (`GET` and `POST`) on both the local Express server and the Cloudflare Worker (`demo.yolo-dev.ai`), bridged with `BroadcastChannel('yolo:netplay:v1')` on the client for instant same-browser multi-tab pairing as well as cross-device/remote pairing.
  - Added the non-intrusive bottom-left online presence pill (`data-testid="online-presence-pill"`, e.g. `2 online`, `aria-label="2 players online"`), home deck online count badge (`data-testid="deck-online-count"`), and non-blocking bottom-right corner invite toast (`data-testid="netplay-invite-toast"`) with `Join 2P` (`data-testid="netplay-accept-invite"`) and `Dismiss` (`data-testid="netplay-dismiss-invite"`).
- **Competitive Versus Tetris Garbage & Opponent Mini-Radar (`src/shared/tetris.ts`, `src/client/views/TetrisView.tsx`, `test/tetris.test.ts`):**
  - Implemented standard Versus Tetris garbage rules (`garbageForLines`: 2 lines → 1 garbage, 3 lines → 2 garbage, 4-line Tetris → 4 garbage, plus `+1` per consecutive line-clear combo starting from the 2nd consecutive clear), incoming garbage countering (`queueTetrisGarbage`), and bottom garbage line insertion (`addGarbageLines` with 9 `'G'` blocks and 1 aligned empty hole column when a piece locks without clearing lines).
  - Added `2P Online` mode (`data-testid="tetris-2p-online-btn"`), the vertical 20-segment incoming garbage warning meter (`data-testid="tetris-garbage-meter"`), and the live 10×20 **Opponent Mini-Radar** (`data-testid="tetris-opponent-radar"`) in `.tetris-side`.
- **Single-Screen 2P Online Puzzle Bobble & Opponent Mini-Radar (`src/client/views/PuzzleBobbleView.tsx`):**
  - Added `2P Online` mode (`data-testid="pb-2p-online-btn"`): each player's screen renders only their own full-size single-player board (`data-mode="1p"`, no second full-size board) alongside a live **Opponent Mini-Radar** (`data-testid="pb-opponent-radar"`) in `.pb-side` showing the opponent's settled hex bubbles, compressor drop, danger line, launcher aim angle, score, and round status, while syncing garbage bubble attacks (`pb_attack`), stage clear / KO outcomes (`pb_outcome`), and rematches (`pb_rematch`).
- `npm test`: 23 files, 161 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 44 passed (including 2-browser-session E2E verification across `e2e/screenshots/15-netplay-pb-session1.png`, `15-netplay-pb-session2.png`, `16-netplay-tetris-session1.png`, and `16-netplay-tetris-session2.png`).

### Installed artifact (`v0.20.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.20.0 --no-open --port 4886` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `aeb69f1…`; the tagged package version is `0.20.0`. The tag points at release commit `cefbdd6`, after the assets commit `6c3c675`.

`YOLO_VERIFY_URL=http://127.0.0.1:4886 npm run e2e:verify-release`: **11 passed, 0 failed**. The report is [`.yolo/reports/releases-observed-2026-10-27-v0200.json`](../.yolo/reports/releases-observed-2026-10-27-v0200.json).

## Tone.js-style PolySynth/FMSynth/MembraneSynth engine, expanded + selector soundtracks with crossfading, game SFX, YouTube sound icon, and borderless arcade HUD (#234) — 2026-10-26

Source revision `76b8b7d` (the Tone.js-style synth engine, 12 tracks with crossfading, game SFX, YouTube sound icon, and borderless arcade HUD commit); build and review evidence `e7cea3a`; release commit `d74fe06`; published as `v0.19.0` on 2026-10-26.

- **Tone.js-Style Synth Engine & Real-Time Arcade SFX (`src/client/audio/toneSynth.ts`):**
  - Implemented native Web Audio `TonePolySynth`, `ToneFMSynth`, and `ToneMembraneSynth` (CSP-clean under `default-src 'none'; script-src 'self'`, zero `blob:` workers) sharing the same iOS-unlocked `AudioContext` and `AnalyserNode` as `TetrisMusic`.
  - Wired real-time `ArcadeSfx` into **Puzzle Bobble** (`bubble-shoot`, `bubble-pop`, `bubble-avalanche`, `garbage-send`, `garbage-rise`, `round-win` / `round-lose`) and **Tetris** (`tetris-rotate`, `tetris-drop`, `tetris-line-clear`, `tetris-four-line` fanfare, `tetris-over`).
- **Expanded Soundtracks + Selector Screen Playlist + Crossfading (`public/tetris/*.m4a`, `src/shared/tetrisMusic.ts`, `src/client/audio/tetrisMusic.ts`):**
  - Kept all 6 existing tracks and added 6 new full-length (~2-minute) FM/PolySynth/MembraneSynth tracks (`selector-arcade-lobby.m4a` `116.0s`, `selector-pixel-lounge.m4a` `114.3s`, `technotris-fm.m4a` `118.4s`, `cosmic-odyssey.m4a` `118.3s`, `pb-candy-playground.m4a` `118.3s`, `pb-soda-pop.m4a` `114.9s` — 12 tracks total across `SELECTOR_PLAYLIST`, `TETRIS_PLAYLIST`, and `PUZZLE_BOBBLE_PLAYLIST`), verified via closed-loop `afconvert` decode, STFT spectral analysis, and spectrogram inspection (`/tmp/qa-234/new-tracks-spectrograms.png`).
  - Added dual-voice `GainNode` crossfading (`CROSSFADE_SEC = 1.2s`) when switching between screens (`SELECTOR_PLAYLIST` <-> `TETRIS_PLAYLIST` <-> `PUZZLE_BOBBLE_PLAYLIST`) or advancing tracks.
- **YouTube-Style Transparent Sound Icon & Borderless Arcade HUD (`src/client/App.tsx`, `src/client/styles.css`):**
  - Added `button.sound-launcher` (`data-testid="sound-button"`, `right: 52px; bottom: 10px`) right beside `button.fullscreen-launcher` in the bottom-right corner and removed text `Music off` buttons from the game headers.
  - Removed boxy app-button borders from `.tetris-header button`, `.filter-group`, `.pb-tally`, `.pb-status-pills .badge`, `.pb-char-btn`, `.tetris-side`, `.pb-side`, `.tetris-stat`, `.pb-next-orb-well`, and `.pb-combo-bar`.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.19.0`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.19.0 --no-open --port 4885` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `76b8b7d…`; the tagged package version is `0.19.0`. The tag points at release commit `d74fe06`, after the assets commit `e7cea3a`.

`YOLO_VERIFY_URL=http://127.0.0.1:4885 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: aa7611eb-7d54-4d61-a159-c8fb9acbcfdf`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.19.0"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 76b8b7d537cd2e33933dfdbbdc06fc0a59167c4d`). The report is [`.yolo/reports/releases-observed-2026-10-26-v0190.json`](../.yolo/reports/releases-observed-2026-10-26-v0190.json).

## Game-specific 2-minute Tetris & whimsical Puzzle Bobble soundtracks with closed-loop audio verification (#232) — 2026-10-26

Source revision `76afac0` (the game-specific 2-minute soundtracks and closed-loop audio verification commit); build and review evidence `d7e10e9`; release commit `fdaa140`; published as `v0.18.0` on 2026-10-26.

- **Dedicated ~2-minute soundtracks (`public/tetris/*.m4a`, `src/shared/tetrisMusic.ts`, `src/client/audio/tetrisMusic.ts`, `src/client/views/PuzzleBobbleView.tsx`, `docs/assets.md`):**
  - **Tetris (`TETRIS_PLAYLIST` / `PLAYLIST`)**:
    - `korobeiniki.m4a` (*Korobeiniki (Type A)*, `117.6s`, `922 KB`, RMS `0.202`, musical band ratio `93.11%`)
    - `kalinka-troika.m4a` (*Kalinka & Troika (Type B)*, `116.7s`, `917 KB`, RMS `0.238`, musical band ratio `91.18%`)
    - `baroque-invention.m4a` (*Baroque Invention (Type C)* — J.S. Bach *BWV 814 Menuet & Trio*, `115.9s`, `854 KB`, RMS `0.215`, musical band ratio `84.97%`)
  - **Puzzle Bobble (`PUZZLE_BOBBLE_PLAYLIST`)**:
    - `pb-bubble-march.m4a` (*Bubble Dragon March*, `114.7s`, `900 KB`, RMS `0.188`, musical band ratio `96.34%`)
    - `pb-rainbow-carnival.m4a` (*Rainbow Island Carnival*, `116.6s`, `915 KB`, RMS `0.244`, musical band ratio `95.79%`)
    - `pb-starlight-carousel.m4a` (*Starlight Carousel*, `114.6s`, `903 KB`, RMS `0.225`, musical band ratio `93.69%`)
  - **Closed-loop verification**:
    - Decoded every `.m4a` back to PCM WAV via `afconvert` and verified duration (`>= 114s`), RMS loudness (`0.188–0.244`), peak headroom (`0.785–0.874`), minimum 1s window RMS (`>= 0.109`, zero dead-silence gaps), and STFT musical harmonic band energy (`84.97%–96.34%`), plus visually inspected the 6-track spectrogram sheet (`/tmp/qa-232/spectrograms.png`).
    - Wired an `AnalyserNode` (`sampleOutputMetrics()` / `window.__yoloAudioMetrics`) into `TetrisMusic` and verified real-time decoded waveform `rms > 0.005` and `durationSec >= 105` in headless Chrome for both Tetris (`e2e/deterministic.spec.ts`) and Puzzle Bobble (`e2e/puzzle-bobble.spec.ts`).
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.18.0`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.18.0 --no-open --port 4884` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `76afac0…`; the tagged package version is `0.18.0`. The tag points at release commit `fdaa140`, after the assets commit `d7e10e9`.

`YOLO_VERIFY_URL=http://127.0.0.1:4884 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 86526c3c-4cc8-4220-89ed-023405179554`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.18.0"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 76afac0068c261ba233559a5756260ef98e407e0`). The report is [`.yolo/reports/releases-observed-2026-10-26-v0180.json`](../.yolo/reports/releases-observed-2026-10-26-v0180.json).

## Bottom-right YouTube fullscreen icon and streamlined Feedback overlay (#230) — 2026-10-26

Source revision `037e29e` (the bottom-right YouTube fullscreen icon and streamlined Feedback overlay commit); build and review evidence `80f161a`; release commit `7002d07`; published as `v0.17.2` on 2026-10-26.

- **Bottom-right YouTube-style fullscreen icon (`src/client/styles.css`):**
  - Moved `button.fullscreen-launcher` (`data-testid="fullscreen-button"`) to `bottom: 10px; right: 12px` (matching YouTube's bottom-right placement) with right-side clearance on mobile touch bars.
- **Streamlined Feedback overlay & public demo unavailable notice (`src/client/components/Panel.tsx`, `src/client/views/NewRequestView.tsx`, `src/client/components/ErrorNotice.tsx`, `src/client/api.ts`, `src/client/styles.css`):**
  - Centered `.panel[data-view='new']` and `.panel[data-view='static']` as a compact modal card, replaced visible GitHub repo/account/refresh/build-SHA/preview chrome with a clean **"Feedback"** header and icon-badged intent tiles (`Share feedback`, `Build or change`, `Report a problem`), and kept all 3 intent tiles in a single horizontal row on mobile so the form fits on one screen without scrolling.
  - On `demo.yolo-dev.ai` (`static_demo` mode), replaced the technical `npx` / `GitHub CLI` error box and disabled form with **"Currently feedback on the public version is not available, stay tuned."**
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.17.2`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.17.2 --no-open --port 4883` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `037e29e…`; the tagged package version is `0.17.2`. The tag points at release commit `7002d07`, after the assets commit `80f161a`.

`YOLO_VERIFY_URL=http://127.0.0.1:4883 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: fd0fc834-7fa2-47ae-9d71-ae31490d2bfb`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.17.2"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 037e29e2eff0fa52a7c0e57a98186d9de81131d1`). The report is [`.yolo/reports/releases-observed-2026-10-26-v0172.json`](../.yolo/reports/releases-observed-2026-10-26-v0172.json).

## Default fullscreen with bottom-left YouTube-style icon and top-right bare transparent YOLO mark (#228) — 2026-10-26

Source revision `4220922` (the default fullscreen, bottom-left YouTube icon, and top-right bare YOLO mark commit); build and review evidence `70d368a`; release commit `ac45e51`; published as `v0.17.1` on 2026-10-26.

- **Default fullscreen & bottom-left YouTube-style transparent icon (`src/client/fullscreen.ts`, `src/client/App.tsx`, `src/client/styles.css`):**
  - Defaulted `data-fullscreen="true"` (`isFullscreen: true`) on load, attempting `requestFullscreen({ navigationUI: 'hide' })` / `webkitRequestFullscreen()` on mount and upgrading to native browser fullscreen on the first user gesture unless toggled off.
  - Replaced text `"Full screen"` buttons with a single global transparent YouTube-style 4-corner bracket icon button (`button.fullscreen-launcher`, `data-testid="fullscreen-button"`) anchored at `bottom: 10px; left: 12px` (`background: transparent; border: none; box-shadow: none`).
- **Top-right bare transparent YOLO mark (`src/client/App.tsx`, `src/client/styles.css`):**
  - Moved `button.yolo-launcher` (`data-testid="yolo-feedback-fab"`) to `top: 10px; right: 12px` and removed all circular button chrome (`background: transparent; border: none; box-shadow: none`), leaving only the bare wiggling `#d84b27` Threefold symbol.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.17.1`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.17.1 --no-open --port 4882` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `4220922…`; the tagged package version is `0.17.1`. The tag points at release commit `ac45e51`, after the assets commit `70d368a`.

`YOLO_VERIFY_URL=http://127.0.0.1:4882 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 2289037d-b8e4-4379-b0dd-73afbb88e65b`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.17.1"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 422092292f715c5029a5868167aacf7a08a106ff`). The report is [`.yolo/reports/releases-observed-2026-10-26-v0171.json`](../.yolo/reports/releases-observed-2026-10-26-v0171.json).

## Dynamic viewport scaling and text/chrome reduction for Puzzle Bobble and Tetris (#226) — 2026-10-26

Source revision `d46ef4e` (the viewport scaling and text/chrome reduction commit); build and review evidence `24996c5`; release commit `61078d9`; published as `v0.17.0` on 2026-10-26.

- **Dynamic viewport scaling (`src/client/styles.css`, `src/client/views/PuzzleBobbleView.tsx`, `src/client/views/TetrisView.tsx`):**
  - Scaled Puzzle Bobble `.pb-board` (`--pb-board-w` derived from `vw` and `dvh` for both `1p` and `2p` modes, up to `540px×713px` per board in 2P and `580px×766px` in 1P on desktop, and full-width `374px×494px` with a horizontal telemetry strip on portrait phones) while keeping viewport-locked dimensions (`0px` layout shift, #195).
  - Scaled Tetris `--tetris-cell-size` (`clamp(18px, min(calc((100dvh - 156px) / 20), calc((100vw - 156px) / 10)), 42px)`) so the `10×20` matrix fills the available screen height.
- **Reduced unnecessary text and chrome:**
  - Removed the bottom `.tetris-help` instruction paragraph from active gameplay, moved `.tetris-scene` into `.tetris-header` as a compact inline pill, merged `.pb-char-bar` into `.pb-player-header` with icon-only character buttons (`.sr-only` labels preserved), and replaced idle `INSERT COIN` filler.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.17.0`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.17.0 --no-open --port 4881` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `d46ef4e…`; the tagged package version is `0.17.0`. The tag points at release commit `61078d9`, after the assets commit `24996c5`.

`YOLO_VERIFY_URL=http://127.0.0.1:4881 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 873a7846-b61d-49d3-a8d7-00ee08d68422`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.17.0"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 d46ef4e9eef5ae856b5e792cca0c4a8cbee03159`). The report is [`.yolo/reports/releases-observed-2026-10-26-v0170.json`](../.yolo/reports/releases-observed-2026-10-26-v0170.json).

## Multi-touch virtual buttons and simultaneous 2-player touch aiming/firing (#224) — 2026-10-25

Source revision `e6c7543` (the multi-touch virtual buttons commit); build and review evidence `5d2c129`; release commit `062b9db`; published as `v0.16.7` on 2026-10-25.

- **Multi-touch virtual buttons (`src/client/views/PuzzleBobbleView.tsx`, `src/client/views/TetrisView.tsx`):**
  - Switched `● FIRE` (Puzzle Bobble) and `↻ ROTATE` / `⤓ DROP` (Tetris) from `onClick`-only to immediate `onPointerDown` activation (with `onClick` `event.detail === 0` fallback for keyboard activation) and added `setPointerCapture(event.pointerId)` on `◀ AIM` and `AIM ▶` so non-primary touches (`isPrimary: false`) fire immediately with zero latency even while up to 3 other fingers are holding aim or dragging on a board.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed (including simultaneous 4-pointer multi-touch test across Player 1 and Player 2).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.16.7`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.7 --no-open --port 4880` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `e6c7543…`; the tagged package version is `0.16.7`. The tag points at release commit `062b9db`, after the assets commit `5d2c129`.

`YOLO_VERIFY_URL=http://127.0.0.1:4880 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 737a6568-d93a-425e-abfa-a58d9f2184ce`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.7"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 e6c7543676dd41ddcfd4355aeb9a43e4267f554b`). The report is [`.yolo/reports/releases-observed-2026-10-25-v0167.json`](../.yolo/reports/releases-observed-2026-10-25-v0167.json).

## MS Edge tablet 2-Player support and Browser Fullscreen API toggle (#222) — 2026-10-25

Source revision `79ac07c` (the MS Edge tablet 2P and Browser Fullscreen API commit); build and review evidence `51f7217`; release commit `0ad0ae4`; published as `v0.16.6` on 2026-10-25.

- **MS Edge tablet 2-Player availability (`src/client/views/PuzzleBobbleView.tsx`, `src/client/styles.css`):**
  - Updated `isPhoneViewport()` so only phone-sized viewports (`window.innerWidth < 560` in portrait, or `window.innerWidth < 900 && window.innerHeight < 440` in phone landscape) enforce `1p` mode, while tablets in MS Edge (`600×960` Android portrait, `744×1133` iPad Mini 6 portrait, `768×1024` iPad portrait, and `960×480` / `1024×768` landscape even when MS Edge tabs and address bar compress `innerHeight`) default to **2 Players** with responsive side-by-side layout on `560px–759px` viewports.
- **Browser Fullscreen API mode (`src/client/fullscreen.ts`, `src/client/App.tsx`, `PuzzleBobbleView.tsx`, `TetrisView.tsx`, `index.html`):**
  - Added `useFullscreen()` (`requestFullscreen({ navigationUI: 'hide' })` + `webkitRequestFullscreen` fallback + `exitFullscreen` / `webkitExitFullscreen`) and `Full screen` / `Exit full screen` toggle buttons (`data-testid="fullscreen-button"`, `aria-pressed`) on the home slide deck, Tetris, and Puzzle Bobble.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed (asserting side-by-side 2P boards across `600×960`, `744×1133`, `768×1024`, `960×480`, and `1024×768` plus `fullscreen-button` toggle).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.16.6`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.6 --no-open --port 4879` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `79ac07c…`; the tagged package version is `0.16.6`. The tag points at release commit `0ad0ae4`, after the assets commit `51f7217`.

`YOLO_VERIFY_URL=http://127.0.0.1:4879 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 312f1576-d262-4ec3-bb9f-ee006b73877f`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.6"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 79ac07c6558b2c518cbf342bf98890021816fcc5`). The report is [`.yolo/reports/releases-observed-2026-10-25-v0166.json`](../.yolo/reports/releases-observed-2026-10-25-v0166.json).

## Remove top bar completely and leave only the wiggling YOLO icon launcher (#220) — 2026-10-25

Source revision `071b13a` (the top-bar removal and wiggling YOLO launcher commit); build and review evidence `ff8c47c`; release commit `2a3098d`; published as `v0.16.5` on 2026-10-25.

- **OS-icon style wiggling YOLO launcher (`src/client/App.tsx`, `src/client/components/Panel.tsx`, `src/client/styles.css`, `.yolo/governance/ARCHITECTURE.md`):**
  - Removed `.canvas-header` completely across both the home deck and active games on all viewports, leaving only the floating `44×44px` circular wiggling YOLO icon button (`button.yolo-launcher`, `data-testid="yolo-feedback-fab"`).
  - Clicking the wiggling YOLO icon opens the modal `<Panel>` overlay layer (including in `static_demo` mode on `https://demo.yolo-dev.ai`, rendering the static preview notice, guided composer, and `ThemeSwitcher` inside the modal overlay).
  - Integrated the compact `Canvas gallery` (`‹` `Tetris` `Puzzle Bobble` `›`) pill switcher into `.deck-slide-actions` on the home slide card so there is no bar above the card.
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.16.5`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.5 --no-open --port 4878` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `071b13a…`; the tagged package version is `0.16.5`. The tag points at release commit `2a3098d`, after the assets commit `ff8c47c`.

`YOLO_VERIFY_URL=http://127.0.0.1:4878 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: b5f727cf-5d83-4f17-958e-95a07f3af503`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.5"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 071b13ab28508772660e134ac495bc10da963058`). The report is [`.yolo/reports/releases-observed-2026-10-25-v0165.json`](../.yolo/reports/releases-observed-2026-10-25-v0165.json).

## iOS mobile music playback, full-screen non-scrolling game stage, rotating YOLO logo overlay, and translucent mobile button overlays (#217) — 2026-10-25

Source revision `0a5f192` (the mobile music, full-screen stage, rotating YOLO overlay, and translucent touch buttons commit); build and review evidence `f8d3f70`; release commit `d2fa2b7`; published as `v0.16.3` on 2026-10-25.

- **iOS Safari & Chrome music playback (`src/client/audio/tetrisMusic.ts`, `TetrisView.tsx`, `PuzzleBobbleView.tsx`):**
  - Unlocks and starts playback synchronously inside the `Music off` -> `Music on` `onClick` user gesture (`ensureContext()` + `setActive(...)`), sets `navigator.audioSession.type = 'playback'` (iOS 17+), plays a 1-sample silent unlock buffer, and decodes `.m4a` tracks via `fetch(track.src)` + `AudioContext.decodeAudioData` so playback does not depend on HTTP `206 Partial Content` byte-range responses on static Worker origins.
- **Full-screen non-scrolling game stage & rotating YOLO logo overlay (`src/client/App.tsx`, `src/client/styles.css`, `index.html`):**
  - Active games (`.canvas.is-playing`) fill `100vw × 100dvh` with `touch-action: none`, `overscroll-behavior: none`, and non-passive `touchmove` `preventDefault()` so dragging on the screen aims or moves pieces without scrolling the browser viewport.
  - Replaced the top header bar during gameplay with a floating **rotating YOLO logo** button (`data-testid="yolo-feedback-fab"`, `44×44px` on mobile) using the official `yolo-dev` Threefold symbol asset (`viewBox="0 0 96 96"`, `#d84b27`, three 120° square-capped `<path d="M48 48v30" />` arms, `public/brand/yolo-mark.svg`, `public/brand/yolo-mark-static.svg`, `public/symbol.svg`, and `src/client/brand/yoloMark.ts` `animateYoloMark`) that opens the full-screen Feedback/Requests overlay (`<Panel>`).
  - Styled mobile touch buttons (`.pb-touch-btn`) as translucent ring-outline mobile game virtual overlays (`--touch-overlay-bg: rgba(255, 255, 255, 0.03)`, `--touch-overlay-border: rgba(255, 255, 255, 0.55)`).
- `npm test`: 23 files, 158 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run e2e`: 43 passed (`horizOverflow <= 0`, `vertOverflow <= 0`, `scrollY === 0`, `fabWidth <= 48`, `touchBarBg === 'rgba(0, 0, 0, 0)'`).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`, 13/13 findings compliant.

### Installed artifact (`v0.16.4`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.4 --no-open --port 4877` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `674b890…`; the tagged package version is `0.16.4`. The tag points at release commit `2a63a2b`, after the assets commit `8de8015`.

`YOLO_VERIFY_URL=http://127.0.0.1:4877 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 14110910-ec13-4cf8-8127-28ef83ec99d7`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.4"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 674b8905c31bfde7b27362229bf48a85a4ce0544`). The report is [`.yolo/reports/releases-observed-2026-10-25-v0164.json`](../.yolo/reports/releases-observed-2026-10-25-v0164.json).

### Installed artifact (`v0.16.3`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.3 --no-open --port 4876` in an empty directory, with no source checkout. `GET /api/version` reported both `serverBuild` and `clientBuild` as `0a5f192…`; the tagged package version is `0.16.3`. The tag points at release commit `d2fa2b7`, after the assets commit `f8d3f70`.

`YOLO_VERIFY_URL=http://127.0.0.1:4876 npm run e2e:verify-release`: **11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: d45d253c-040f-4d8a-a48b-d55490f489a0`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.3"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 0a5f1923454f1c6418c7c865d144480984ffff0c`). The report is [`.yolo/reports/releases-observed-2026-10-25-v0163.json`](../.yolo/reports/releases-observed-2026-10-25-v0163.json).

## 3D arcade cabinet & control deck polish for Puzzle Bobble and Tetris (#215) — 2026-10-25

Source revision `4a09cf5` (the arcade cabinet polish commit); build and review
evidence `269f4f1`; release commit `84b7c1e`; published as `v0.16.2` on
2026-10-25.

- **Closed-loop visual inspection across phone (`390×844`), iPad (`768×1024`), and desktop (`1280×900`):**
  - Scoped dark Neo-Geo / Taito arcade cabinet tokens (`--cabinet-bg`, `--cabinet-surface`, `--cabinet-well`, `--cabinet-bezel`, `--arcade-fire`, `--arcade-rocker`, `--arcade-rotate`) to `.tetris` while preserving opaque `--surface` on `.tetris-side`, `.tetris-title`, `.tetris-help`, and `.tetris-scene`.
  - Replaced stacked white enterprise form cards with a transparent `.pb-player-card` frame over the pixel-art scene, a `1UP`/`2UP` marquee plate, a fighter select strip with miniature SVG mascot icons (`CharacterTokenIcon`), a `NEXT BUBBLE` dome, a 2×2 compact telemetry grid (`ANGLE`, `DROP`, `SHOTS`, `WARN`/`LEFT`), an in-board `★ WINNER! ★` / `× GAME OVER ×` plaque, and 3D beveled arcade plunger/rocker buttons (`◀ AIM`, `● FIRE`, `AIM ▶`, `◀`, `▼`, `▶`, `↻ ROTATE`, `⤓ DROP`).
- `npm test`: 23 files, 157 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `4a09cf5…`.
- `npm run e2e`: 43 passed.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.16.2`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.2 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `4a09cf5…`; the tagged package version is
`0.16.2`. The tag points at release commit `84b7c1e`, after the assets commit
`269f4f1`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 506aea64-c332-4f44-b8ae-205ac14f7316`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.2"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 4a09cf5d26bf2925e55f65433479a1069ad983b3`). The report is
[`.yolo/reports/releases-observed-2026-10-25-v0162.json`](../.yolo/reports/releases-observed-2026-10-25-v0162.json).

## Multi-format closed-loop QA & responsive fixes across 7 device viewports (#212) — 2026-10-25

Source revision `992189c` (the multi-format QA fix commit); build and review
evidence `150cbea`; release commit `5e95bb6`; published as `v0.16.1` on
2026-10-25.

- **Closed-loop visual & geometric inspection across 7 device formats** (`360×640` small phone, `390×844` phone portrait, `844×390` phone landscape, `768×1024` iPad Mini portrait, `820×1180` iPad Air portrait, `1024×768` iPad landscape, `1280×900` desktop):
  1. **iPad Mini Portrait (`768×1024`) 2P side-by-side fit:** Added `@media (min-width: 768px) and (max-width: 860px)` padding tightening so both `360px` Puzzle Bobble cards sit side-by-side (`top: 342px` on both cards, `scrollH: 1024 === clientH: 1024`) instead of wrapping vertically.
  2. **Phone Landscape (`844×390`) 1P detection:** Updated `isPhoneViewport()` to check `window.innerWidth < 768 || Math.min(window.innerWidth, window.innerHeight) < 560` so rotating a phone to landscape (`844×390`, short edge `390px < 560px`) stays in 1-Player mode instead of squeezing two `468px`-tall 2P boards into a `390px`-tall screen.
  3. **Small Phone (`360×640`) `.pb-side` fit:** Compacted `.pb-side` (`96px`) and `.pb-arena-row` gap (`6px`) below `640px` so the `224px` board + `96px` sidebar (`326px`) fits inside the `336px` card with zero clipping (`sideClipped: false`).
  4. **Tetris cabinet width on wide viewports:** Capped `.tetris:not(.pb-game)` header/touch-bar/footer elements at `max-width: 360px` and centered `.tetris-body` so the Tetris cabinet stays compact around its `237px` board + `92px` sidebar on iPad and desktop.
- `npm test`: 23 files, 157 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `992189c…`.
- `npm run e2e`: 43 passed (`e2e/puzzle-bobble.spec.ts` asserts `390×844` phone portrait 1P, `844×390` phone landscape 1P, `360×640` small phone unclipped sidebar, `768×1024` iPad portrait 2P side-by-side, and `1024×768` iPad landscape 2P side-by-side).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.16.1`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.1 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `992189c…`; the tagged package version is
`0.16.1`. The tag points at release commit `5e95bb6`, after the assets commit
`150cbea`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: b2dd6550-8251-47b3-82ab-5a645f215292`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.1"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 992189cca46a6f368bd87fbcaf9c956bdb946415`). The report is
[`.yolo/reports/releases-observed-2026-10-25-v0161.json`](../.yolo/reports/releases-observed-2026-10-25-v0161.json).

## Mobile and tablet touch support for Puzzle Bobble, Tetris, and the home slide deck (#212) — 2026-10-25

Source revision `ca12567` (the feature commit); build and review evidence
`e1a0130`; release commit `5942f23`; published as `v0.16.0` on 2026-10-25. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 23 files, 157 tests passed (`test/puzzle-bobble.test.ts` verifies
  `aimAngleFromBoardPoint` and `setPlayerAimAngle`).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `ca12567…`.
- `npm run e2e`: 43 passed (`e2e/puzzle-bobble.spec.ts` (3) verifies `< 768px`
  phone `1p`-only enforcement with zero horizontal overflow, `>= 768px`
  tablet/iPad `2p` side-by-side layout, direct drag-to-aim on the board SVG
  without accidental firing on release, `FIRE` button shooting, and `tetris-touch-controls`
  without a keyboard).
- `cd hosting/cloudflare && npm run check`: `wrangler deploy --dry-run` passes
  with `APP_VERSION="v0.16.0"`.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.16.0`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.16.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `ca12567…`; the tagged package version is
`0.16.0`. The tag points at release commit `5942f23`, after the assets commit
`e1a0130`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: d7e20e21-8448-40c5-957d-d91190ccfc5a`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.16.0"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 ca125676c7cf8d4da3c7dc4e6974ff1f8c34906f`). The report is
[`.yolo/reports/releases-observed-2026-10-25-v0160.json`](../.yolo/reports/releases-observed-2026-10-25-v0160.json).

## Expand Puzzle Bobble to 15 named classic stages with level stepper (#210) — 2026-10-25

Source revision `faa219f` (the feature commit); build and review evidence
`ab0d85c`; release commit `b760fcc`; published as `v0.15.0` on 2026-10-25. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 23 files, 157 tests passed (`test/puzzle-bobble.test.ts` verifies
  `TOTAL_STAGES === 15`, `STAGE_CATALOG` titles `Stage 1: Paired Blocks` through
  `Stage 15: Emperor's Citadel`, and `findFloatingBubbles(createStageGrid(s, () => 0)) === []`
  for all 15 stages).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `faa219f…`.
- `npm run e2e`: 42 passed (`e2e/puzzle-bobble.spec.ts` verifies `Next stage` /
  `Previous stage` stepping across `Wave: Random`, `Stage 1: Paired Blocks`, and
  `Stage 15: Emperor's Citadel`).
- `cd hosting/cloudflare && npm run check`: `wrangler deploy --dry-run` passes
  with `APP_VERSION="v0.15.0"`.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.15.0`) & Live `https://demo.yolo-dev.ai` Update

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.15.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `faa219f…`; the tagged package version is
`0.15.0`. The tag points at release commit `b760fcc`, after the assets commit
`ab0d85c`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. Also deployed live to `yolo-demo-app` (`Version ID: 215c9d30-ecaf-4938-a380-0f54f2c28869`) and verified at `https://demo.yolo-dev.ai/__yolo/version` (`200 {"version":"v0.15.0"}`) and `https://demo.yolo-dev.ai/.build-id` (`200 faa219ff071c50772717b8a692cf7bf06abd6509`). The report is
[`.yolo/reports/releases-observed-2026-10-25-v0150.json`](../.yolo/reports/releases-observed-2026-10-25-v0150.json).

## Live static publication at `https://demo.yolo-dev.ai` (#199, `normzhou/yolo-dev#208`) — 2026-10-25

Deployed client Cloudflare Worker `yolo-demo-app` (`Version ID: 188dcfa2-bd7f-4532-9162-b9dd277a9cf1`, `Deployment ID: fd52d5ff-0642-4d0d-9512-04032fe5f85a`, `APP_VERSION: "v0.14.2"`, build `a38b872b8d34159d46df4a69293e20c6a9649e53`) behind the `yolo-dev` operator gateway on [`normzhou/yolo-dev#208`](https://github.com/normzhou/yolo-dev/issues/208) (**Receiver revision 9 — FULFILLED**).

- **Live HTTPS endpoint checks (`https://demo.yolo-dev.ai`):**
  - `GET https://demo.yolo-dev.ai/` → `200 OK` (`<title>Blank canvas</title>`)
  - `GET https://demo.yolo-dev.ai/__yolo/version` → `200 OK` (`{"version":"v0.14.2"}`)
  - `GET https://demo.yolo-dev.ai/.build-id` → `200 OK` (`a38b872b8d34159d46df4a69293e20c6a9649e53`)
  - `POST https://demo.yolo-dev.ai/api/session` with `Origin: https://demo.yolo-dev.ai` → `503 Backend configuration unavailable` (truthful static demo mode)
  - `POST https://demo.yolo-dev.ai/api/session` without matching `Origin` → `403 Forbidden`
  - Direct origin `GET https://yolo-demo-app.normzhou.workers.dev/__yolo/version` (unsigned) → `403 Forbidden`
- **Live headless Chrome verification (`Playwright` against `https://demo.yolo-dev.ai/`):**
  - Home slide deck renders with header badge `normzhou/yolo-blank-canvas · static preview` and zero error banner.
  - `Play Tetris` opens `https://demo.yolo-dev.ai/?app=tetris` (`Tetris board, 10 by 20` visible).
  - `Puzzle Bobble` opens `https://demo.yolo-dev.ai/?app=puzzle-bobble` (`Player 1 bubble board` visible).
  - `Feedback on Puzzle Bobble` displays the truthful `Static preview mode` notice with the `npx --yes github:normzhou/yolo-blank-canvas` command and direct `GitHub Issues` link.

## Set `APP_VERSION=v0.14.2` on `yolo-demo-app` Worker and instantiate `hosting/yolo-identity` (#199) — 2026-10-22

Source revision `a38b872` (the hosting preparation commit); build and review
evidence `42a72e6`; release commit `db571a4`; published as `v0.14.2` on
2026-10-22. The unit and stubbed e2e results below ran against the source
revision; the 11/11 acceptance below ran against the installed tag users
receive.

- `npm test`: 23 files, 157 tests passed in 732ms (`test/apps.test.ts` guards
  `hosting/cloudflare/wrangler.json` `APP_VERSION` semver and
  `hosting/yolo-identity/wrangler.json` `CLIENT_IDENTITY_ENABLED: "false"`).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `a38b872…`.
- `npm run e2e`: 42 passed in 32.5s against the stubbed GitHub adapter.
- `cd hosting/cloudflare && npm run check` + `preview.mjs`: `wrangler deploy --dry-run`
  (`17 files`, `9.80 KiB`, `APP_VERSION="v0.14.2"`), `GET /__yolo/version`
  (`200`, `{"version":"v0.14.2"}`), `GET /` (`200`), `POST /api/session`
  (`503`), foreign `Origin` (`403`).
- `cd hosting/yolo-identity && npm test`: 2 passed, 0 failed (`workerd`/D1 and
  JavaScript/Python Oracle assertion checks).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.14.2`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.14.2 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `a38b872…`; the tagged package version is
`0.14.2`. The tag points at release commit `db571a4`, after the assets commit
`42a72e6`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-22-v0142.json`](../.yolo/reports/releases-observed-2026-10-22-v0142.json).

## Puzzle Bobble character artwork, tear contrast, crank gear, and home deck preview polish (#204) — 2026-10-22

Source revision `27ff845` (the artwork polish commit); build and review evidence
`90a9d06`; release commit `ff6a45d`; published as `v0.14.1` on 2026-10-22. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- Visual inspection at 4× DPI across all 4 characters (`Dragon`, `Cat`, `Dog`,
  `Bunny`) × (`normal`, `celebrate`, `cry`) and the home slide-deck preview:
  verified high-contrast cyan teardrops (`--tetromino-i` with dark outline and
  white specular glint) against all 8 player palettes (`2P Dog` warm amber and
  `1P Bunny` pastel lilac), unoccluded crying tears and foreground raised
  victory paws, ear-aware 4-point top sparkle, Bunny nose/whiskers, outlined Cat
  tail, spoked hand-crank wheel, and miniature Bub & Mochi mascots on the home
  slide-deck preview.
- `npm test`: 23 files, 156 tests passed in 697ms.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `27ff845…`.
- `npm run e2e`: 42 passed in 32.7s against the stubbed GitHub adapter.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.14.1`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.14.1 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `27ff845…`; the tagged package version is
`0.14.1`. The tag points at release commit `ff6a45d`, after the assets commit
`90a9d06`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-22-v0141.json`](../.yolo/reports/releases-observed-2026-10-22-v0141.json).

## Selectable cute characters and win/lose animations in Puzzle Bobble (#204) — 2026-10-22

Source revision `b679005` (the feature commit); build and review evidence
`5ccfe0b`; release commit `6570366`; published as `v0.14.0` on 2026-10-22. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 23 files, 156 tests passed in 723ms (`test/puzzle-bobble.test.ts`
  verifies `CHARACTER_OPTIONS`, `characterDisplayName`, `deriveMascotMood` across
  `normal`, `cheer`, `hurry`, `celebrate`, and `cry`, and `resolveMatchOutcome`;
  `test/theme-tokens.test.ts`, `test/theme-discipline.test.ts`, and
  `test/theme-contrast.test.ts` verify token and reduced-motion discipline across
  `.pb-char-bar` and `.pb-mascot-*`).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `b679005…`.
- `npm run e2e`: 42 passed in 33.0s against the stubbed GitHub adapter.
  `e2e/puzzle-bobble.spec.ts` verifies independent per-player character
  selection (`Dragon`, `Cat`, `Dog`, `Bunny`), round-win celebration
  (`data-mood="celebrate"` + `.pb-mascot-sparkle`) and round-loss crying
  (`data-mood="cry"` + `.pb-mascot-tear`), and `0px` layout shift across
  `.pb-player-card` and `.pb-side`.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.14.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.14.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `b679005…`; the tagged package version is
`0.14.0`. The tag points at release commit `6570366`, after the assets commit
`5ccfe0b`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-22-v0140.json`](../.yolo/reports/releases-observed-2026-10-22-v0140.json).

## Prune redundant tests and separate visual review captures from default E2E (#201) — 2026-10-22

Source revision `8117958` (the feature commit); build and review evidence
`4fbe2d1`; release commit `8b3f76e`; published as `v0.13.1` on 2026-10-22. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 23 files, 155 tests passed in 636ms (consolidated from 25 files /
  294 tests by removing duplicate `test/contrast.test.ts` and
  `test/type-scale.test.ts` after folding their unique assertions into
  `test/theme-tokens.test.ts` and `test/theme-discipline.test.ts`, and
  collapsing table-expanded `it.each` micro-blocks in `test/theme-contrast.test.ts`,
  `test/theme-discipline.test.ts`, `test/route.test.ts`, and `test/status.test.ts`
  without dropping any checked case).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `8117958…`.
- `npm run e2e`: 42 passed in 28.9s against the stubbed GitHub adapter (down from
  96 tests / ~90s by removing 7 redundant single-issue E2E files whose CSS/layout
  assertions now live in `test/theme-tokens.test.ts`, `e2e/crossfade.spec.ts`, and
  `e2e/list-treatment.spec.ts`, and keeping `visual`, `motion`, `measure`, and
  `determinism` on explicit `npm run e2e:visual` and `npm run e2e:measure` scripts
  so `npm run e2e` never dirties `e2e/review/**`).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.13.1`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.13.1 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `8117958…`; the tagged package version is
`0.13.1`. The tag points at release commit `8b3f76e`, after the assets commit
`4fbe2d1`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-22-v0131.json`](../.yolo/reports/releases-observed-2026-10-22-v0131.json).

## Stacked slide-deck preview cards, keyboard navigation, ambient effects (#198) and static `demo.yolo-dev.ai` Cloudflare Worker scaffold (#199) — 2026-10-21

Source revision `a5a6942` (the feature commit); build and review evidence
`629e005`; release commit `a70c68f`; published as `v0.13.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 25 files, 294 tests passed. `test/theme-tokens.test.ts`,
  `test/theme-discipline.test.ts`, `test/theme-contrast.test.ts`,
  `test/contrast.test.ts`, and `test/type-scale.test.ts` pass across `.deck-stack`,
  `.deck-stack-card`, `.deck-slide-card.is-sliding-next/.is-sliding-prev`, and
  `.canvas-ambient`.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `a5a6942…`.
- `cd hosting/cloudflare && npm run check`: `node --check worker.mjs && node --check transport.mjs && node --check preview.mjs && wrangler deploy --dry-run --outdir .wrangler/dry-run`
  passes (`Read 17 files from the assets directory .../dist/client`, `Total Upload: 9.80 KiB / gzip: 3.19 KiB`);
  `hosting/cloudflare/preview.mjs` (`startPreview`) serves `GET /` (`200`),
  `GET /__yolo/version` (`200`), and `POST /api/session` (`503 Backend configuration unavailable`).
- Live official Cloudflare documentation checked (`2026-10-22T06:55:00Z` via
  `hosting/cloudflare/PROVIDERS.json`):
  - `https://developers.cloudflare.com/workers/static-assets/binding/` (updated Oct 12, 2026): verified `assets.directory`, `binding: "ASSETS"`, `run_worker_first: true`, and `not_found_handling: "single-page-application"`.
  - `https://developers.cloudflare.com/workers/platform/pricing/` & `https://developers.cloudflare.com/workers/platform/limits/` (updated Oct 12, 2026): Workers Free allows 100,000 requests/day, 10 ms CPU/request, 64 MiB uncompressed Worker size, and 20,000 Static Asset files per Worker version up to 25 MiB each (`dist/client` has 17 files, 9.80 KiB Worker upload).
  - `https://developers.cloudflare.com/workers/configuration/secrets/` (updated Oct 15, 2026): verified per-Worker encrypted secret bindings (`wrangler secret put` / `wrangler versions secret put`) and `.dev.vars` / `.env` gitignore discipline.
- `npm run e2e`: 95 passed, 1 skipped against the stubbed GitHub adapter (96
  run). `e2e/canvas-gallery.spec.ts` (9) verifies stacked preview cards
  (`deck-preview-card-next`, `deck-preview-card-prev`), directional slide
  animations (`is-sliding-next`, `is-sliding-prev`), keyboard navigation
  (`ArrowRight`, `ArrowLeft`, `Enter`), ambient visual effects (`canvas-ambient`),
  and `static_demo` mode (`503 Backend configuration unavailable` → clean game
  stage with `normzhou/yolo-blank-canvas · static preview` and truthful GitHub
  Issues / `npx` notice on opening Requests/Feedback).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.13.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.13.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `a5a6942…`; the tagged package version is
`0.13.0`. The tag points at release commit `a70c68f`, after the assets commit
`629e005`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-21-v0130.json`](../.yolo/reports/releases-observed-2026-10-21-v0130.json).

## Modern webapp UI redesign (#196) and 2-player Puzzle Bobble layout lock (#195) — 2026-10-21

Source revision `d95d08d` (the feature commit); build and review evidence
`ea34475`; release commit `5bc37e3`; published as `v0.12.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 25 files, 294 tests passed. `test/theme-tokens.test.ts`,
  `test/theme-discipline.test.ts`, `test/theme-contrast.test.ts`,
  `test/contrast.test.ts`, and `test/type-scale.test.ts` verify token and
  contrast discipline across the redesigned single-bar navigation header,
  two-column hero showcase card, relocated `.panel-footer` theme switcher, and
  locked Puzzle Bobble 2-player geometry.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `d95d08d…`.
- `npm run e2e`: 93 passed, 1 skipped against the stubbed GitHub adapter (94
  run). `e2e/theme.spec.ts` (3) verifies theme switching inside `.panel-footer`
  and zero horizontal overflow at `390×844`; `e2e/puzzle-bobble.spec.ts` (2)
  verifies `0px` change in `.pb-player-card` and `.pb-side` geometry (`left`,
  `width`, `height`) across aiming, incoming attack bubbles, and shot
  resolution; `e2e/visual.spec.ts` (24) captures desktop and narrow review
  evidence across all surfaces including `16-puzzle-bobble-2p`.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.12.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.12.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `d95d08d…`; the tagged package version is
`0.12.0`. The tag points at release commit `5bc37e3`, after the assets commit
`ea34475`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-21-v0120.json`](../.yolo/reports/releases-observed-2026-10-21-v0120.json).

## Adopt YOLO Dev v0.1.0-alpha.33 request templates (#174) and game slide-deck layout (#187) — 2026-10-21

Source revision `b547f4e` (`#174` template adoption, following `#187` slide-deck
source `886a97c`); build and review evidence `52f001d`; release commit
`d678e48`; published as `v0.11.0` on 2026-10-21. The unit and stubbed e2e
results below ran against the source revision; the 11/11 acceptance below ran
against the installed tag users receive.

- `npm test`: 25 files, 294 tests passed. `test/request-templates.test.ts` (8)
  verifies mapping `feedback` → `yolo.feedback@1.0.0`, `change` →
  `yolo.feature@1.0.0`, and `problem` → `yolo.bug@1.0.0`, schema-valid JSON
  payload generation (`toYoloRequestPayload`), marker parsing across
  `yolo.*@1.0.0`, legacy `blankcanvas.*@1`, native GitHub Issue Form headings,
  and JSON payloads (`parseRequestTemplate`), plain-text issue preservation,
  and the four installed `.github/ISSUE_TEMPLATE/yolo.*.yml` files.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `b547f4e…`.
- `npm run e2e`: 91 passed, 1 skipped against the stubbed GitHub adapter (92
  run). `e2e/app-feedback.spec.ts` (4) verifies the `yolo.*@1.0.0` markers,
  and `e2e/canvas-gallery.spec.ts` (7) verifies the game slide deck (`#187`).
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.11.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.11.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `b547f4e…`; the tagged package version is
`0.11.0`. The tag points at release commit `d678e48`, after the assets commit
`52f001d`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-21-v0110.json`](../.yolo/reports/releases-observed-2026-10-21-v0110.json).

## Game slide deck and unobtrusive feedback dock (#187) — 2026-10-21

Source revision `886a97c` (the feature commit); build and review evidence
`23784af`.

- `npm test`: 25 files, 291 tests passed.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `886a97c…`.
- `npm run e2e`: 91 passed, 1 skipped against the stubbed GitHub adapter (92
  run). `e2e/canvas-gallery.spec.ts` (7) adds coverage for flipping between
  slides (`‹ Prev` / `Next ›`) on the home deck, launching `Play Puzzle Bobble`
  directly from the slide card, and flipping directly between active games in
  place.
- `yolo-check . --structure` (`0.1.0-alpha.33`): `structure.status: pass`,
  13/13 findings compliant.

## Puzzle Bobble tremor & rising incoming bubbles (#186) and Tetris arcade blocks (#185) — 2026-10-21

Source revision `3bfb9f6` (the feature commit); build and review evidence
`88a42bc`; release commit `c26708d`; published as `v0.10.1` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 25 files, 291 tests passed. `test/puzzle-bobble.test.ts` (10)
  verifies immediate 2P `incomingQueue` transfer on 4+ pops and hanging drops
  and bottom-up placement (`lastEvent.risenGarbage`); `test/tetris.test.ts`
  (20) adds `ghostPiece` landing-row verification; `test/theme-discipline.test.ts`
  and `test/theme-tokens.test.ts` pass.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `3bfb9f6…`.
- `npm run e2e`: 90 passed, 1 skipped against the stubbed GitHub adapter (91
  run). `e2e/puzzle-bobble.spec.ts` (2) verifies the on-board incoming attack
  indicator (`p2-incoming-indicator`, `.pb-incoming-preview-bubble`) and the
  bottom-up rising bubble animation (`.pb-rise-bubble`) when a player resolves
  a non-clearing shot.
- `yolo-check . --structure` (`0.1.0-alpha.30`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.10.1`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.10.1 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `3bfb9f6…`; the tagged package version is
`0.10.1`. The tag points at release commit `c26708d`, after the assets commit
`88a42bc`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The report is
[`.yolo/reports/releases-observed-2026-10-21-v0101.json`](../.yolo/reports/releases-observed-2026-10-21-v0101.json).

## Arcade Puzzle Bobble mechanics, smooth 60fps aiming, and Neo-Geo visuals (#183) — 2026-10-21

Source revision `d007455` (the feature commit); build and review evidence
`5076e5e`; release commit `0da7fcb`; published as `v0.10.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 25 files, 290 tests passed. `test/puzzle-bobble.test.ts` (10)
  covers `0.5°` micro-tap aiming (`AIM_STEP_DEG = 0.5`), smooth hold velocity
  ramp (`aimVelocityDegPerSec`: `38°/s` → `115°/s`), Neo-Geo exponential
  dropped-bubble scoring (`20 * 2^(n - 1)` capped at `1,310,720` for 17+),
  stage clear speed bonus (`50,000` at `≤ 5s`), 2-player attack stack
  (`popped - 3` on 4+ pops) unleashed with dropped bubbles onto the opponent,
  red (5) / yellow (1) warning orb decomposition, color-scaled ceiling drop
  intervals (`shotsPerCeilingDrop`), 10-second shot timer with 5-second
  `HURRY UP!` countdown and auto-fire (`tickShotTimers`), and classic Taito
  stage formations (`createStageGrid`).
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `d007455…`.
- `npm run e2e`: 90 passed, 1 skipped against the stubbed GitHub adapter (91
  run). `e2e/puzzle-bobble.spec.ts` (2) verifies `0.5°` fine tap increments
  (`+0.5°`, `+1°`, `-0.5°`), firing, `1 Player` / `2 Players` switching,
  contextual `Feedback`, and `Escape`.
- `yolo-check . --structure` (`0.1.0-alpha.30`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.10.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.10.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `d007455…`; the tagged package version is
`0.10.0`. The tag points at release commit `0da7fcb`, after the assets commit
`5076e5e`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The ten earlier checks plus the 2-player Puzzle Bobble
check (`D` → `+0.5°`, `ArrowLeft` → `-0.5°`, `Escape` return to the canvas). The
report is
[`.yolo/reports/releases-observed-2026-10-21-puzzle-bobble-arcade.json`](../.yolo/reports/releases-observed-2026-10-21-puzzle-bobble-arcade.json).

## 2-player Puzzle Bobble / Bust-A-Move (#181) — 2026-10-21

Source revision `a398c93` (the feature commit); build and review evidence
`6d1fb79`; release commit `ae503ca`; published as `v0.9.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 11/11
acceptance below ran against the installed tag users receive.

- `npm test`: 25 files, 288 tests passed. Added `test/puzzle-bobble.test.ts` (8)
  for 8/7 staggered hexagonal grid geometry and neighbors, fair 2-player board
  and bubble-queue seeding, aiming clamping and wall-bounce guide rays, side-wall
  bounce and hex-cell snap, 3+ same-colour match popping and unanchored
  avalanche drops, 2-player versus attack garbage transfer and application,
  ceiling drop every 8 shots, and round win/KO detection; updated
  `test/apps.test.ts` (3) for `puzzle-bobble` in `CANVAS_APPS`.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `a398c93…`.
- `npm run e2e`: 90 passed, 1 skipped against the stubbed GitHub adapter (91
  run). New `e2e/puzzle-bobble.spec.ts` (2) covers opening 2-player Puzzle
  Bobble from the home canvas gallery (`?app=puzzle-bobble`), independent
  Player 1 (`ASDF`: `D` aim, `F` shoot) and Player 2 (`Arrows`: `ArrowLeft`
  aim, `ArrowUp` shoot) aiming and firing, `1 Player` / `2 Players` mode
  switching, contextual `Feedback` (`App: Puzzle Bobble (?app=puzzle-bobble)`)
  and key isolation while typing in the composer, and `Escape` return to the
  canvas. `e2e/verify-release.spec.ts` gains an eleventh read-only installed
  check for 2-player Puzzle Bobble.
- `yolo-check . --structure` (`0.1.0-alpha.30`): `structure.status: pass`,
  13/13 findings compliant.

### Installed artifact (`v0.9.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.9.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `a398c93…`; the tagged package version is
`0.9.0`. The tag points at release commit `ae503ca`, after the assets commit
`6d1fb79`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**11 passed, 0 failed**. The ten earlier checks plus the new 2-player Puzzle
Bobble check: clicking **Puzzle Bobble** in the home canvas gallery opens
`?app=puzzle-bobble`, renders both Player 1 and Player 2 bubble boards,
verifies Player 1 aims with `D` (`+3°`) and Player 2 aims with `ArrowLeft`
(`-3°`), and closes with `Escape` returning to the blank canvas. The report is
[`.yolo/reports/releases-observed-2026-10-21-puzzle-bobble.json`](../.yolo/reports/releases-observed-2026-10-21-puzzle-bobble.json).

## Request triage summaries and in-panel outcome links (#177) — 2026-10-21

Source revision `320f6fa` (the feature commit); build and review evidence
`5bed830`; release commit `332855b`; published as `v0.8.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 10/10
acceptance below ran against the installed tag users receive.

- `npm test`: 24 files, 280 tests passed. Added `test/status.test.ts` (25)
  cases for `isRequestTriageComment`, `findRequestTriageComment`, code-fence
  exclusion, most-recent selection, and `reportedTiming` returning `null` on
  `## YOLO request`; added `test/markdown.test.tsx` (6) cases for
  `parseSameRepoIssueUrl`.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `320f6fa…`.
- `npm run e2e`: 88 passed, 1 skipped against the stubbed GitHub adapter (89
  run). `e2e/summary-hierarchy.spec.ts` (3) adds coverage for `Request triage`
  in `.summary-box` when an issue carries `## YOLO request` and no
  `## YOLO status`, absence of the timing fallback on a triage box, in-panel
  navigation when clicking a same-repo covering-outcome link (`#7`), browser
  Back returning to the source request, and `Reported summary` precedence when
  both `## YOLO request` and `## YOLO status` exist. `e2e/verify-release.spec.ts`
  gains a tenth read-only installed check for `Request triage` and in-panel
  covering-outcome navigation (`#172` → `#175`).
- `yolo-check .` (`0.1.0-alpha.30`): `structure.status: pass`, 13/13 structure
  findings compliant; `issue_summary` findings on `#129` and `#153` are cleared
  after repairing their summary headings to exact `## YOLO status`. The four
  earlier release observation reports were amended to include
  `schema_version: 2` and `releases: [...]`, while `yolo-check`'s `release`
  rule remains `unverified` because `yolo-check` walks `git log --reverse` and
  inspects the initial `schema_version: 1` commit of `2026-10-14.json`.

### Installed artifact (`v0.8.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.8.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `320f6fa…`; the tagged package version is
`0.8.0`. The tag points at release commit `332855b`, after the assets commit
`5bed830`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**10 passed, 0 failed**. The nine earlier checks plus the new request-triage
and covering-outcome navigation check: opening `?panel=172` displays
**Request triage** in `.summary-box` without a delivery-timing fallback line,
and clicking the `#175` link inside the triage summary navigates in-panel to
`?panel=175` where `#175`'s **Reported summary** is displayed. The report is
[`.yolo/reports/releases-observed-2026-10-21-request-triage.json`](../.yolo/reports/releases-observed-2026-10-21-request-triage.json).

## Guided request capture and request-store seam (#175, #172, #173) — 2026-10-21

Source revision `607c2c3` (the feature commit); build and review evidence
`0daeacf`; release commit `eda85f8`; published as `v0.7.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 9/9
acceptance below ran against the installed tag users receive.

- `npm test`: 24 files, 278 tests passed. Added `test/request-store.test.ts` (4)
  for `createGitHubRequestStore` and non-GitHub fake-store substitution in
  `createApp` preserving status/summary derivation; added
  `test/request-templates.test.ts` (5) for the three intents, versioned markers
  (`blankcanvas.feedback@1`, `blankcanvas.change@1`, `blankcanvas.problem@1`),
  `#169` app context preservation, and draft content predicates; expanded
  `test/drafts.test.ts` (8) for v2 round-trip and v1→freeform migration.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `607c2c3…`.
- `npm run e2e`: 87 passed, 1 skipped against the stubbed GitHub adapter (88
  run). `e2e/app-feedback.spec.ts` (4) covers prominent top-level intent
  selection, entry defaults (**Feedback** → Share feedback; **Start a request**
  / **New request** → Build or change), intent switching without losing the
  shared title or primary answer, keyed optional fields, validation focus order,
  editable app context, generated-body preview, **Write freely instead**, and v1
  draft migration. `e2e/verify-release.spec.ts` gains a ninth read-only
  installed check for the guided composer and keeps the eighth check compatible
  with `v0.6.0`.
- `yolo-check . --structure` (`0.1.0-alpha.30`): `structure.status: pass`,
  13/13 findings compliant, clean working tree at `0daeacf` and `18ce6af`.

### Installed artifact (`v0.7.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.7.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `607c2c3…`; the tagged package version is
`0.7.0`. The tag points at release commit `eda85f8`, after the assets commit
`0daeacf`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`:
**9 passed, 0 failed**. The eight earlier checks plus the new guided-composer
check: from **New request**, **Build or change** is preselected; typing a title
and shared primary answer and switching to **Report a problem** preserves both
values and previews `Template: blankcanvas.problem@1`; Escape closes without
submitting. The report is
[`.yolo/reports/releases-observed-2026-10-21-request-capture.json`](../.yolo/reports/releases-observed-2026-10-21-request-capture.json).

Open gaps: richer in-app evidence remains deferred as #170, and upstream YOLO
Dev template adoption remains deferred as #174 until upstream #144 is released
and this repository upgrades its pin. Installed acceptance is nine targeted
read-only checks rather than the full suite and does not submit a live issue.

## Contextual feedback (#169) — 2026-10-21

Source revision `2302878` (the feature commit); build and review evidence
`5fd426d`; release commit `e93d5a5`; published as `v0.6.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 8/8
acceptance below ran against the installed tag users receive.

- `npm test`: 22 files, 267 tests passed. Added `test/feedback.test.ts` (2) for
  the exact context line and body seed; `test/drafts.test.ts` now has 6 tests,
  including app/home/other-app draft isolation.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `2302878…`.
- `npm run e2e`: 87 passed, 1 skipped against the stubbed GitHub client (88
  run). New `e2e/app-feedback.spec.ts` (4) covers the direct Feedback action,
  the prefilled context and appending into it, submission into an ordinary
  issue, focus return, app/home/cold-link draft separation and the Requests
  list path. `e2e/verify-release.spec.ts` gains an eighth, read-only installed
  check for the context line and focus return; it is for release acceptance,
  not the normal suite.
- Defect found by the new test and fixed in the slice: the panel's document
  key handler now stops keydown propagation, so Tetris's window-level arrow and
  hard-drop Space controls cannot consume keys typed into the composer. The
  test's sentence keeps its spaces and the panel remains the top overlay for
  Escape.
- `yolo-check . --structure` (`0.1.0-alpha.30`, executable SHA-256
  `7c04535…` matching the published `SHA256SUMS`; publication `df14572…`):
  `structure.status: pass`, 13/13 findings compliant, clean working tree at
  `5fd426d`.

### Installed artifact (`v0.6.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.6.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `2302878…`; the tagged package version is
`0.6.0`. The tag points at release commit `e93d5a5`, after the assets commit
`5fd426d`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npx playwright test --config playwright.verify.config.ts`:
**8 passed, 0 failed**. The seven earlier checks — reconciliation-badge
contrast, text-field fill, Tetris stats opacity, reduced-motion crossfade,
recorded asset identity, the conditional rendered-badge check and the gallery
shell check — plus the new contextual-feedback check: from `?app=tetris`,
Feedback opens `?app=tetris&panel=new`; the description is exactly
`App: Tetris (?app=tetris)` plus a blank line; Title is focused; Escape closes
without submitting and returns focus to Feedback. The feedback check skips on
releases that predate #169. The report is
[`.yolo/reports/releases-observed-2026-10-21-contextual-feedback.json`](../.yolo/reports/releases-observed-2026-10-21-contextual-feedback.json).

Open gaps: the context is text only by decision — no labels, attachments,
element targeting or per-app content persistence. Richer in-app evidence
remains deferred as #170. Installed acceptance is eight targeted read-only
checks, not the full suite, and the new installed check does not submit a live
issue; submission is covered by the stubbed e2e. The normal e2e run does not
execute `e2e/verify-release.spec.ts`, so the installed check is exercised only
against the delivered artifact. The tag points at release commit `e93d5a5`
after the assets commit `5fd426d`, not at an assets-only commit; both build-ID
files record `2302878`.

## Canvas gallery (#165) — 2026-10-21

Source revision `4cad4b6` (the feature commit); build and review evidence
`c456385`; release commit `f0262ae`; published as `v0.5.0` on 2026-10-21. The
unit and stubbed e2e results below ran against the source revision; the 7/7
acceptance below ran against the installed tag users receive.

- `npm test`: 21 files, 264 tests passed. Added `test/apps.test.ts` (3) for
  registry uniqueness and resolution; `test/route.test.ts` now has 18 tests
  covering `?app=`, `?app=&panel=` composition and malformed app tokens.
- `npx tsc --noEmit`: clean.
- `npm run build`: clean; `dist/client/.build-id` and
  `server/build-id.generated.js` both report `4cad4b6…`.
- `npm run e2e`: 83 passed, 1 skipped against the stubbed GitHub client (84
  run). New `e2e/canvas-gallery.spec.ts` (6) covers the home gallery, cold
  `?app=tetris`, browser history, palette focus and Escape precedence,
  panel/palette exclusion and the typing guard. Tetris navigation in the
  existing suites moved from the removed "Play Tetris" control to the gallery's
  "Tetris" entry; the release-verification suite accepts either label so it can
  still verify older tags.
- `yolo-check . --structure` (`0.1.0-alpha.30`): `structure.status: pass`,
  13/13 findings compliant, clean working tree at `c456385`.

### Installed artifact (`v0.5.0`)

Installed from `npx --yes github:normzhou/yolo-blank-canvas#v0.5.0 --no-open --port 4875`
in an empty directory, with no source checkout. `GET /api/version` reported both
`serverBuild` and `clientBuild` as `4cad4b6…`.

`YOLO_VERIFY_URL=http://127.0.0.1:4875 npm run e2e:verify-release`: **7 passed,
0 failed**. The six existing checks — reconciliation-badge contrast, text-field
fill, Tetris stats opacity, reduced-motion crossfade, recorded asset identity,
and the conditional rendered-badge check — plus the new gallery check: the home
gallery opens `?app=tetris`, the palette names Tetris current, and Escape closes
the palette without unmounting the app. The gallery check skips on releases that
predate #165. The report is
`.yolo/reports/releases-observed-2026-10-21.json`.

Open gaps: contextual feedback capture from inside an app is the next slice;
this change is navigation only. The palette is navigation-only and has no
command surface. The tag points at release commit `f0262ae` after the assets
commit `c456385`, not at an assets-only commit; both build-ID files record
`4cad4b6`. Installed acceptance is seven targeted read-only checks, not the full
e2e suite. The conditional rendered-badge check passed on this repository but
remains conditional by design.

## Deterministic tests (`npm test`)

Run 2026-10-21 at `c62fbd3` (following the `v0.8.0` release `332855b`; assets built from source `320f6fa`):

```
  ✓ test/theme-discipline.test.ts (21 tests)  nine-step neutral ramp, monotonic, chroma-bounded, every theme
  ✓ test/status.test.ts (25 tests)            status, reported-summary and request-triage derivation from fixtures
  ✓ test/tetris.test.ts (20 tests)            Tetris pieces, collision, line clear, scoring, game over, tetris count, ghost piece
  ✓ test/theme.test.ts (10 tests)             theme selection and persistence
  ✓ test/contrast.test.ts (14 tests)          WCAG floor across every pair
  ✓ test/theme-tokens.test.ts (6 tests)       every theme covers every colour role
  ✓ test/list-reconciliation.test.ts (8 tests)  created-issue reconciliation against the list
  ✓ test/route.test.ts (18 tests)             ?app=, ?panel / ?panel=new / ?panel=<n>, composition and fallback
  ✓ test/csp.test.ts (4 tests)                content security policy
  ✓ test/theme-contrast.test.ts (74 tests)    APCA floor, verified against published reference values
  ✓ test/launcher.test.ts (12 tests)          gh missing, first login, cancellation, noninteractive, port fallback
  ✓ test/github-client.test.ts (9 tests)      target validation, argument isolation, PR exclusion, pagination
  ✓ test/drafts.test.ts (8 tests)             v2 draft round-trip, v1->freeform migration, app/home/reply isolation
  ✓ test/app-api.test.ts (14 tests)           session, cross-site, host, identity, write-ambiguity, endpoint scope, CSP media-src
  ✓ test/type-scale.test.ts (2 tests)         no raw font-size, exactly four role tokens
  ✓ test/list-refresh.test.ts (5 tests)       background refresh keeps rows; filter changes clear
  ✓ test/tetris-music.test.ts (4 tests)       bundled track list, shuffle permutation/determinism, bundled files exist
  ✓ test/tetris-backgrounds.test.ts (3 tests)  bundled scenes, four-line cycle helper, bundled files exist
  ✓ test/gh-process.test.ts (4 tests)         real process boundary against a stand-in `gh` executable
  ✓ test/markdown.test.tsx (6 tests)          untrusted Markdown safety and same-repo issue URL recognition
  ✓ test/apps.test.ts (3 tests)               canvas app registry uniqueness and resolution
  ✓ test/feedback.test.ts (2 tests)           app-context line and body seed
  ✓ test/request-store.test.ts (4 tests)      GitHubRequestStore mapping and non-GitHub fake-store substitution
  ✓ test/request-templates.test.ts (8 tests)  yolo.*@1.0.0 templates, JSON payloads, legacy markers, Issue Form files
  ✓ test/puzzle-bobble.test.ts (10 tests)     0.5° aim, exponential drop scoring, 2P attack stack/orbs, hurry timer, stages

  Test Files  25 passed (25)
       Tests  294 passed (294)
```

Also run at the same revision: `npx tsc --noEmit` (clean), `npm run e2e` (90 passed, 1 skipped
against the stubbed adapter, no repository writes), `npm run build` (clean), and
`yolo-check . --structure` — `structure.status: pass`, 13 rules compliant, 0 non-compliant, from
the pinned `v0.1.0-alpha.30` executable.

The previous snapshot in this block was run 2026-10-14 at `9c05e25` (`v0.4.0`, 20 files / 255 tests,
77 stubbed e2e passed + 1 skipped). See the per-issue sections above and below for each release's
counts; earlier counts are preserved in their own sections and this block is the current full pass.
The earlier `9c05e25` update replaced a block that dated itself to `v0.3.1` and 12 files / 104 tests,
as recorded in
[`.yolo/reports/checkpoint-review-2026-10-14.json`](../.yolo/reports/checkpoint-review-2026-10-14.json).

Fixture coverage required by the spec, all in `test/status.test.ts`: untagged open issue → **Request open**; all four managed states; missing state, duplicate states, and state without `yolo:work` → **Status needs reconciliation** with raw labels; closure reasons `not_planned` / `duplicate` / `completed`; **Completed (reported)** vs **Closed**; unknown reason → **Closed — reason unavailable**; leftover state labels on a closed issue; reported-summary detection rules, most-recent-match selection, and `No progress summary yet.` / `Delivery timing not yet estimated.` fallbacks. No fixture asserts scheduling or availability.

Tetris coverage (`test/tetris.test.ts`): 7-bag fairness, piece geometry across rotations, spawn centering, wall/floor/settled-cell collision, line clearing and the classic score table, level/speed scaling, wall stops, soft/hard drop, lock-and-spawn on gravity, game over when the next piece cannot spawn, and the `tetrisCount` that a four-line clear advances but a smaller clear does not. The game state is local to the view; no test writes to GitHub.

Music coverage (`test/tetris-music.test.ts`): equal-tempered pitch mapping, the melody's note shapes and lengths, and sequential timeline planning. The Web Audio playback wrapper is not covered by tests.

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

### Tetris live check (maintainer)

| Step | Result |
| --- | --- |
| Maintainer ran the merged `main` (`3896a2a`) from a checkout and played the game | Confirmed on 2026-10-06 that it plays correctly in a live browser: the board, keyboard controls and game flow all work. Acceptance for [#4](https://github.com/normzhou/yolo-blank-canvas/issues/4) is therefore verified on the delivered revision. |

## One-command install outside the checkout

Run from an empty directory (`/tmp/npx-check`, no source checkout present):

```
$ npx --yes github:normzhou/yolo-blank-canvas#v0.1.0 --no-open --port 4399
yolo-blank-canvas (3b507ee3d8560f3473add648f559dca9e73da408)
  repository: normzhou/yolo-blank-canvas
  signed in as: normzhou (via GitHub CLI)
  http://localhost:4399
  Open http://localhost:4399
  Press Ctrl-C to stop.
```

From that installed copy: `POST /api/session` returned the authenticated identity, `GET /api/issues?state=all` listed the real issues with their labels, and `GET /api/version` reported the release build identity. The command runs in the foreground until stopped; `--no-open` was used here only to keep the check headless, and the browser-open path was not observed (see gaps).

A later release, `v0.1.2`, was verified the same way from an empty directory (`/tmp/npx-check-v012`, no checkout):

```
$ npx --yes github:normzhou/yolo-blank-canvas#v0.1.2 --no-open --port 4401
yolo-blank-canvas (26feaa62ef978a4193fee87343f7a030c2e9fa63)
  repository: normzhou/yolo-blank-canvas
  signed in as: normzhou (via GitHub CLI)
  http://localhost:4401
  Open http://localhost:4401
  Press Ctrl-C to stop.
```

`GET /api/version` reported `26feaa6` for both `serverBuild` and `clientBuild`, and the served bundle contained the Tetris view and the music synth (`AudioContext`, `square`). Audible playback was not verified here (see gaps).

Browser-driven checks (headless Chrome against the running app):

- Canvas renders the prompt and Requests button; the session is established automatically.
- List shows `#3 … Status needs reconciliation` and `#2 … In progress` (live label mapping).
- Detail shows the reported summary, the full discussion, and the reply box; footer shows last refresh and `UI build: <sha>`.
- Escape closes the panel and focus returns to the Requests button.
- A draft typed into **New request** survived closing the panel and reopening it.
- Changing the served client build ID produced the banner **“App version changed — reload to use the version this server is running.”** with user-initiated Reload / Not now.
- No console errors during these runs.

## Just-created request and list reconciliation (issue #5)

Browser-driven against the real app (headless Chrome over CDP from a scratch profile; no new dependencies), with the list endpoint stubbed to drop the new issue for the first two reads to reproduce GitHub's lagging list replica deterministically.

| Step | Result |
| --- | --- |
| Create a request through **New request** | Issue confirmed by the API; detail view opens on it |
| Back to the list, list lagging | New request at the top, marked **Not listed yet**, with the note that the create succeeded and the list is catching up |
| Duplicate rows | None |
| After a later re-read | Row stops being marked and stays present exactly once |
| Bounded retries | List re-read on 5s/10s/… backoff; stops once confirmed or bounded out |
| Console errors | None |

Root cause measured directly: `POST /api/issues` created #12 and the immediate `GET /api/issues?state=open` returned `[5, 4]`, while `GET /api/issues/12` returned the issue at once; the list still lacked it after 20s. A second probe (#13) appeared in 2s, so the lag is intermittent rather than a wrong query. GitHub's list endpoint is served from a lagging replica.

Deterministic coverage of the same contract: `test/list-reconciliation.test.ts` (8 cases). Delivered revision `1f22d77`, assets built from `123c4c5`.

Also observed in the browser during this work, filed as [#22](https://github.com/normzhou/yolo-blank-canvas/issues/22): the list blanks briefly on each background refresh because the list effect clears items before every load.

## List refresh keeps the visible rows (issue #22)

Browser-driven against the real app (headless Chrome over CDP from a scratch profile; `puppeteer-core`
installed outside the checkout, so the project itself adds no dependency). The list endpoint was
intercepted and delayed by 3s so the response was observably in flight while the refresh happened.
The panel was opened, the list was scrolled to a known offset, and the visible rows, empty state and
scroll offset were sampled every 250ms for 5s.

| Step | Candidate `e39b750` (fix) | Baseline `d8875e0` (pre-fix) |
| --- | --- | --- |
| Rows before refresh | 2 | 2 |
| Minimum rows during a manual Refresh | 2 | 2 |
| Minimum rows during a background refresh | 2 | 0 — list blanked |
| Empty state rendered during refresh | no | no |
| Scroll offset before → after background refresh | 40 → 40 | 40 → 0 |
| Console errors | none | none |

The control run against the pre-fix revision fails the same checks, so the browser observation
distinguishes the bug from the fix rather than merely passing.

Delivered and re-verified after merge:

| Step | Result |
| --- | --- |
| Delivered revision | `0c8038f` (squash merge of PR #26); `GET /api/version` on it reports build `e39b750` |
| Acceptance re-run on the delivered revision | Same PASS table above (2 rows kept, scroll 40 → 40, no console errors) |
| Released artifact `npx --yes github:normzhou/yolo-blank-canvas#v0.1.1` | Serves build `e39b750`; the browser check passes against the installed copy |

Deterministic coverage of the same contract: `test/list-refresh.test.ts` (5 cases).

## Cleanup

Integration issues [#1](https://github.com/normzhou/yolo-blank-canvas/issues/1), [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2), and [#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) were closed after the checks; their comments remain as the evidence trail. The deliberate leftover `yolo:state:*` labels on [#2](https://github.com/normzhou/yolo-blank-canvas/issues/2)/[#3](https://github.com/normzhou/yolo-blank-canvas/issues/3) were later removed so the repository itself conforms to the managed-state contract (a closed issue carries no state label), and a status summary was recorded on #3. GitHub CLI credentials were untouched by the app throughout (verified by `gh api user` after the session ended).

## E2E visual checks (issue #71)

Two Playwright runs complement the deterministic vitest layer; both use system Google
Chrome (`channel: 'chrome'`), headless, and capture a full-page screenshot per step into
`e2e/artifacts/` (git-ignored). Representative images are committed under
`e2e/screenshots/`.

- `npm run e2e` — deterministic: `e2e/stub-server.ts` launches the real `createApp` with a
  stubbed GitHub client on a random port (same seam as `test/app-api.test.ts`). Covers the
  canvas empty state, the Requests panel (issue-state variants), refresh, the detail view's
  rendered `## YOLO status` summary, the new-request flow incl. draft persistence, the
  version-changed banner, session/auth-retry surfaces, and Tetris (board render, Music
  toggle, stable track label, scene cycle via a four-line clear). 6 specs passing.
- `npm run e2e:live` — read-only against the real dev app (`server/cli.js --no-open`, random
  port, real `gh` credentials, no GitHub writes): canvas with real identity, real issue list
  and detail, forced mid-session auth loss, and a second run targeting `--repo
  normzhou/yolo-dev`. 4 specs passing, no console errors, no CSP media violations.

The four-line-clear scene cycle is exercised through the `yolo:tetris:four-line-clear`
window event handled by `TetrisView` (a real clear advances `tetrisCount` the same way);
pixel-perfect gameplay scripting is not attempted. Live gaps closed by these runs:
**multi-repository `--repo` access** and **mid-session auth-loss surfaces** (now observed
read-only); **Tetris music/backdrop in a live browser** is additionally covered by the
deterministic browser run (track label stays stable across 3s, scene label advances).

## Unverified / gaps

- **First-login path was not exercised end-to-end**: this machine already had an authenticated `gh`, so the interactive `gh auth login --web` branch is covered by unit tests (spawn arguments, single invocation, cancellation, and the noninteractive print-the-command path) but was not run against a real browser authorization.
- **`gh` missing path** is unit tested with a failing runner; it was not observed on a machine without the CLI.
- ~~**Pagination beyond one page** was verified only with fixtures~~ — **RESOLVED 2026-10-14 (#150), and the old note was a misdiagnosis.** The live repository was never short of issues: it has 63 closed. The list was silently truncating because `hasMore` was computed from the issue count *after* pull requests were filtered out, so a page of 30 objects that was mostly PRs (17 PRs + 13 issues) reported `hasMore: false` and the app rendered *End of list (13 shown)* while page two held 27 more. Separately, a read requested while one was in flight was silently dropped, so switching filters during a slow load changed the button and not the data. Both fixed; `npm run e2e:live` now observes page one and the appended second page against the real repository, and `e2e/list-treatment.spec.ts` holds the mid-flight switch deterministically.
- **Browser-open behaviour** (`open`, `xdg-open`, `start`) was not observed live; the one-command check used `--no-open`. The launcher prints the URL regardless, so opening is a best-effort convenience.
- **Lost authentication during a running session** is unit tested through the API surface (`auth_required` state with the login command and Retry connection) and was forced read-only in the live E2E (`e2e/live.spec.ts`), but was not observed by revoking real credentials mid-session.
- **The Tetris view was not exercised in a live browser.** Its rules and state transitions are covered by `test/tetris.test.ts`, but keyboard handling (arrow/space/Escape), gravity timing and rendering were not observed in a browser session against a running build.
  **Resolved 2026-10-06:** the maintainer played the merged `main` in a live browser and confirmed it works; see the Tetris live check above. Keyboard hard-drop (space), Pause, New game, Close and Escape are additionally driven in the deterministic E2E (`e2e/deterministic.spec.ts`).
- **Tetris music was not observed in a live browser.** As of #63 the audio is bundled CC0 tracks played through a single `HTMLAudioElement`; the playlist shuffle and track list are covered by `test/tetris-music.test.ts`, and the Music toggle + stable track label are exercised in the deterministic E2E. Audible playback was verified on the delivered `v0.3.1` artifact (see issue #67 below).
- **The pixel-art backdrop was not observed in a live browser.** As of #63 the scenes are bundled sourced images; ids/files and the four-line cycle are covered by `test/tetris-backgrounds.test.ts` and the `tetrisCount` cases in `test/tetris.test.ts`, and the scene label + crossfade layers are exercised in the deterministic E2E. Readability over every scene in a live browser remains a human check.

## Fuller tunes and a backdrop crossfade (issue #58)

Source revision committed with the #58 improvements; deterministic tests only. Each tune is now a sectioned arrangement: *Korobeiniki* is A–B–A, *Greensleeves* verse–second–verse, *Ode to Joy* and *Mountain King* add a second phrase, and two more public-domain melodies (*Kalinka*, *Scarborough Fair*) join the playlist. At the player's 2.2 beats/second each tune runs ~20–43s (playlist total ~173s, up from ~94s). The background set grew to six scenes, and the view now crossfades between them (new scene fades in, old fades out) and names the tune now playing. `test/tetris-music.test.ts` (11 cases) checks the second strain, the per-tune minimum length, playlist well-formedness and the shuffle; `test/tetris-backgrounds.test.ts` continues to validate every scene. The copyrighted original-game music and artwork were **declined** — see #58 for the recorded reasoning — so no third-party asset was added. Live browser playback/render of the crossfade remains unverified.

## Pixel-art backdrops (issue #55)

Source revision committed with the backdrop work (see the branch for #55); deterministic tests only. `BACKGROUNDS` ships four scenes (night sky, city, mountain, blocks) generated from in-repo pixel data, and the Tetris view cycles to the next scene when `tetrisCount` rises — i.e. on a four-line clear. `test/tetris-backgrounds.test.ts` (4 cases) checks distinct scene ids, rectangular grids with a complete palette, one resolvable colour per cell, and the wrap-around index; `test/tetris.test.ts` adds the four-line counter cases. Live browser rendering of the backdrops remains unverified — see the gap above.

## Music playlist (issue #54)

Source revision `819724d`, deterministic tests only. `KOROBEINIKI` is now the familiar strain followed by a second strain; `PLAYLIST` adds *Greensleeves*, *Ode to Joy* and *In the Hall of the Mountain King*, and `shuffledMelodies` orders them so the audio wrapper plays one after another without a back-to-back repeat. `test/tetris-music.test.ts` (10 cases) checks pitch mapping, positive note lengths, resolvable pitches, the second strain, playlist well-formedness and the shuffle permutation/determinism. Live browser playback of the playlist remains unverified — see the gap above. The changed assets were built from the same source (`dist/client/.build-id` and `server/build-id.generated.js` report `819724d…`).

## Sourced assets for the Tetris music and backdrops (issue #63)

Dedicated branch `yolo/asset-replacement`; deterministic checks only. The in-repo synth melodies and generated pixel grids were replaced with bundled sourced assets: five CC0 chiptune tracks (SketchyLogic, "NES Shooter Music" pack, converted WAV→AAC `.m4a`) and six CC0 backdrops (LuminousDragonGames night sky, FisherG city, Emcee Flesher desert, Quantiset Mars, Scribe space, biodegradableguy castle GIF). Provenance and licenses: `docs/assets.md`. `src/shared/tetrisMusic.ts` now lists tracks and `shuffledTracks`; `src/client/audio/tetrisMusic.ts` plays them with a single `HTMLAudioElement` (no Web Audio synth). `src/shared/tetrisBackgrounds.ts` lists backdrops; the view `<img>` crossfade replaces the SVG grid. `test/tetris-music.test.ts` (4 cases) and `test/tetris-backgrounds.test.ts` (3 cases) now validate playlist/backdrop well-formedness, shuffle determinism and that the bundled files exist under `public/`. `npm test` (103 passed), `npx tsc --noEmit` and `npm run build` all pass; the build copies `public/tetris/` into `dist/client/tetris/`. Live browser playback of these assets was verified on the delivered `v0.3.1` artifact (see issue #67 below); before that the gap was real — the CSP blocked every audio load (#67).

## Tetris music playback blocked by CSP (issue #67)

Root cause: `server/security.js` set `Content-Security-Policy` to `default-src 'none'` with no
`media-src` directive, so every `tetris/*.m4a` load was blocked. The Tetris player's
`error -> next track` path then spun through the queue — the on-screen "Music: …" label
scrolled many times per second with no audio. Fix (PR #68, released in `v0.3.1`): add
`media-src 'self'` and a regression test asserting the CSP contains it. Verified on the
delivered artifact: `npx --yes github:normzhou/yolo-blank-canvas#v0.3.1 --no-open` served
`GET /api/version` with `serverBuild`/`clientBuild` `7ffb324`; headless Chrome (Play Tetris →
Music on) showed no CSP media violations, the track loaded over HTTP 206, and the one-playing-
track label stayed stable across 6s. This closes the earlier "live browser playback of the new
assets remains unverified" gap from issue #63.

## Backdrop crossfade removes its outgoing layer on its own animationend (issue #88)

Deterministic browser measurement plus a negative control, on the merge of PR #89
(`66802db`; fix commit `eb487d8`). `npm test` 122 passed, `npx tsc --noEmit` clean,
`npm run build` clean, `npm run e2e` 48 passed + 1 skipped (48 passed before this change),
GitHub CI green on the pre-merge tip.

The outgoing layer used to be dropped by a `setTimeout(…, 700)` in `TetrisView.tsx` that
repeated the CSS animation's length in another file. Nothing tied the two together. Layer count
and computed opacity were sampled every animation frame in the running app (`e2e/crossfade.spec.ts`,
committed):

| Case | Outgoing layer's opacity when removed |
| --- | --- |
| Shipped build before the fix, durations in step | **0.00017** at ≈699ms — within one frame of the fade ending, so no visible pop |
| Only CSS changed to 1400ms, before the fix | **0.115** at t≈740ms, incoming scene still at 0.435 — a visible pop |
| Only CSS changed to 1400ms, after the fix | **0** at t≈1476ms |

The first row is the correction to #75 finding 8: the shipped build was not visibly broken, the
coupling was. The second row is the defect: editing one file was enough to produce the pop.

The committed check overrides **only** the CSS duration and asserts the removal follows the fade,
so it fails if the coupling returns. Control run: with `src/client/views/TetrisView.tsx` reverted
to its pre-fix state and nothing else changed, it fails with
`layer removed at opacity 0.115347 (t=739ms) — mid-fade`.

Three checks run under both `no-preference` and `reduce` (5 passed, 1 skipped — the duration
override needs an animated fade to override): removal lands at opacity ≤ 0.05; removal follows
the fade when only CSS changes; layer count returns to 1 across three consecutive scene changes,
so nothing accumulates. Under `reduce` no animation runs, so removal happens on the next animation
frame and a layer on its way out is asserted hidden rather than faded.

**Not fixed here, and now measured.** Under `reduce` the settled backdrop renders at opacity **1**
rather than 0.55 — `animation: none` cancels the fade-in that carries the opacity endpoint, leaving
no rule and falling back to the initial value. Pre-existing on `main` before this work, unrelated
to layer removal, and filed as [#90](https://github.com/normzhou/yolo-blank-canvas/issues/90)
rather than folded in.

## Backdrop rests at one strength and the on-art Tetris text is legible (issue #90)

Deterministic browser measurement with a control run, on the merge of PR #92 (`fdee727`, commit
`23959b8`). `npm test` 122 passed, `npx tsc --noEmit` clean, `npm run build` clean, `npm run e2e`
52 passed + 1 skipped, GitHub CI green on the pre-merge tip.

Two defects, one cause. The backdrop's resting opacity was only ever the endpoint of the fade-in
keyframe, and three text elements sat directly on the artwork. Composited-pixel contrast was sampled
across all six bundled scenes under both motion preferences:

| Element | Worst before | Scenes under the 4.5:1 AA floor |
| --- | --- | --- |
| `.tetris-help` (12px muted) | **1.28:1** | 6 of 6 |
| `.tetris-scene` (12px muted) | **1.28:1** | 6 of 6 |
| `.tetris-title` (15px/600) | **3.96:1** | 3 of 6 |

Settled backdrop opacity:

| Motion preference | Before | After |
| --- | --- | --- |
| `no-preference` | 0.55 | 0.55 |
| `reduce` | **1** | 0.55 |

Under `reduce`, `animation: none` cancelled the fade-in and left no rule applying 0.55, so the layer
fell back to its initial value. The reduce path was showing a materially stronger picture, not the
same picture cut instead of faded.

After the fix: 15.8:1 (title) and 6.11:1 (help, scene), identical on every scene under both
preferences. `.tetris-title`, `.tetris-help` and `.tetris-scene` carry the same opaque `--surface`
background `.tetris-side` already uses, for the reason recorded in the stylesheet — a translucent
fill pulls an arbitrary art pixel toward mid-grey, where mid-grey text has no contrast.

**Control run.** With `src/client/styles.css` reverted and nothing else changed,
`e2e/on-art-text.spec.ts` fails 3 of 4: `Night Sky .tetris-title: must be opaque, otherwise the art
reaches the text`, and `the settled backdrop opacity should be the same under both preferences`.

One existing assertion was corrected rather than preserved: `e2e/crossfade.spec.ts` had required the
outgoing layer to sit at opacity > 0.9 under `reduce`, which was true only because of this bug. It
now requires the resting strength and no mid-fade value.

This is a visible design change — the title and the two bottom lines sit on white plates inside the
card. It matches the stat panel's existing treatment, but it is a direction call, recorded on #90 for
the maintainer to keep or reverse alongside #75's stage-4 variant work.

## The app's own links use the project token (issue #94)

Deterministic browser measurement with a control run, on the merge of PR #95 (`8fe531b`, commit
`a3cf257`). `npm test` 122 passed, `npx tsc --noEmit` clean, `npm run build` clean, `npm run e2e`
53 passed + 1 skipped, GitHub CI green on the pre-merge tip.

`styles.css` had `.comment-body a { color: var(--accent) }` and no rule for the anchors the app
renders itself, so all four of those (`Open in GitHub ↗` and three `source` links) computed to
`rgb(0, 0, 238)` — the browser's UA default blue. Measured on the surfaces they actually sit over:

| Candidate | on `--surface` #ffffff | on `.note` #f7fbff | on `--bg` #f7f8fa |
| --- | --- | --- | --- |
| `#0000ee` (before) | 9.40:1 | 9.04:1 | 8.84:1 |
| `--accent` #1f6feb | 4.63:1 | **4.46:1** | **4.36:1** |
| `--accent-weak-text` #0b3f8f | 9.90:1 | 9.52:1 | 9.31:1 |

`--accent` clears 4.5:1 on white by 0.13 and fails on the summary note, where the Reported summary's
own `source` link sits — so the obvious fix would have traded an unstyled-but-legible link for a
styled-but-illegible one. `--accent-weak-text` already existed in `:root` for this reason and is now
applied to all anchors; Markdown links moved to the same token (4.63:1 → 9.90:1, behaviour
unchanged).

**Control run.** With `src/client/styles.css` reverted, `e2e/link-colour.spec.ts` fails with
`Open in GitHub ↗: inherited a colour the app did not choose (browser default)`. The spec asserts
the computed colour rather than "is it blue", resolves the effective background by walking up
translucent layers instead of assuming white, and requires more than one distinct surface so it
cannot pass by measuring the toolbar link alone.

## Findings 2, 5, 7 and 11 re-verified against the running app

The four findings this audit left unfiled were checked by measurement rather than by reading the
screenshots and the stylesheet. Two were misdescribed; two are direction questions rather than
defects. Recorded in full on [#75](https://github.com/normzhou/yolo-blank-canvas/issues/75):

- **Finding 5** claimed `Disconnect` and `Open in GitHub ↗` were styled identically. Measured,
  `Disconnect` is `--accent` and the anchors were the UA default — the real defect was that the
  app's own links had no styling, filed and fixed as #94.
- **Finding 11** claimed the footer cuts the last list row. Measured, `.panel-body` is the scroller
  and the footer sits below it (`bodyBottom` 868 = `footerTop` 868, no overlap); the row is clipped
  by the scroller at 73%, with no scrollbar at rest. Real friction, wrong element named.
- **Finding 2** confirmed (prompt at y=193 of 844) but every fix is a direction decision for
  stage 4.
- **Finding 7** confirmed from the running app: five steps at two weights — 12/400, 12/600, 13/400,
  16/400, 16/600, 22/400. Stage 4's token work is its deliverable.

## UI review stage 4: the chosen direction (issue #75)

The maintainer delegated the variant choice on 2026-10-08 (*"go, use your best judgement"*), so
the recommended set — canvas/panel **1b**, narrow actions **2a**, hierarchy **3b**, list treatment
**4a** — was implemented as four PRs, each guarded by a committed browser check. `npm test` 122
passed, `npx tsc --noEmit` clean, `npm run build` clean, `npm run e2e` 61 passed + 1 skipped,
GitHub CI green on every merge.

| Question | Chosen | PR | Guard |
| --- | --- | --- | --- |
| Canvas / panel | `1b` panel is a column | #97 | `e2e/panel-push.spec.ts` |
| Narrow action emphasis | `2a` Refresh joins the filters | #98 | `e2e/narrow-toolbar.spec.ts` |
| Chrome vs issue content | `3b` elevate the label, leave Markdown | #99 | `e2e/summary-hierarchy.spec.ts` |
| List treatment | `4a` hairline rows | #100 | `e2e/list-treatment.spec.ts` |

**Tokens.** `:root` now names the type, spacing, radius and elevation steps, and existing
declarations use them; values are unchanged. The near-duplicate type steps are named as measured
rather than silently collapsed — consolidation is filed as #103.

**Two judgements recorded so they can be contested:**

- The panel's scrim stays modal (it still catches the outside click and keeps `aria-modal`
honest); only its tint was removed. The rendered `1b` variant made it non-interactive; keeping it
modal is the smaller change and avoids a half-modal focus trap.
- The hairline rows drop the old 8px card gap along with the card border, so the divider is the
separation. The rendered `4a` variant kept the gap; removing it is what makes the density claim
hold (measured: 12 row titles visible in the 30-row capture, guarded at ≥11).

**Findings filed as their own outcomes**, each with observable acceptance: #101 (narrow empty
canvas), #102 (`Disconnect` treatment), #103 (type-scale consolidation), #104 (list scroll
affordance). Finding 10 (Tetris stat legibility on untested backdrops) is covered by measurement
after the opaque stat panel of #76/#90.

**Regenerated evidence.** `e2e/review/visual/**` and `e2e/review/measurements/**` were regenerated
by the committed commands. `desktop-02-list.png` now shows the whole prompt with the panel open
(before: truncated at *build*), and `desktop-03-list-density-30.png` shows the hairline rows.

## List scroll affordance (issue #104)

The panel's scroller (`.panel-body`) has no scrollbar at rest on macOS, so a clipped row was the only
cue that more requests existed below. The fix is the standard background-attachment scroll shadow:
two `local` cover layers over two `scroll` radial-gradient shadows, added to `.panel-body`. No element
was added and nothing overlaps the content.

Measured in the running app with 30 fixture rows after the fix: `scrollHeight` 2027 vs
`clientHeight` 810; `scrollWidth` 559 = `clientWidth` 559, so no horizontal scrollbar; focusing row
25 scrolls the container (`scrollTop` > 0).

Human-reviewed evidence is committed, not pixel-diffed:

- `e2e/review/visual/desktop-03-list-density-30.png` — the soft edge at the bottom while rows remain below.
- `e2e/review/visual/desktop-04b-list-density-34-end.png` — the edge is gone at the end of the list.

Guard: `e2e/scroll-affordance.spec.ts` asserts the mechanism (`background-attachment: local, local,
scroll, scroll`; exactly two radial gradients), that content overflows at rest, that no horizontal
scrollbar was introduced, and that keyboard focus still reaches the end. `npm test` 122 passed,
`npx tsc --noEmit` clean, `npm run build` clean, `npm run e2e` 63 passed + 1 skipped.

## UI review follow-ups: narrow empty state, Disconnect, type scale (#101, #102, #103)

Three routine presentation fixes from the UI review. The review's own process had reserved the opened
taste questions to the maintainer, but `.yolo/governance/AUTHORITY.md` delegates routine design to the
agent, so these were taken under the standing grant rather than left waiting.

- **#101 narrow empty canvas.** At 390×844 the empty canvas was a title, an identity line, a prompt,
  then ~600px of grey with nothing to do. The prompt now sits higher and a one-line hint names the
  existing Requests action, shown on narrow only. Option (b) — making Requests the default narrow
  home — was not taken; it changes the app's default surface and is a product-direction call.
  Guard: `e2e/narrow-empty-state.spec.ts`.
- **#102 Disconnect.** It used `button.link`, so the session-ending control read as navigation like
  `Open in GitHub ↗`. It is now an ordinary secondary button; the app's anchors keep the
  `--accent-weak-text` link token. Guard: `e2e/disconnect-affordance.spec.ts`.
- **#103 type scale.** The nine measured steps (11–22px, three adjacent sizes 1px apart) collapse to
  four role tokens: `--text-xs` 12px, `--text-base` 14px, `--text-lg` 16px, and `--text-display`
  `clamp(18px, 5vw, 22px)` for the prompt and the Tetris stat value. Guard: `test/type-scale.test.ts`
  (no raw `font-size` values; exactly four tokens). `npm run e2e:measure` now reports the list view's
  steps as 12 / 16 / 22.

`npm test` 124 passed, `npx tsc --noEmit` clean, `npm run build` clean, `npm run e2e` 66 passed +
1 skipped at the #103 revision.

## Tested revision

Release tag `v0.14.2` points at release commit `db571a4`. Assets were built from source
`a38b872` (`dist/client/.build-id` and `server/build-id.generated.js` both report `a38b872…`)
and committed in `42a72e6`; the release commit itself adds only the `0.14.2` version and install
references, with no source changes. The native version at the tagged revision (`package.json`) is
`0.14.2`. The published artifact was installed from the release into an empty directory and accepted
11 of 11 on `e2e:verify-release`, as recorded in
[`.yolo/reports/releases-observed-2026-10-22-v0142.json`](../.yolo/reports/releases-observed-2026-10-22-v0142.json).
Its limits travel with it: eleven targeted read-only checks rather than the full suite; the composer
and feedback checks do not submit a live issue; and the tag points at the release commit after the
assets commit rather than at it.

The previous revisions named or recorded above were `v0.14.1` (`ff6a45d`, assets from `27ff845`,
[`.yolo/reports/releases-observed-2026-10-22-v0141.json`](../.yolo/reports/releases-observed-2026-10-22-v0141.json)),
`v0.14.0` (`6570366`, assets from `b679005`,
[`.yolo/reports/releases-observed-2026-10-22-v0140.json`](../.yolo/reports/releases-observed-2026-10-22-v0140.json)),
`v0.13.1` (`8b3f76e`, assets from `8117958`,
[`.yolo/reports/releases-observed-2026-10-22-v0131.json`](../.yolo/reports/releases-observed-2026-10-22-v0131.json)),
`v0.13.0` (`a70c68f`, assets from `a5a6942`,
[`.yolo/reports/releases-observed-2026-10-21-v0130.json`](../.yolo/reports/releases-observed-2026-10-21-v0130.json)),
`v0.12.0` (`5bc37e3`, assets from `d95d08d`,
[`.yolo/reports/releases-observed-2026-10-21-v0120.json`](../.yolo/reports/releases-observed-2026-10-21-v0120.json)),
and `v0.11.0` (`d678e48`, assets from `b547f4e`,
[`.yolo/reports/releases-observed-2026-10-21-v0110.json`](../.yolo/reports/releases-observed-2026-10-21-v0110.json)),
each accepted 11 of 11 on its installed artifact. They remain valid history, not the current tested revision.

The previous revision named in this section was `v0.10.1` (release `c26708d`, assets from
`3bfb9f6`), accepted 11 of 11 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-v0101.json`](../.yolo/reports/releases-observed-2026-10-21-v0101.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.10.0` (release `0da7fcb`, assets from
`d007455`), accepted 11 of 11 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-puzzle-bobble-arcade.json`](../.yolo/reports/releases-observed-2026-10-21-puzzle-bobble-arcade.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.9.0` (release `ae503ca`, assets from
`a398c93`), accepted 11 of 11 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-puzzle-bobble.json`](../.yolo/reports/releases-observed-2026-10-21-puzzle-bobble.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.8.0` (release `332855b`, assets from
`320f6fa`), accepted 10 of 10 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-request-triage.json`](../.yolo/reports/releases-observed-2026-10-21-request-triage.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.7.0` (release `eda85f8`, assets from
`607c2c3`), accepted 9 of 9 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-request-capture.json`](../.yolo/reports/releases-observed-2026-10-21-request-capture.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.6.0` (release `e93d5a5`, assets from
`2302878`), accepted 8 of 8 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21-contextual-feedback.json`](../.yolo/reports/releases-observed-2026-10-21-contextual-feedback.json).
It remains valid history, not the current tested revision.

The previous revision named in this section was `v0.5.0` (release `f0262ae`, assets from
`4cad4b6`), accepted 7 of 7 on the installed artifact on 2026-10-21 and recorded in
[`.yolo/reports/releases-observed-2026-10-21.json`](../.yolo/reports/releases-observed-2026-10-21.json).
It remains valid history, not the current tested revision.

The revision before that was `v0.4.0` (release `e1105c3`, assets from
`c1daf3e`), accepted 6 of 6 on the installed artifact on 2026-10-15 and recorded in
[`.yolo/reports/releases-observed-2026-10-15.json`](../.yolo/reports/releases-observed-2026-10-15.json).
It remains valid history.

The earlier revision named here was `v0.3.1` (`80bf5f8`, assets from `7ffb324`). That was accurate
when written and is kept here as history rather than replaced silently: later releases landed before
the section was carried forward, so this file once understated the current state while `README.md`
and `.yolo/adoption.json` named `v0.4.0`. The correction is recorded in
[`.yolo/reports/checkpoint-review-2026-10-14.json`](../.yolo/reports/checkpoint-review-2026-10-14.json).

Also verified on the delivered artifact, and recorded at the time: `v0.3.2` (`75cfffb`), published
2026-10-14 after the gap recorded in issue #153. Until then the newest *published* release had been
`v0.3.1`, 76 commits behind `main` and passing only **1 of 6** `e2e:verify-release` checks when
installed and measured — among them a reconciliation badge below WCAG AA and a backdrop crossfade
still animating under `prefers-reduced-motion`. See
[`.yolo/reports/release-gap-2026-10-14.json`](../.yolo/reports/release-gap-2026-10-14.json) for the
measurement and
[`.yolo/reports/releases-observed-2026-10-14.json`](../.yolo/reports/releases-observed-2026-10-14.json)
for the publication and its acceptance.
`v0.3.0` remains tagged and unpublished, superseded by `v0.3.1`; deleting it is reserved to the
maintainer, so it stands.

History: `v0.3.1` (`80bf5f8`, assets from `7ffb324`) fixed the CSP that blocked every audio load
(#67); `v0.3.0` (`dbfdacf`, assets from `350852b`) shipped the sourced CC0 music/backdrops;
`v0.2.0` (`eaf7cc2`, assets from `828b21d`) added the longer tunes, more backdrops and the
crossfade; `v0.1.2` (source `26feaa6`, squash merge `878854e`) added Tetris and the first
chiptune melody; `v0.1.1` (source `e39b750`, squash merge `0c8038f`) kept list rows visible
across a background refresh; `v0.1.0` followed the separate source/assets ordering described
above.