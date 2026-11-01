# Optional feedback tracking foundation

Use only when the configured bridge advertises `tracking: yolo-tracking-v1`
and the relevant capability. This source foundation supplies API/CLI operations;
the personal/shared browser views and live rollout are separate delivery work.
A package/skill update supplies neither a role grant nor runtime activation.

## Enable explicitly

Apply the additive `assets/feedback/schema.sql` through the existing reviewed
migration/backup route, retaining all ownership/intents. For a client-owned bridge,
add `tracking: {appId, authorizeWork: principal => appPermissions.canReadWork(principal)}`
and explicitly extend the intended worker grant with `trackingPublish: true`.
Submission permission remains separately checked. With no profile, current behavior
is unchanged; with no publication grant, old worker credentials cannot publish.

For managed hosting, the operator enables `tracking: true` and the selected
`worker.trackingPublish: true` in the existing registered app. The client's
same-origin `createManagedWorkBridge` must supply its own `authorizeWork` callback;
absent that callback it supplies no shared-work permission. The adapter reconstructs
the assertion after verified identity/app policy; browser headers cannot grant it.
Neither a new Google signup nor new provider account/key is inherent. Use the
existing canonical change request and keep publisher credentials on the service.
New adapters retain the existing managed envelope; older servers retain old caps.

## Publish once during ordinary L1 work

Use the [existing private connection and CLI](client-feedback-library.md#let-the-current-l1-harness-use-the-bridge).
Verify the session's repository, actor, expiry, tracking identity and
`tracking:publish` against the actual grant. This capability appends display
annotations only: ordinary Git/PR/CI still admits work, changes native state,
verifies delivery and publishes releases. It is not a generic GitHub writer.

```sh
node path/to/feedback/cli.mjs work
node path/to/feedback/cli.mjs work-record WORK_UUID
node path/to/feedback/cli.mjs tracking REQUEST_UUID
node path/to/feedback/cli.mjs publish-work --file PRIVATE_SAVED_JSON
node path/to/feedback/cli.mjs publish-tracking --file PRIVATE_SAVED_JSON
node path/to/feedback/cli.mjs publication SAVED_OPERATION_UUID
```

Prepare/save the complete JSON and fresh operation UUID before a POST. Reuse a
stable `workId` UUID for each work outcome. Read its current `publication` for
`base`; use `null` only for the first annotation. An unconfirmed intent blocks
another publication for that record; stale bases return409 rather than overwrite.
No write is automatically retried. Repeating an unchanged saved operation cannot
create another provider comment. A `staged` intent may resume after source/base
checks; `writing` only reconciles by reads. `rejected` requires deliberate review
before choosing a new operation. Bounded/incomplete/ambiguous scans remain uncertain.

Work JSON is `{id, base, workId, issue, view}`. `issue` must be an existing ordinary
`yolo:work` issue in the fixed repository. Its `view` is:

- `audience`: `app` or `hidden`; title (1–120 characters), summary (1–1600),
  next (0–1000), stage (0–80). Deliberately author safe display text; raw issue
  titles, comments, identities and private implementation are never copied.
- `delivery`: `null` (unreleased), `{state: "pending"}`, or
  `{state: "available" | "unavailable", version, verifiedAt, evidence}`.
  Availability requires actual destination/version verification under the current
  protocol. `verifiedAt` is integer epoch milliseconds; evidence stays worker-only.
  Native closure/merge alone never establishes delivery. Record rollback as a new
  `unavailable` annotation retaining the affected version/history.
- `milestones`: at most12 `{at, text}` records; integer epoch milliseconds and
  safe text up to600 characters. Publish material progress, not raw history.

Request JSON is `{id, base, requestId, view}`. It must target confirmed mapped
feedback. Its `view` contains `decision` (`received`, `needs-details`, `tracked`,
`duplicate`, `answered`, `deferred`, `not-planned`), nonempty interpretation/reason
(up to1600 characters each), next (up to1000), and up to12 coverage entries
`{workId, scope, disposition}`. `scope` explains the covered part (up to600);
`disposition` is `tracked`, `declined` or `superseded`. `tracked` requires an
existing app-visible work UUID; other dispositions may use `null`. Several reports
can share work; a report can reference several outcomes. Publish shared progress
once on work, rather than generate a separate update for every reporter.

The server rejects unknown fields, oversized JSON, foreign/reserved/locked sources,
changed operation payloads and source rebinding. Confirmed GitHub comments carry
versioned data bound to the saved intent, app, repository, actor and comment identity;
a marker or forged comment alone is insufficient. The durable operational ledger
indexes those publications and must remain in the existing backup/recovery plan.
Do not edit its payloads/phases to fabricate confirmation or reset uncertain IDs.

## Reads and recovery

Authenticated `GET /yolo/api/v1/tracking/requests/UUID` returns only that owner's
decision/coverage and permitted linked summaries. `GET .../tracking/work` returns
only deliberately app-visible cards, at most24 per page; follow `next` using
`.../tracking/work/page/CURSOR`. No raw GitHub issue IDs/URLs, evidence, other
reporters or hidden work identifiers are returned. App permission is checked on
every request, including cached results. Cards carry `updated`/`checkedAt`; safe
DTO caching lasts at most30 seconds. Unknown native execution labels, reopening
and unavailable sources cannot establish current availability. Readers must display
freshness, `needsReconciliation` and errors honestly; HTTP success is not a new
deployment verification. Opening/refreshing/reading invokes no model and no provider
write. This does not add polling, a runner, a push service or full-history prompt input.

If the bridge breaks, follow the existing [direct-gh emergency route](client-feedback-library.md#emergency-bridge-unavailable).
Inspect saved operation IDs and exact GitHub effects without posting again; restore
or reconcile the ledger before normal writes resume. A manual project note does
not become app-visible tracking automatically. Current provider behavior is owned
by the official [GitHub issue](https://docs.github.com/en/rest/issues/issues)
and [comment](https://docs.github.com/en/rest/issues/comments) references, with
[D1 statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
for the managed adapter; do not freeze provider policy in this bundle.
