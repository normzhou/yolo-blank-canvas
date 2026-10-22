# Request: demo.yolo-dev.ai

Submit through the maintainer/explicitly authorized upstream request path in `normzhou/yolo-dev`. Filling this template grants no name or authority. No secrets, account OCIDs, IPs or email allowlists belong in the request.

- App: `demo`
- Repository: `normzhou/yolo-blank-canvas`
- Recognized maintainer / ownership evidence: `normzhou` (repository owner of `normzhou/yolo-blank-canvas`, accepted in issue #6 / `.yolo/adoption.json`)
- Requested hostname: `demo.yolo-dev.ai`
- Requested origin: none (static-only `cloudflare` profile; `BACKEND_ORIGIN` unset)
- Installed skill tag/full publication: `v0.1.0-alpha.33` (`bbb3af70580d012cb9b5032ef7a03fdb74ee256f`, protocol `da644964ca92eef8448cd782cf6805c724ca2e74`)
- Hosting profile: `cloudflare` (static Worker + Static Assets serving `../../dist/client` with `run_worker_first: true` and `not_found_handling: "single-page-application"`)
- Client source/release/artifact identities: `normzhou/yolo-blank-canvas` `v0.13.0` (`hosting/cloudflare/wrangler.json` `yolo-demo-app`)
- Host eligibility/readiness: static-only Cloudflare Worker (`Total Upload: 9.80 KiB / gzip: 3.19 KiB`, 17 static assets in `dist/client`); no OCI VM required
- Primary/accessory cutover resources and persistent data budget: 0 OCI OCPUs / 0 GB VM RAM / 0 GB persistent disk (`cloudflare` static profile only)
- Owner-operated access intent: private exact-email policy setup requested; identities supplied privately by maintainer
- Checks: `cd hosting/cloudflare && npm run check` (`node --check` + `wrangler deploy --dry-run`), `hosting/cloudflare/preview.mjs` local `workerd` preview (`GET /` 200, `GET /__yolo/version` 200, `POST /api/session` 503 `Backend configuration unavailable`), and Playwright E2E `e2e/canvas-gallery.spec.ts` static-preview check

Operator response: verify ownership and collision/reservation; return admission/setup references and private connector-install instructions. The publisher owns Cloudflare DNS/Access/Tunnel changes; the client owns its Cloudflare app account and any VM/runtime/releases. Do not expose the application until protected routing and recovery acceptance pass. Retirement/reassignment requires old-host fencing, credential/session revocation and an explicit disposition of data and namespace.

Client Cloudflare app Worker name/endpoint: `yolo-demo-app` (endpoint supplied privately after client OpenTofu apply)
Client Cloudflare account/usage and local webapp integration reviewed: yes (`PROVIDERS.json` official Cloudflare Workers Static Assets, pricing, limits, and secrets docs verified 2026-10-22 UTC; local `workerd` preview and Playwright E2E verified; no account identifiers in source)
Frontend/backend version, /api protocol and local HTTP/streaming/WebSocket evidence: `v0.13.0` static frontend (`dist/client`); `/api/*` returns `503 Backend configuration unavailable` and activates truthful client `static_demo` mode (`docs/verification.md`)
The application Worker/data/secrets belong to the client account. The operator owns its separate Access/gateway/domain and any Tunnel. No cross-account CNAME or live route is inferred from this request.
