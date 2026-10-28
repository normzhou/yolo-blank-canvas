# Optional feedback inside a client app

For the shared mountable UI and manually initiated harness access, use the
[shared feedback / L1 bridge guide](client-feedback-library.md). This page retains
the compatible standalone requester route and its original recovery behavior.

Use this package when app users should submit bugs, feature requests or general
feedback, follow their own threads and see responses without a GitHub account.
It reuses the three `yolo.bug`, `yolo.feature` and `yolo.feedback` 1.0.0 definitions
and their existing resolution protocols. This is an optional requester interface,
not a maintainer settings/approval UI or an unattended AI runner. The client's
ordinary authorized work sessions still review and service its GitHub requests.

## Try the complete package locally

Use the verified installed skill's actual path. Copy to a **new** directory; do
not overwrite existing app, database, identity, deployment or pin configuration.
Node24+ runs the dependency-free local tests and synthetic browser preview:

```sh
test ! -e hosting/yolo-feedback
cp -R .agents/skills/yolo/assets/feedback hosting/yolo-feedback
cd hosting/yolo-feedback
npm test
node fixture.mjs
```

Open the printed loopback `/feedback` URL. The fixture uses an in-memory SQLite
adapter, synthetic verified principal and fake GitHub API. It is test-only: never
import/deploy `fixture.mjs` or use its identity in production. No provider login,
GitHub token or cloud mutation is needed. These checks are not live D1/GitHub,
Google login, free-account qualification or automatic client installation.

## One client-owned integration handoff

Gather the existing verified-identity adapter, app permission rule, app database,
fixed client repository, approved responder logins and app-owned Issues writer
before enabling the UI. Preserve the existing machine-origin guard. Clients that
already use [shared identity](client-identity.md) need no new Google setup or
operator/DNS request for this compatible app update. A public-static app choosing
to add identity first uses its existing canonical hostname request; this package
cannot activate an issuer registration or change that earlier launch outcome.

Use the existing client-owned `APP_DB` binding. Review backup/capacity and apply
`schema.sql` as an **additive client migration**, using the client's established
reviewed IaC/deploy workflow. It creates only `yolo_feedback_*` tables/indexes and
does not replace app/session tables. Keep ownership/intents through releases and
restores; an old database snapshot can forget a posted write. Do not replay a
request after restoring old state without read-only GitHub reconciliation.

Set `FEEDBACK_GITHUB_TOKEN` as a server-only client runtime secret, scoped to the
single chosen repository with Issues read/write and required repository metadata
access. Use the client's existing fine-grained-token or GitHub App custody and
rotation process; do not introduce an operator token or require a particular
vault. A GitHub App installation token needs refresh through the client's
existing supported process; a fixed short-lived token is not a permanent setup.
Keep secrets out of builds, browser assets, logs, source, fixtures and issues.
Review current [GitHub token permissions](https://docs.github.com/en/rest/issues/issues#create-an-issue),
[comment permissions](https://docs.github.com/en/rest/issues/comments#create-an-issue-comment),
[search authentication](https://docs.github.com/en/rest/search/search#search-issues-and-pull-requests),
[API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions),
[Cloudflare secret delivery](https://developers.cloudflare.com/workers/configuration/secrets/)
and [D1 statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
at use. Follow the hosting guide's current account-wide free-capacity review;
this package requests no additional hosted service or paid plan.

Mount the production bridge **inside** the app's verified identity handler and
before its ordinary app handler. Adapt these import paths and trusted policy;
never manufacture a principal from browser fields, cookies or incoming headers.

```js
import {createClientApp} from './yolo-identity/worker.mjs';
import {createFeedbackBridge} from './yolo-feedback/server.mjs';
const feedback = createFeedbackBridge({
  repository: 'YOUR_ORG/YOUR_APP', // trusted server configuration, never user input
  responders: ['YOUR_APPROVED_RESPONDER_LOGIN'],
  authorize: principal => appPermissions.canSendFeedback(principal)
});
export default createClientApp(async (request, env, principal, signal) => {
  const response = await feedback.fetch(request, env, {principal, signal});
  return response ?? existingApp(request, env, {principal, signal});
});
```

The permission callback must return exactly `true`. It belongs to the app; YOLO
Dev does not receive the private user list. The bridge keys ownership by verified
`(issuer, subject)` within the fixed repository namespace, not changeable email.
Changing repository configuration does not adopt old mappings or replay their
operations; reconcile/migrate under client authority instead. `PUBLIC_ORIGIN` is the actual public app
origin; preserve it when the gateway invokes the machine origin. Mounting at
`/feedback/api/*` avoids the shared adapter's Oracle `/api/*` forwarding. Preserve
`Referrer-Policy: same-origin` so native login forms have a valid Origin; do not
replace it with `no-referrer`. Keep the existing app transport deadline/signal.

Add an ordinary app link to `/feedback`. Runtime imports only `server.mjs`,
`forms.mjs` and `ui-assets.mjs`; the latter embeds the self-hosted HTML/JS/CSS.
No frontend bundle build or external CDN is required. Logo assets remain a
separate opt-in. Do not copy test-only SQLite/HTTP code into the Worker entrypoint.

## Records, responses and privacy

A submission creates an ordinary issue whose title contains an opaque request
UUID and whose raw JSON body is the existing template/input envelope. Existing
request normalization accepts it. Replies append explicit requester-data JSON.
The browser cannot select repository, arbitrary issue, label or control operation.
User text remains untrusted input even when the repository writer incidentally
has the maintainer's GitHub identity: **that writer does not grant the app user
maintainer authority**. Review its source/authority as requester input under the
normal protocol. No labels/admission are silently added by the bridge.

The private database tracks only ownership and write intents. GitHub owns the
workflow. Reads return the person's submitted input/replies plus deliberately
public responses from configured responder logins. Other private issue comments,
raw titles, links, authors and internal notes never reach the requester UI. The
app user can read only locally mapped requests they own. Locked, manual/control
and pull-request records are refused, even when a mapping exists.

After ordinary authorized source/result review, a configured responder can add
an intended public response using this exact comment shape:

```text
<!-- yolo:public-feedback:v1 -->
{"request_id":"THE_REQUEST_UUID","message":"Public interpretation, question, progress or result intended for this requester. Include actual version/availability and limits when delivered."}
```

This is a display projection, **not** the authenticated hosting/request-response
protocol or an execution/approval grant. Keep private evidence in normal records;
include only material intended for the requester. A closed issue alone proves
no delivery. The UI separately shows recorded GitHub state and published text;
it does not parse/verify arbitrary result prose or claim full interface
qualification from these bounded fixtures. A responder update appears on Refresh.

The page preserves drafts and operation IDs in per-account `sessionStorage`;
closing the tab/browser may lose them. Storage-disabled browsers show a warning.
Messages render as text, never Markdown/HTML. An account change refuses stale
writes and requires a reload. App policy must explicitly allow feedback use.

## Pending writes and recovery

Before a POST, a durable row is claimed exactly once. Repeated/concurrent requests
with the same owner/payload/key return its saved state; changed payload is refused.
Unknown transport/provider results remain **awaiting confirmation**. Refresh reads
GitHub and adopts only the exact request title/body/time or exact reply payload;
it never replays the POST. Search can lag or be incomplete. Zero matches do not
prove that no write happened. Confirmed provider rejections remain rejected;
starting a new draft requires a deliberate user action. A lost request before
any local row exists can retry the same saved ID, protected by the same claim.

The initial package bounds lists to100 owned requests and comment reads to200
comments. An unresolved older reply or search mismatch remains pending for the
client operator's read-only investigation, not automatic reissue. Per-principal
app policies limit new requests to10/day and replies to20/day; these are our app
limits, **not** GitHub/Cloudflare quotas. The client should retain intent keys and
include this database in its existing recovery/retention policy. Do not delete or
reset an uncertain row to make it retry, and do not put a second writer behind
the same UI without preserving these idempotency records.

Verify locally, then deploy through the client's existing versioned route using
its own credentials: actual allowed/denied identities, cross-user isolation,
submission/reply/public response, unknown-write handling, private-comment denial
and served version. The publisher does not edit client repositories, upgrade pins
or turn these fixtures into a claim about a running client. Follow the existing
canonical request if operator work is actually needed; ordinary compatible app
code updates require no domain re-onboarding or new handoff.
