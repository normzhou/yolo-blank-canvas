# Request: demo.yolo-dev.ai

Submitted via the authorized upstream request path (`feedback.automatic: true` in `.yolo/adoption.json` and maintainer direction in session on 2026-10-22). Filling this template grants no name or authority. No secrets, account OCIDs, IPs or email allowlists belong in the request.

- App: `demo`
- Repository: `normzhou/yolo-blank-canvas`
- Recognized maintainer / ownership evidence: `normzhou` (repository owner of `normzhou/yolo-blank-canvas`, accepted in [issue #6](https://github.com/normzhou/yolo-blank-canvas/issues/6) and [`.yolo/adoption.json`](https://github.com/normzhou/yolo-blank-canvas/blob/main/.yolo/adoption.json))
- Requested hostname: `demo.yolo-dev.ai`
- Requested origin: none (static-only `cloudflare` profile; no Oracle Cloud host and no backend origin needed)
- Installed skill tag/full publication: `v0.1.0-alpha.33` (`bbb3af70580d012cb9b5032ef7a03fdb74ee256f`, protocol `da644964ca92eef8448cd782cf6805c724ca2e74`, 92-file manifest SHA-256 `eee9026d636001068836af9241a69ca2f24e6569c3185479b0accaf2ca005365`)
- Hosting profile: `cloudflare` (static Worker + Static Assets only — **no Oracle Cloud VM or backend container**; serves `../../dist/client` with `run_worker_first: true` and `not_found_handling: "single-page-application"`)
- Client source/release/artifact identities: `normzhou/yolo-blank-canvas` [`v0.14.2`](https://github.com/normzhou/yolo-blank-canvas/releases/tag/v0.14.2) (`hosting/cloudflare/wrangler.json` Worker `yolo-demo-app` with `APP_VERSION: "v0.14.2"`, plus `hosting/yolo-identity` local shared-identity preview package)
- Host eligibility/readiness: static-only Cloudflare Worker (`Total Upload: 9.80 KiB / gzip: 3.19 KiB`, 17 static assets in `dist/client`); no OCI VM required
- Primary/accessory cutover resources and persistent data budget: 0 OCI OCPUs / 0 GB VM RAM / 0 GB persistent disk (`cloudflare` static profile only)
- Owner-operated access intent: private exact-email policy setup requested (or public/shared-login static demo policy per operator guidance); identities supplied privately by maintainer
- Checks:
  - `cd hosting/cloudflare && npm run check`: `node --check worker.mjs && node --check transport.mjs && node --check preview.mjs && wrangler deploy --dry-run --outdir .wrangler/dry-run` (`17 files` from `dist/client`, `9.80 KiB / gzip: 3.19 KiB`, `APP_VERSION="v0.14.2"`)
  - Local `workerd` preview (`hosting/cloudflare/preview.mjs`): `GET /` (`200`), `GET /__yolo/version` (`200`, `{"version":"v0.14.2"}`), `POST /api/session` (`503 Backend configuration unavailable` -> activates client `static_demo` mode), foreign `Origin` (`403 Forbidden`)
  - `cd hosting/yolo-identity && npm test`: `2 pass, 0 fail` (portable native `workerd`/D1 example and JavaScript/Python Oracle assertion checks)
  - Vitest (`156 passed` across 23 files), TypeScript (`npx tsc --noEmit` clean), Playwright E2E (`42 passed`, including `e2e/canvas-gallery.spec.ts` static-preview E2E), and `yolo-check . --structure` (`13/13 pass`)

Operator response: verify ownership and collision/reservation; return admission/setup references and private gateway key-set (`YOLO_GATEWAY_KEYS`) instructions. The publisher owns Cloudflare DNS/Access/gateway changes; the client owns its Cloudflare app account and `yolo-demo-app` Worker. Do not expose the application until protected routing and recovery acceptance pass. Retirement/reassignment requires credential/session revocation and an explicit disposition of namespace.

Client Cloudflare app Worker name/endpoint: `yolo-demo-app` (dedicated per-Worker Cloudflare API token tracked in [`normzhou/yolo-blank-canvas#203`](https://github.com/normzhou/yolo-blank-canvas/issues/203); Worker endpoint supplied after client OpenTofu apply)
Client Cloudflare account/usage and local webapp integration reviewed: `yes` (`PROVIDERS.json` official Cloudflare Workers Static Assets, pricing, limits, IaC, and API token docs verified 2026-10-22 UTC; local `workerd` preview and Playwright E2E verified; no account identifiers in source)
Frontend/backend version, /api protocol and local HTTP/streaming/WebSocket evidence: `v0.14.2` static frontend (`dist/client`); no backend (`/api/*` returns `503 Backend configuration unavailable` from `worker.mjs` and activates truthful client `static_demo` mode; see [`docs/verification.md`](https://github.com/normzhou/yolo-blank-canvas/blob/main/docs/verification.md))
The application Worker/data/secrets belong to the client account. The operator owns its separate Access/gateway/domain. No cross-account CNAME or live route is inferred from this request.
