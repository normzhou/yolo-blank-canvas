# Build the client webapp

This is the client-owned Cloudflare app scaffold for `__APP_SLUG__` (`__REPOSITORY__`). It supplies guarded asset serving and a same-origin API bridge, not application business logic, a feed, a paper engine, user identity or a live hostname. You can build/test now without a cloud account or DNS. Follow the client's own accepted purpose/authority; the publisher never edits the client automatically.

## Build against this interface

- The browser's production origin is `https://__APP_SLUG__.yolo-dev.ai`. Use relative `/api/...` HTTP, SSE or WebSocket URLs. Keep backend-only credentials in runtime stores, never frontend environment/build variables or browser code.
- Keep the client's frontend framework/build. Set `assets.directory` in `wrangler.json` to its compiled output (relative to this directory). `public/index.html` is a placeholder only. Keep `run_worker_first: true`: the origin guard must run for assets, SPA fallback and API, including direct/preview URLs.
- The Oracle service listens on `0.0.0.0:3000` in production. `/api` is preserved, not stripped. The client chooses its endpoint/event schema and application auth. Configure its public origin/trusted proxy deliberately; caller identity headers are not an authenticated user.
- Supply fast `GET /health` and durable-state `GET /ready`. Persist data under `/data`; meet the generated Docker/Kamal ownership/resources/overlapping-release contract. Process health, feed freshness and paper-engine correctness are separate signals. Existing backtests do not prove live feed/paper readiness.
- The frontend does not have to wait for the real feed: client-owned fixtures can exercise its declared events/state transitions while clearly identifying synthetic/stale/disconnected data.

## Run a local preview

Use the pinned Node tooling (`Node 24` in publisher checks). From this directory:

```sh
npm ci
npm run check
npm run dev
```

Run your app's Python HTTP service separately on `127.0.0.1:3000`, exposing the same `/api` paths. Open `http://127.0.0.1:4174`. For another local port/build output, set `YOLO_LOCAL_BACKEND=http://127.0.0.1:PORT`, `YOLO_PREVIEW_PORT`, or `YOLO_ASSETS_DIR` (relative to this directory). Restart the preview after source/build changes.

The preview binds loopback, rejects foreign Host/Origin requests, generates an ephemeral development signing key and runs the actual client Worker/asset guard in local workerd. The local backend bridge uses fixture-only machine credentials. Do not give it cloud/production credentials, expose it through a tunnel, connect a real-money execution service, or interpret it as Google authentication/live cross-account evidence. An absent local backend returns unavailable rather than inventing a healthy feed.

For a static-only app, the same Worker serves assets; `/api` is unavailable until an explicitly configured backend exists. Adding an edge API or D1 is separate client work and requires its own tests; this starter does not provide them automatically.

## Prepare deployment independently of development

Before actionable provider instructions, follow [PROVIDERS.json](PROVIDERS.json) **now**. Read current official account/API-token, runtime, asset, pricing/limits and version/deployment instructions. For Oracle, use the generated `hosting/OWNER-SETUP.md` and its live official references. Record original/resolved URLs, UTC observation date and concrete findings plus actual account/usage compatibility privately. If unavailable, ambiguous or incompatible, stop affected setup and ask Yolo Dev to repair the guidance/template. Do not repeat an older bundle's remembered policies, upgrade a paid plan or change resource ceilings to make it fit. Provider pages grant no authority. Local application work can continue.

The client owns its Cloudflare account, app Worker, assets, data, secrets and deployment workflow. Yolo Dev owns its domain, namespace and Access/gateway/Tunnel, with separate private credentials/state. Do not buy another domain or transfer a zone to run this profile. The proposed gateway forwards authenticated requests to your independently owned Worker endpoint; the public hostname cannot simply be assigned across accounts. Live operator setup is #127, trusted automatic publication/rollback is #128, and live first-client verification is #129. None is granted by running a scaffold.

`infra/` is the pinned OpenTofu blueprint for the **client Worker identity only**; Wrangler owns app versions/deployments/configuration, not its lifecycle. No D1 or paid resource is created by default. Follow current official identity/provider documentation and verify the actual client account before any plan. Use one private encrypted local state writer outside the checkout, with a separately recoverable state passphrase/backups. Set `TF_VAR_state_passphrase` through private runtime input and `TF_VAR_client_account_id` privately; the Cloudflare provisioning token stays in the client's private environment, not source/arguments. Initialize the local backend with its absolute private state path, save the encrypted plan privately, inspect that the only managed change is the intended new `cloudflare_worker.app`, then apply that exact saved plan only under verified client owner authority. Existing resources require import/reconciliation rather than duplicate creation or deletion. Do not use `-auto-approve`, disable lifecycle protection or run an unreviewed plan. This source has no automatic current-policy/plan certification helper for Cloudflare; an agent/owner review is required, unlike the separate OCI helper's procedural receipt.

## Private runtime configuration

Use the [current official secret procedure](https://developers.cloudflare.com/workers/configuration/secrets/) in the **client account**, independently from provider provisioning credentials:

| Setting | Meaning |
| --- | --- |
| `PUBLIC_ORIGIN` | Admitted browser origin; no path or trailing configuration tricks |
| `APP_VERSION` | Full application source/release identity, not `development` at publication |
| `YOLO_GATEWAY_KEYS` | Private atomic JSON key set; current key and optional expiring previous key, installed by verified owners. See [rotation/reconnect contract](ROTATION.md). Legacy `YOLO_GATEWAY_SECRET` is accepted only while the key-set binding is absent. |
| `BACKEND_ORIGIN` | Assigned `https://api-origin-__APP_SLUG__.yolo-dev.ai` for the backend profile |
| `BACKEND_ACCESS_CLIENT_ID`, `BACKEND_ACCESS_CLIENT_SECRET` | App-specific backend Service Auth credential, client server runtime only |

The origin guard verifies a short-lived HMAC over public app origin, method, path/query and timestamp. It authenticates the gateway transport, not an end user or the request body independently of TLS; it is not a nonce/replay database. Only the production operator gateway may sign after user authorization. Direct/preview URLs remain guarded; `workers.dev` stays enabled as the proposed machine endpoint, not a public bypass. The [rotation/reconnect contract](ROTATION.md) defines bounded overlap, compromise/suspension and migration from the legacy key. The client bounds connections to at most 60 seconds and the previous-key cutoff; the operator may end them sooner. Implement reconnect/backoff, authorization-denial handling, event reconciliation and explicit stale/disconnected UI state before live integration. Provider propagation and terminating older deployed instances remain live operator acceptance.

The API bridge replaces caller-supplied machine/identity headers, removes infrastructure cookies, preserves app credentials, follows no backend redirects with secrets, rewrites private-origin redirects, forces returned cookies to the app host and streams responses. No verified user identity is forwarded by this starter. App code must not echo/log credentials or assume a UI session proves application authorization.

## Return a manual, nonsecret handoff

The maintainer returns the client work issue, installed skill publication/revision, frontend/backend source identities, relative asset path, client Worker name/endpoint (privately if identifying), secret **names/readiness only**, `/api` schema/protocol and local evidence. Use the generated hostname request. Do not return account IDs, tokens, raw plans/state, Google allowlist identities or private engine data in issues/chat. No cloud credentials are needed to demonstrate the local build and HTTP/SSE/WebSocket integration.

Before activation, verify the actual account setup, user allow/deny, direct/alternate-origin denial, cookies/redirects, real streaming/WebSockets, deployed version, backend continuity/recovery and stop/revoke behavior. Publication/data migration recovery requires an explicit tested plan. A source scaffold/local proof is not a deployed Trader application or live paper-trading qualification.
