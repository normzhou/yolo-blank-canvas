# Versioned Go tools

Use the executable from the selected YOLO publication, outside the immutable skill folder. Installation, release selection and checking need no Python or Go runtime. Git remains required; remote observation/selection uses existing authorized `gh`. A newer tool cannot change an active pin. Earlier pins retain their own tooling.

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

JSON and exits: **0** factual readiness for semantic review; **1** gaps; **2** invocation/Git error. `--version` and `--help` inspect no target. None establishes activation or qualification. Default check is read-only. Explicit installation writes only the skill and bindings; repairs/activation remain agent procedures governed by authority.

## Activity observation

The same executable realizes the adopted **Activity observation** contract. `yolo-check observe emit` validates one versioned event read as JSON from stdin, writes it to a local JSONL sink (`--sink`, else `YOLO_OBSERVE_SINK`) and transmits only with both `--consent` and `--endpoint`. `--dry-run` suppresses transmission. `yolo-check observe query --sink <path>` deduplicates a sink by `event_id` and returns counts, observed effort, report findings, agent verdicts and missing finishes. Unknown fields, arbitrary strings and custom labels are dropped; an unavailable sink or endpoint is reported and fails open without changing development or checker exit semantics. Observation never replaces the report, advances a checkpoint or qualifies an adoption.

## Installation and selection

```text
yolo-check install --bundle <verified-skill-folder> <repo-root>
yolo-check resolve [stable|preview|ref]
```

Install verifies the complete manifest inventory, then preflights all bindings. `changed` reports whether files were written. Identical installs are unchanged; conflicting files, legacy skills or escaping aliases stop without overwrites. Preserve native instructions by reconciling their shared import first. Use a retained checkout for dry runs. Installer errors are exit 1 with JSON `error`; no force mode, adoption activation or GitHub writes.

Resolve defaults to latest stable; preview chooses newest published non-draft release. No silent fallback. JSON returns selection, release tag (null for an untagged candidate), full publication and versioned guide. Preserve this result through the proposal. Resolution errors are exit 1; target state is untouched. When upgrading an older pin, bootstrap from the current agent guide before using the selected version's tools.
