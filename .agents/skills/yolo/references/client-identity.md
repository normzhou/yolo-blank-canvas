# Shared identity: local client integration preview

This preview unblocks **local implementation and tests**, not live login or production migration. YOLO Dev's remaining issuer/database/key activation, compatible gateway/Access migration, provider usage/CPU and recovery acceptance is still open. Keep the deployed gateway/Access/Tunnel/origin guards and your private routes' verified-principal requirement. No central login, registration or deployment helper is implied by these client files. Full #180/#181 handoff and actual hostname acceptance remain separate. Installing/upgrading this skill supplies no account/namespace/deployment authority and changes no target pin automatically.

## Responsibilities and protocol

YOLO Dev owns general Google-backed login at `https://login.yolo-dev.ai`, central sessions, registered app callbacks and independent namespace suspension. Your app owns its Cloudflare Worker/D1, isolated browser sessions, private user list/roles, public/private pages/APIs/streams and optional Oracle backend. Both hosting profiles need the **client's** D1 for login state/app sessions. Do not give YOLO Dev your private user list or run your code/configuration with operator credentials. A shared human or incidentally identical credential value does not merge these roles.

The `yolo-client-identity-v1` adapter verifies the registered-app OIDC code exchange through maintained oauth4webapi, including signature, issuer/audience, PKCE/state/nonce, expiry and one-use browser state. It supplies `null` or `{issuer, subject, email, emailVerified:true}` to app-owned server code. Use `(issuer, subject)` as the identity key; verified email may change. Browser flags, an email matching your list, a Google-shaped button, caller headers and machine-origin credentials cannot establish this principal.

Browser handles are opaque and app-specific host-only Secure/HttpOnly cookies; D1 stores hashes. Local app sessions expire absolutely after one hour without renewal; unfinished login state after five minutes. These are our policy, not provider quotas. Proofs/upstream access tokens are discarded. App logout ends this app session; central/global logout does not automatically terminate independent app sessions. Storage failure returns unavailable, never a fabricated identity.

## Start in a new local directory

Under the client's existing work grant, use the verified complete installed skill. Choose a new directory; preserve existing app files, deployment configuration, private settings and active pins. The package has every runtime dependency and lockfile. Node 24+ and Python 3.9+ run the local example. It needs no Cloudflare login, Google registration, Oracle host, provider token or live issuer.

```sh
test ! -e hosting/yolo-identity
cp -R .agents/skills/yolo/assets/client-identity hosting/yolo-identity
cd hosting/yolo-identity
npm ci --ignore-scripts
npm test
```

Use the target's actual installed skill path if customized. Resolve conflicts explicitly rather than copying over a live Worker. `npm test` keeps dry-build logs inside the package and builds the actual default-disabled module, then runs it in native local workerd/D1 with synthetic identity/keys only: guarded anonymous page, private denial, signed registered-app exchange, app-permission denial, one-use state, isolated cookie/session and local logout, plus JavaScript/Python Oracle assertion checks. If the harness blocks local sockets, use its permitted loopback execution; don't weaken authentication or deploy a public fixture to bypass that restriction. `fixture.mjs` is a test-only synthetic issuer, never part of the production entrypoint. It is not Google login or a service to deploy. Local tests establish no live provider/free-account/market-feed readiness. The package supplies no deploy command or production resource identifiers.

## Integrate app permissions locally

Wrap your app-owned handler using `createClientApp` from `worker.mjs`. The handler receives optional verified identity only after the machine-origin guard. Apply your own deny-by-default policy before data, mutation or stream upgrade; anonymous public content remains your choice. Adapt the supplied `example.mjs` rather than copying its synthetic identity/list into production. Keep your actual assets handler and application routes. Never replace your real app with the example.

```js
import {createClientApp} from './worker.mjs';
export default createClientApp(async (request, env, principal, signal) => {
  // permissions is your server-side policy; keep its data local to your app.
  if (new URL(request.url).pathname.startsWith('/api/private')) {
    if (!principal) return new Response('Sign in required', {status: 401});
    if (!await permissions(principal)) return new Response('Forbidden', {status: 403});
  }
  return app(request, env, {principal, signal});
});
```

`POST /auth/yolo/login` (exact app Origin) starts login; `GET /auth/yolo/callback` completes the one-use exchange; `GET /auth/yolo/session` returns optional minimum identity; `POST /auth/yolo/logout` ends the local app session. The eventual registered callback is exactly `https://<app>.yolo-dev.ai/auth/yolo/callback`, client ID `yolo-<app>`. These describe the protocol, not currently available registration or issuer activation. Don't add a separate Google OAuth flow, email-entry login, permissive header fallback or parent-domain cookie while waiting.

The runtime settings are `PUBLIC_ORIGIN`, `CLIENT_IDENTITY_ENABLED`, client-owned `APP_DB`, and the existing machine-origin `YOLO_GATEWAY_KEYS` policy (legacy single-key form is only a compatibility input). `schema.sql` initializes a **new local** app identity database; do not apply it blindly to an existing production database. The package's Wrangler config defaults to disabled with workers.dev/previews off and no remote database/hostname. Do not flip that production configuration or run a provider operation as part of this development milestone. For local tests the fixture provides synthetic settings and native D1; it does not read private app data.

For Oracle, the client Worker sends a separate client-key `x-yolo-app-identity` assertion alongside retained machine-ingress protection. `backend_identity.py:verify_identity` or `IdentityMiddleware` verifies signature, app, public origin, exact method/path/query, short expiry and minimum principal before your app permissions. `APP_IDENTITY_SECRET` belongs only to your Worker/backend, separate from the origin key. Missing/invalid assertion must deny; a verified anonymous assertion still carries `null` and cannot access private routes. A framework can map `emailVerified` to its own `email_verified` field **after** verification. Never return a principal by reading raw email headers. Keep exact raw path/query when calling the verifier. The ASGI example checks entry only; your existing ingress/outer Worker and app transport must enforce lifetime, cancellation and reconnect. The Worker bounds Oracle assertions to at most thirty seconds and all app transports to the earliest session/transport deadline; don't bypass those bounds with another stream route.

## Request / next live handoff

Continue through your existing hostname request issue and its canonical receiver response, retaining its ID. Report immutable source/test evidence and nonsecret compatibility needs under client authority; don't create a duplicate registration issue or send private lists/credentials. The YOLO Dev operator separately manages app registration and DNS/gateway/Access/Tunnel changes. Its veto can deny a namespace but cannot grant your app membership. This preview neither changes an existing request's fulfillment nor grants a namespace.

Wait for the identified full handoff before any production migration. It must supply actual current issuer/registered-client status, compatible migration/fence/rollback instructions and readiness evidence. Preserve old production authentication and private-route denial until then. Do not infer that a public DNS name, source merge, this package or a successful synthetic test means live login is ready. Compatible skill upgrade and client code changes happen under the client's authority; YOLO Dev does not mutate client repositories.

## Current authoritative references

Before actionable account/setup/deployment guidance, follow these official links **at use**, including from an older skill; record resolved URL/time and applicable account facts. Unknown/moved policy or insufficient aggregate account capacity stops that operation; no paid fallback/upgrade is authorized. Quotas do not multiply per app. The development package itself performs no provider operation.

- [D1 getting started](https://developers.cloudflare.com/d1/get-started/), [local D1](https://developers.cloudflare.com/d1/best-practices/local-development/), [Worker bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/).
- [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
- [Google OIDC](https://developers.google.com/identity/openid-connect/openid-connect), [OIDC Core](https://openid.net/specs/openid-connect-core-1_0.html), [oauth4webapi](https://github.com/panva/oauth4webapi).
- For the existing Oracle stack use the [hosting reference](app-hosting.md) and its linked live OCI catalog; no new account/VM/bootstrap is required to implement this adapter locally.
