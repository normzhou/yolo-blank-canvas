# Managed feedback — client integration

Use for a hosted app choosing the YOLO Dev repository-installed GitHub App. This
is a defined feedback service, not bot credentials for a client harness or a
GitHub API proxy. Google/app permissions and manually initiated L1 remain as in
the [shared library guide](client-feedback-library.md).

## One setup request, then deploy

The authorized client agent gathers its stable app ID/origin, fixed repository
and stable numeric repository/account IDs. The maintainer installs the operator's
identified GitHub App on only that repository. Check the service's actual App
identity/activation first; do not invent an installation URL or assume package
availability means production readiness. Use current authoritative [installation
instructions](https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party)
and [App authentication](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-as-a-github-app-installation).

The client agent generates a strong random32-byte base64url capability in its
existing private credential workflow, stores it as Worker secret
`MANAGED_FEEDBACK_TOKEN`, and supplies **only its SHA256 hash**, desired absolute
epoch-millisecond expiry and nonsecret installation ID through the original
canonical hosting/change request. Include any desired L1 actor/expiry and its
separate bearer hash at the same time. Never post either bearer or a GitHub key.
Follow current [Cloudflare secret delivery](https://developers.cloudflare.com/workers/configuration/secrets/).
No new domain/Google setup is needed for an already compatible shared-login app.

The YOLO operator verifies the approved app/repository/installation/account,
prepares its dedicated ledger/binding/backup and installs the registry entry.
The existing request carries the service origin, approved IDs, effective expiry
and deployed version/readiness result. A hash or installation ID submitted by
an unverified caller is not operator authority. No public companion publication
or push channel is implied. Client agents pick up the skill normally.

## Client Worker: no GitHub token or feedback DB required

Import `createManagedWorkBridge` from `yolo-feedback-bridge/managed-client` (or
`./yolo-feedback/dist/src/managed-client.js` in a copied package):

```js
const feedback = createManagedWorkBridge({
  appId: trustedAppId,
  serviceOrigin: verifiedOperatorServiceOrigin,
  authorize: principal => appPermissions.canSendFeedback(principal)
});
// Inside existing verified identity/transport wrapper, before ordinary app:
const result = await feedback.fetch(request, env, {principal, signal});
return result ?? existingApp(request, env, {principal, signal});
```

Keep `PUBLIC_ORIGIN` as the actual trusted HTTPS app origin. The adapter handles
`/yolo/api/v1/*` and `/yolo/feedback/*`; preserve that same-origin routing outside
Oracle forwarding. It creates its own backend assertion from the verified
principal, ignoring browser-supplied identity/service headers. No arbitrary
repository, issue, GitHub path or Authorization header is forwarded for users.
Mount `mountFeedbackLauncher` or `<FeedbackLauncher>` exactly as in the shared
guide; no renderer fork or extra login popup.

For L1, the client operator keeps its separate expiring work bearer and uses the
same public `/yolo/api/v1` connection and shipped CLI. Both the per-app service
connection and the work capability must validate; a Google session is not worker
access. Setup this optional grant once through the same request. Starting an AI
session remains manual; direct gh recovery stays available within existing grants.

## Verify and recover

Demonstrate actual served app/library/API identity, signed-out/denied/allowed
accounts, other-user isolation, a real request, visible response and app reply.
Keep service outages visible and drafts intact. An uncertain write uses its saved
ID and read-only receipt/reconciliation, never a fresh automatic POST. Installation
revocation, expiry or disabled service must fail without credential fallback.
The operator owns the managed ledger's backup/restore and key rotation; client
owns its app and service bearer. Existing local-ledger clients need an explicit
migration/reconciliation plan before switching; preserve old threads and uncertain
intents. Package/fixture success is not a live deployment result.
