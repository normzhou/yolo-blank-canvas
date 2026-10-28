# Authenticated request responses and continuation

Use this optional adapter when the target's adopted contract and accepted configuration select structured GitHub responses or outbound monitoring. Installing a skill does not choose receivers, enable monitoring, grant a write or upgrade a pin. Use the matching verified [native executable](checker.md); targets need Git, existing authorized `gh` access and ordinary file tools, without Python/Go. The [form adapter](request-forms.md) still owns local input/pack validation.

A verified response is an authenticated receiver **report**, not permission, proof of fulfillment or live availability. Keep the original request and readable interpretation/status summary. Disposition, optional business milestone, engineering state and actual delivery remain separate. All actionable requester next steps must be on the request issue; private receiver links cannot be the only instruction.

## Trusted configuration

The target's accepted instructions/design identify the policy and optional outbound index in ordinary project records. Do not discover authority by scanning submitted URLs or a conveniently named file. Keep the accepted policy digest independently in that configuration. A hash computed from a proposed policy is not its acceptance.

The exact `receiver-policy` schema is bundled in `assets/request-schemas/`. It binds `format_version: 1`, the repository name and stable API node ID, stable `receiver_ids`, local `pack_path` and its independently trusted `pack_sha256`, supported action/check IDs and `authority_evidence`. The agent derives GitHub identities through authorized API reads; display names, badges, labels and role strings cannot grant access. Reuse an accepted role/grant, or prepare the concrete missing decision under [maintainer-reserved actions](protocol.md#issue-management-maintainer-reserved-actions). Keep credentials in the existing private mechanism, outside these records.

For example, an accepted policy for general feedback has this shape; replace placeholders only with separately verified target facts:

```json
{
  "format_version": 1,
  "repository": "example/app",
  "repository_node_id": "VERIFIED_REPOSITORY_NODE_ID",
  "receiver_ids": ["ACCEPTED_RECEIVER_NODE_ID"],
  "pack_path": "../.agents/skills/yolo/assets/requests",
  "pack_sha256": "INDEPENDENTLY_TRUSTED_INDEX_SHA256",
  "supported_actions": ["yolo.request.reply", "yolo.request.review"],
  "supported_checks": [],
  "authority_evidence": ["Accepted target grant at its identified revision"]
}
```

A normal `request-binding` file retains the saved issue URL/node ID, original requester node ID, exact template/format, learned canonical comment identity and optional observation. A fresh request begins with `canonical_comment` and `observed` null. Use `format: "json"` for typed input, `"github"` for native form Markdown, or `"plain"` for receiver-interpreted `yolo.feedback@1.0.0`; plain text does not assert that its author selected a form.

```json
{
  "format_version": 1,
  "issue": {"url": "https://github.com/example/app/issues/42", "node_id": "VERIFIED_ISSUE_NODE_ID"},
  "requester_id": "VERIFIED_REQUESTER_NODE_ID",
  "template": {"id": "yolo.feedback", "version": "1.0.0"},
  "format": "json",
  "canonical_comment": null,
  "observed": null
}
```

Retain configured binding/cursor records rather than replacing them with fresh nulls after a conflict. A fresh client with only the saved issue and trusted configuration can authenticate discovery and read the retained transition chain; it cannot prove unseen past immutability or bypass a missing/deleted/conflicting record.

## Read or resume

In these examples the agent supplies canonical file paths and the previously trusted digest; no owner-authored environment script is required:

```sh
"$YOLO_TOOL" requests read --policy /absolute/policy.json --policy-sha256 "$YOLO_POLICY_SHA" --request /absolute/request.json
```

`read` verifies the repository/issue/requester, current body/editor, configured receiver, exact definitions, canonical identity, complete bounded transition history and any saved cursor. It returns the current report, simultaneous `attention` actors, exact unreviewed requester replies, proposed updated binding and a `response_base`. Missing structured records return pending/unstructured intake. Unsupported, ambiguous, stale, edited or deleted/recreated records need reconciliation; they do not authorize actions. Issue closure does not imply fulfillment and does not suppress follow-up reads.

A receiver may reuse its one existing request/status summary when adding v2. Multiple plausible summaries block publication; reconcile them under existing authority. A client must not convert an unverified comment into canonical identity. Store a returned proposed binding only as a separately authorized ordinary work-record update. Read-only check never writes a cursor, admits work or replies.

## Receiver publication

Review the current request and applicable authority, then use `response_base` to assemble the exact v2 response. Preserve exact request/definition/revision bindings. Fill the interpretation, disposition, complete accepted/pending scope, related/required outcomes and actual evidence; do not promote a reported milestone into verified infrastructure effects. Each evaluated requester reply binds its exact comment identity, edit timestamp/body digest and explicit receiver revision (or null for legacy prose). IDs are identities, not numeric ordering counters.

Save the reviewed response JSON and complete readable prose beginning with the one existing `## YOLO request` or `## YOLO status` heading. The agent assembles these files; no manual copy-and-post task is needed when authenticated submission is authorized.

```sh
"$YOLO_TOOL" requests prepare-response --policy /absolute/policy.json --policy-sha256 "$YOLO_POLICY_SHA" --request /absolute/request.json --response /absolute/response.json --prose /absolute/prose.md
```

Preparation is read-only. Retain its returned `plan` object as the exact plan file in private operation storage. Before the next command, review its destination, full body, actor, policy and source snapshot, and confirm actual target write authority. Use an owner-only operation directory outside Git for journals; preserve all existing plans/journals. One acknowledged receiver writer serializes that issue across sessions and machines.

```sh
"$YOLO_TOOL" requests publish --policy /absolute/policy.json --policy-sha256 "$YOLO_POLICY_SHA" --request /absolute/request.json --plan /absolute/plan.json --journal /absolute/private/operation.json
```

The writer rechecks the current accepted policy/pack and API actor before mutations. It appends one dated transition receipt before updating the canonical comment and verifies the saved result independently. Both logical writes have durable local intent; the per-issue local lock sits beside the policy. This is not a distributed lock or a GitHub cross-object transaction. Shared personal credentials retain their human/agent attribution limits. No process/check/action implementation or provider resource executes through this helper.

A material source edit requires a fresh interpretation, not an approved result carried forward. `prepare-response --reconcile-source` permits only an unreviewed/clarifying response with empty accepted/result data and the process's initial milestone. Dated history remains intact.

## Interrupted or changed operation

On an error or killed writer, preserve the plan, journal, policy, binding and actual source/history. Do not create a new operation to bypass uncertainty, remove a lock after an arbitrary delay, replace the canonical ID or edit a fingerprint. Verify the exact old executor has terminated before removing its stale lock. A changed accepted policy/pack stops the operation; do not restore an obsolete grant to make it run.

```sh
"$YOLO_TOOL" requests reconcile --policy /absolute/policy.json --policy-sha256 "$YOLO_POLICY_SHA" --request /absolute/request.json --plan /absolute/plan.json --journal /absolute/private/operation.json
```

Reconciliation is read-only and does not change the journal. An unknown/missing first write stays unknown; never re-post it blindly. Only a uniquely matching receipt with the unchanged canonical base can be completed by the separately reviewed `publish --resume` using that same plan/journal. Complete matching operations return without another write. Conflicting history, foreign editors/actors or revoked policy stop for current-authority reconciliation. A comment receipt establishes no exactly-once business or infrastructure effect.

## Requester replies and ordinary monitoring

A requester can prepare a bounded revision-bound reply from its own message file:

```sh
"$YOLO_TOOL" requests reply-body --revision 2 --message /absolute/message.txt
```

It returns a `yolo:reply:v1` body and submits nothing. After any required in-session consent, the agent uses existing authorized GitHub tools to post the exact body to the saved issue and verifies the actual comment. Legacy prose remains data without an invented revision binding.

For multiple outbound requests, the accepted target configuration may name an ordinary index, for example `requests/outbound.json`:

```json
{"format_version":1,"requests":[{"policy":"policy.json","policy_sha256":"INDEPENDENTLY_ACCEPTED_POLICY_SHA256","request":"issue-42.json"}]}
```

Relative paths resolve against the index directory. Entries select trusted local policies/bindings, not remote executable definitions. Reconcile this configured index at ordinary work/check startup, including closed requests with follow-up:

```sh
"$YOLO_TOOL" requests monitor --index /absolute/requests/outbound.json
```

There is no background polling, push subscription or auto-upgrade. A local binding conflict is a per-request gap. A GitHub transport/rate failure (including HTTP200 GraphQL errors) stops the whole pass, returns bounded retry guidance and counts later requests as unobserved. It never silently checks them or automatically waits/retries. Review the cause and current provider guidance and respect retry/reset lower bounds before another authorized invocation. Work may persist proposed observations in normal records; check reports attention/gaps without mutation.

## Provider references and limits

At use, consult current [GitHub CLI API behavior](https://cli.github.com/manual/gh_api), [issue comments](https://docs.github.com/en/rest/issues/comments), [GraphQL issue/comment fields](https://docs.github.com/en/graphql/reference/issues), [API versions](https://docs.github.com/en/rest/about-the-rest-api/api-versions) and [request/retry guidance](https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api). The helper uses fixed `github.com`, the existing authenticated CLI, bounded serial reads/writes and redacted failure metadata. API failures are not a reason to switch hosts, invent a provider receipt or request broad new credentials.

Exact wire/policy/binding/snapshot schemas are bundled in `assets/request-schemas/`. V2 preserves the old v1 schema without reinterpreting it. Complete history beyond the adapter's bounds, incompatible configuration and unknown action/check implementations remain explicit gaps. Public intake, hosting fulfillment and independently owned-client qualification remain separate work; this adapter supplies none of their authority or live acceptance.
