# Versioned request forms

Use this optional adapter for native GitHub intake, typed app/harness submissions or client-owned forms. Plain-text feedback still works. The four general forms bind tailored resolution protocols; hosting fulfillment is a YOLO Dev application definition and is excluded. No GitHub credentials or network are used by these commands.

Use the verified executable matching this selected release ([download and verify](checker.md)). In the commands below, `YOLO_TOOL` is its absolute path. The complete installed skill contains `assets/requests/`. Read the expected digest for `assets/requests/index.json` from the independently verified `references/provenance.json`; set `YOLO_REQUEST_SHA` to that value, not a hash taken from untrusted submitted data. `YOLO_REQUEST_PACK` below points to that installed directory.

```sh
YOLO_REQUEST_PACK=.agents/skills/yolo/assets/requests
"$YOLO_TOOL" requests inspect --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA"
"$YOLO_TOOL" requests render --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA"
```

`inspect` returns exact definition hashes and complete schemas/presentation/protocols for an app to render. `render` returns a JSON `forms` mapping of filenames to YAML text; `--template yolo.bug@1.0.0` selects one. These operations are read-only. Do not load submitted catalog URLs or execute definition prose.

## Adopt native intake

Only when the target authorizes a form change, prepare it in the target's ordinary branch/PR:

```sh
"$YOLO_TOOL" requests install --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA" --target /absolute/target/repository
```

This explicitly adds four `.github/ISSUE_TEMPLATE/<id>@<version>.yml` files. Review/commit/publish under target rules, retaining plain-text intake. It changes no adoption pin, labels, destinations, credentials or GitHub setting. Ordinary skill installation/upgrade does not run this operation. Existing identical files are retained; conflicts, competing template versions/titles or aliases stop before writes. Reconcile existing forms deliberately rather than deleting user work or forcing an overwrite. After interruption, inspect actual files; a retry fills missing exact files and retains identical ones. There is no cross-file transaction.

Consult the current [Issue Forms documentation](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) and [control schema](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-githubs-form-schema) when publishing a native form. Local rendering is not proof of GitHub availability for a particular account/repository. Keep sensitive reports out of ordinary issues and advertise a private channel only when established.

## Validate submitted input

An app/harness submits this data shape in an authorized issue body/comment (a marker alone is not authentication):

```json
{"template":{"id":"yolo.feature","version":"1.0.0"},"input":{"need":"Make the chosen app easier to find","context":"Optional public-safe context"}}
```

Save the original UTF-8 body and its issue/comment identity/edit timestamp in normal records. Normalize locally using the exact selected pack:

```sh
"$YOLO_TOOL" requests normalize --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA" --format json --input /absolute/submission.json
"$YOLO_TOOL" requests normalize --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA" --format github --input /absolute/native-body.txt
"$YOLO_TOOL" requests normalize --pack "$YOLO_REQUEST_PACK" --sha256 "$YOLO_REQUEST_SHA" --format plain --input /absolute/plain-feedback.txt
```

Optional `--template id@version` checks a separately expected form (not available for plain text); `--expect-source <sha256>` rejects bytes changed since a prior observation. Success returns validated input, source/input digests and exact template/protocol/optional process bindings. It proves neither live freshness, author identity, admission, fulfillment nor permission. Re-read current GitHub source and verify policy before consequential actions. No definition version is inferred from `latest`.

Native Markdown needs the exact ordered heading map, including optional sections, and the prefilled `Request template` answer. Edited/duplicate/missing/heading-containing sections, unknown versions, invalid choices/numbers or incomplete required answers refuse structured decoding. Keep the issue as feedback and ask for confirmed typed JSON if that ambiguity matters. Code fences do not conceal headings. Optional exact `_No response_` is absence; use JSON for literal sentinels, heading-containing prose or precise types. Nonempty answer text is preserved. A boolean is a value, not mandatory consent: an unchecked native box decodes to false. JSON booleans/numbers are never coerced from strings.

## Resolve the request

Read the exact protocol returned by `inspect` (five tailored stages per starter). Apply it through the adopted intake/work rules, preserving many-to-many outcome links, reasons, verified delivery, declined/remaining scope and post-closure follow-up:

- Feedback: understand observations/dissatisfaction; require no proposed solution.
- Feature: clarify the desired outcome and impact; a suggested implementation is optional.
- Bug: investigate observed versus expected behavior; missing reproduction is allowed.
- Question/help: answer directly where possible; do not invent an implementation ticket.

Reuse the existing receiver-owned request/status summary. A tracked request is not admitted work; a merge is not delivered availability. Keep actionable replies self-contained on the request issue. Name the exact edited requester reply reviewed, settled scope and simultaneous requester/receiver/manual dependencies. The bundled response schema defines these fields, but authenticated response read/write/resume and automatic outbound monitoring remain #145, **not this adapter**. Preserve existing ordinary status semantics and do not manufacture structured success.

## Client-owned definitions

Define flat bounded input, presentation fields, result schema and an exact required resolution protocol under your own namespace. An optional business graph names roles/actions/checks as data; implementations and authority remain independently configured. Reuse the starter shapes as authoring examples, replacing `yolo.*` identities with your namespace. The matching JSON Schemas are also bundled in `assets/request-schemas/` for authoring/app integration. The compiled validator carries those Draft 2020-12 definition schemas; no schema server or Python install is needed. It rejects unknown executable fields, schema references/overrides, unsupported widget keywords and conflicting identities. Definition JSON uses bounded safe integers; fractional schema constants are unsupported in v1. Regex constraints use Go's regexp syntax; unsupported expressions fail validation.

Place JSON definitions in ordinary `requests/templates/`, `requests/protocols/` and, if used, `requests/processes/`. Create a `requests/catalog.json` with `format_version: 1`, a namespaced `id`, exact semantic `version`, `kind: "application"`, and `templates`/`protocols`/`processes` arrays of `{id, version}` references. Select only reviewed local files, then prepare a pack into an existing empty directory:

```sh
"$YOLO_TOOL" requests pack --catalog requests/catalog.json --definitions requests --output /absolute/prepared-pack
```

Review and commit the catalog, exact definition bytes, generated index and its reported digest under target authority. Authoring a digest does not make its source trusted. Subsequently use that pinned digest with the same inspect/render/normalize/install commands. No core format change is needed for a custom app-facing form. Custom packs cannot redefine `yolo.*` or claim the reserved starter kind; exact identity with different bytes is a conflict. Do not reinterpret historical requests with an edited definition: give changed meanings an appropriate new version and retain old packs/hashes.

A form never selects destinations, credentials, responders or privileged commands. App definitions cannot authorize execution or extend a grant. The shipped generic pack contains no YOLO Dev hosting templates, public service catalog or workflow executor.
