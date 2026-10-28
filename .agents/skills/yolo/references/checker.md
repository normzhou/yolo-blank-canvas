# Versioned Go tools

Use the executable from the selected YOLO publication, outside the immutable skill folder. Installation, release selection and checking need no Python or Go runtime. Git remains required; remote observation/selection uses existing authorized `gh`. A newer tool cannot change an active pin. Earlier pins retain their own tooling.

## Operator App preflight

Compatible publications offer explicit `app verify --config <private-json> <repo>` for the operator-owned App [setup and access check](operator-app.md). It issues/revokes a temporary metadata-only credential, keeps private inputs outside the target, and provides no worker/publication route or token export. Default checks remain read-only and never switch App declarations to personal `gh` access. A preflight success is not execution readiness or qualification.

## Codex observation

The bundle also installs activity-baseline hooks in `.claude/settings.json`, `.gemini/settings.json`, `.cursor/hooks.json`, and an OpenCode V2 plugin in `.opencode/plugins/yolo-observer.js`. These record the six activity types, harness name and available native start/finish/duration. They omit usage counters and report capture. Existing owner settings/hooks are preserved; changed publisher hooks require explicit reconciliation. Load/trust the project through each harness's normal controls. Session-only hooks cover sequential turns; queued/nested attribution is deferred. Missing finish events stay unknown. A ready ingest credential is separate from verified hook loading and receipt.

An identified `codex-hooks-v1` bundle installs project hooks alongside existing user hooks. Review/reload them through Codex's normal trust controls; installation cannot grant trust. Native CLI callbacks are verified on macOS ARM64 for 0.162.1 and 0.164.0. The latter uses an isolated loopback provider with canned responses and native project hooks, without model calls; reviewed project loading and actual client capture remain separate evidence. IDE/app, other versions and native Windows/Linux execution remain unverified. Follow the current [official hook documentation](https://learn.chatgpt.com/docs/hooks) for project trust and exact-definition hook review.

When the activity environment variables are absent, obtain the correlated ordinary-report descriptor from the repository root:

```sh
sh .agents/skills/yolo/assets/codex-observer.sh PROTOCOL_SHA256 context
```

Replace `PROTOCOL_SHA256` with `output.sha256` from the installed `references/provenance.json`. On Windows use `powershell -NoProfile -File .agents/skills/yolo/assets/codex-observer.ps1 PROTOCOL_SHA256 context`. The launcher locates the matching private cached executable without a new runtime. `observe context <repo>` is read-only and selects only the current native session; use an `active` response's `activity_id`/`report_path`, otherwise retain the report gap. It neither enrolls nor sends.

`observe status` describes the credential separately from native capture. A ready credential cannot prove hook trust/loading. Codex emits native activity/tool measurements with partial coverage and unavailable model/token fields omitted. Hooks return no context, continuation or permission decisions. Startup, help and absent/revoked consent send nothing; dry runs never enroll/transmit. Private state/report copies are bounded to 64 sessions, 16 reports per session and 24 hours; expiry never invents a finish. A killed hook may leave its session state busy/unavailable until expiry, without blocking development.

For an explicitly requested diagnosis, `yolo-check observe doctor <repo>` reads the
installed observer pin/bindings, configured consent, credential readiness and existing
bounded local capture/delivery evidence. It never launches a harness, enrolls, sends,
repairs or requests an agent report. It identifies the diagnosing executable, its exact supported Codex CLI versions and support for the version recorded in adoption. That record is not a live version probe; a different checker cannot establish the installed observer’s compatibility. Loading/trust and remote receipt remain unverified;
ephemeral or Pi-only capture may leave no retained evidence. Do not add it to ordinary
worker startup, prompts or per-turn instructions.

| Platform | Release asset |
| --- | --- |
| macOS Intel | `yolo-check_darwin_amd64` |
| macOS Apple Silicon | `yolo-check_darwin_arm64` |
| Linux x86-64 | `yolo-check_linux_amd64` |
| Linux ARM64 | `yolo-check_linux_arm64` |
| Windows x86-64 | `yolo-check_windows_amd64.exe` |

Resolve the requested release once; retain its tag and full publication commit. Download that release's asset and `SHA256SUMS` using authenticated `gh release download`, compare the downloaded SHA-256 with its exact named checksum entry, and stop on missing/mismatched evidence. On Unix set the verified file executable. `--version` returns JSON with `version` and `publication`; require both to match the recorded release version and publication commit; do not accept a filename as identity. macOS support starts at macOS 13 for the current Go toolchain. Windows needs the existing protocol's actual symlink bindings; missing privileges/bindings remain gaps.

Example for macOS ARM64, using the already resolved tag and commit:

```sh
set -e
YOLO_TOOL_DIR=$(mktemp -d)
gh release download "$YOLO_TAG" --repo normzhou/yolo-dev --dir "$YOLO_TOOL_DIR" --pattern yolo-check_darwin_arm64 --pattern SHA256SUMS
(cd "$YOLO_TOOL_DIR" && grep '  yolo-check_darwin_arm64$' SHA256SUMS | shasum -a 256 -c -)
chmod +x "$YOLO_TOOL_DIR/yolo-check_darwin_arm64"
"$YOLO_TOOL_DIR/yolo-check_darwin_arm64" --version
```

Check the checksum command succeeded and the version output matches the resolved identity before proceeding. Linux uses `sha256sum -c`; Windows uses `Get-FileHash -Algorithm SHA256` and compares the exact filename's entry. Select the platform from the actual OS/architecture, not the target app's language. Build success is not native behavioral qualification; retain stated release verification limits.

```text
yolo-check <repo-root> --structure   local structure only
yolo-check <repo-root> --offline     local/history facts; remote state unverified
yolo-check <repo-root>               local and GitHub facts
```

JSON and exits: **0** factual readiness for semantic review; **1** gaps; **2** invocation/Git error. `--version` and `--help` inspect no target. None establishes activation or qualification. Default check is read-only. Explicit installation writes the skill/bindings and, for observing bundles, a matching native executable in private user configuration outside Git; repairs/activation remain agent procedures governed by authority.

## Activity observation

The same executable realizes the adopted **Activity observation** contract. `yolo-check observe emit` validates one versioned event read as JSON from stdin, writes it to a local JSONL sink (`--sink`, else `YOLO_OBSERVE_SINK`) and transmits only with both `--consent` and `--endpoint`. `--dry-run` suppresses transmission. `yolo-check observe query --sink <path>` deduplicates a sink by `event_id` and returns counts, observed effort, report findings, agent verdicts and missing finishes. Unknown fields, arbitrary strings and custom labels are dropped; an unavailable sink or endpoint is reported and fails open without changing development or checker exit semantics. Observation never replaces the report, advances a checkpoint or qualifies an adoption.

For a collector requiring an ingest-only credential, supply `YOLO_OBSERVE_TOKEN` privately in the process environment. It becomes a bearer header only after consent/dry-run checks. Never put credentials in arguments, endpoint URLs or reports; authenticated endpoints require HTTPS (loopback HTTP is available for isolated tests). Redirects are refused and timeouts are bounded to five seconds; `--timeout-ms` accepts 1–5000. Collector administration and read-only analysis credentials are separate and never belong in a target installation.

Supported automatic bindings use `observe setup <repo>` and `observe emit --root <repo>` internally. They validate the compatible active pin and accepted observation setting, enroll a private scoped credential once, and recheck consent on every send. `observe status <repo>` reads local readiness without network or writes. Private configuration is under the OS user configuration directory's `yolo` folder; `YOLO_OBSERVE_CONFIG_DIR` selects an isolated directory outside the repo for explicit trials/previews. Never stage it in Git. See [activity result](records.md#activity-result).

## Installation and selection

```text
yolo-check install --bundle <verified-skill-folder> <repo-root>
yolo-check resolve [stable|preview|ref]
```

Install verifies the complete manifest inventory, then preflights all bindings. `changed` reports whether files were written. Identical installs are unchanged; conflicting files, legacy skills or escaping aliases stop without overwrites. Preserve native instructions by reconciling their shared import first. Use a retained checkout for dry runs. Installer errors are exit 1 with JSON `error`; no force mode, adoption activation or GitHub writes.

Resolve defaults to latest stable; preview chooses newest published non-draft release. No silent fallback. JSON returns selection, release tag (null for an untagged candidate), full publication and versioned guide. Preserve this result through the proposal. Resolution errors are exit 1; target state is untouched. When upgrading an older pin, bootstrap from the current agent guide before using the selected version's tools.

The request adapter also uses the pinned libraries listed in [tool notices](tool-licenses.md). Its [local form guide](request-forms.md) covers optional authoring, validation and installation; ordinary checks remain read-only.
