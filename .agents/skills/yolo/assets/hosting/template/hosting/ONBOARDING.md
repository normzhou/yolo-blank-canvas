# Launch __APP_SLUG__.yolo-dev.ai

Selected profile: **`__HOSTING_PROFILE__`**. The client owns its app and provider
accounts; YOLO Dev owns the shared domain and operator routing. Both AIs work
under their own owners' grants. Follow this flow before the detailed
[webapp integration](cloudflare/INTEGRATION.md) and backend owner guide.

## 1. Prepare one complete intake

The client AI inspects the app, existing deployment, prior issue/replies and
available private setup before asking questions. Record known facts and explicit
pending items in [the hostname request](HOSTNAME-REQUEST.md):

- App/repository/recognized owner, requested hostname, selected profile and
  installed skill release/full publication. Reuse the existing request ID.
- Public pages, requested sign-in mode and app-owned authorization policy.
  Public static needs no login/D1/Oracle setup. Shared Google login needs the
  client adapter/session store and exact callback; the app keeps its own lists.
- Current frontend source/build/version and guarded client Worker name/endpoint,
  or the specific work still needed. Reuse an already working integration.
- Existing app-scoped transport-key/private recipient handoff reference and
  custody/readiness status. Never put key values or user lists in an issue.
- Backend profile only: immutable image, API/health/readiness, persistent paths,
  resource/accessory peaks, confirmed current account/home-region eligibility,
  verified SSH/connector installation path and recovery evidence. Public-static
  clients do not need to answer backend questions.
- Owner/account separation, observed provider/tool compatibility and remaining
  irreducible signup/MFA/access/visibility decisions, grouped into one owner step.

Follow the live [provider catalog](cloudflare/PROVIDERS.json) and
[setup grant](SETUP-GRANT.md). Prepare the complete scope for the chosen lifecycle
before requesting authority. Existing consent/credentials remain usable within
their scope; do not ask for them again. Give the maintainer one concrete proposal
or existing manual issue containing why, what it blocks, exact action and
observable completion. A missing optional future feature is not a launch blocker.

## 2. Prepare app and operator work together

The client AI builds against the local integration contract, then provisions and
deploys under its own scoped credentials, preserving existing app files. OpenTofu
owns infrastructure; Wrangler owns app versions; Kamal owns backend containers.
When a Worker already exists, instantiate with `--worker` set to its verified name; reconcile/import its existing identity rather than creating a new default name. Edge-only rendering sets `BACKEND_ORIGIN` empty. If existing configuration conflicts with the starter, render into a temporary directory and merge the needed fields under client authority; preserve the app instead of turning a routine merge into an owner handoff.

Builds and app code never receive bootstrap/domain administration credentials.
Report what actually ran, rather than requiring a fixed repeated test campaign.

The operator AI independently verifies requester/ownership/collision, reserves the
name and prepares its complete selected route under denial. It handles its own
provider discovery, permissions, identity registration, gateway, DNS and recovery.
It must not send the client back to perform operator-only work. The operator keeps
private lists out of the central service and never executes client code with its
administration credentials. Shared account ownership is an observed pilot fact,
not a requirement for clients.

Use the same issue for the following bounded exchange:

| Stage | Sender and complete content |
| --- | --- |
| Intake | Client: the complete known/pending request above, with private app-scoped handoff references. |
| Installation bundle, only if needed | Operator: admitted hostname/profile; exact current client configuration and callback status; all selected app-scoped runtime/connector credentials through the agreed private path; ordered client steps and one acceptance checklist. Explicitly mark unresolved operator work. |
| Readiness reply, only if installation changed the client | Client AI: applied bundle, exact deployed source/version/configuration references, key/connector match, health/permissions/transport/recovery results or one precise failure. |
| Final result | Operator: verified usable HTTPS URL, current versions, accepted user evidence, denial/recovery result and closure; or the exact remaining blocker and owner. |

A ready public-static app can go from intake to final result without an
installation round. A backend or new login integration normally needs one
consolidated installation bundle and one readiness reply. These are exchange
budgets for this flow, not counts of all internal checkpoints. Log why any extra
round was unavoidable; do not conceal failures to meet a number. Keep the issue
ID and completed steps when fixing a newly observed problem.

## 3. Prove the smallest usable URL and close

Qualify the chosen route early. Public static can launch independently of Google,
Oracle and another app. Private/shared-login delivery needs the actual registered
client and app-owned allow/deny behavior; retain denial until the selected
controls are ready. A scaffold or healthy Tunnel alone is not a live app.

The operator verifies its actual mapping/runtime/version and anonymous, forged,
direct/alternate-path controls. Accept identified maintainer/client evidence for
real sign-in, authorized content and live application behavior; preserve who
observed what. Do not request the same acceptance again because it arrived in a
client reply rather than a new checklist. Reconcile changed deployments against
their immutable references. An expected401/403 can both establish authentication
denial; a timeout/provider failure cannot establish it.

Finish the already-applied operation's readback, ready checkpoint and verified
private recovery. Do not replay apply or redeploy for bookkeeping. Publish the
terminal response, clear stale waiting summaries and close fulfilled scope.
Retain later optional features/general platform work separately. The client can
then release ordinary app updates without a fresh domain registration round.

Optional final bootstrap revocation is in [SETUP-GRANT.md](SETUP-GRANT.md).
Live client-owned data backup and application correctness stay with that client;
a local fixture walkthrough is not independent-client or provider qualification.
