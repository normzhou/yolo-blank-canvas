#!/usr/bin/env python3
"""Read-only factual checks for YOLO Dev Assisted; semantic review is separate."""

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote
from datetime import datetime, timezone

MARKER = ".yolo-dev/adoption.json"
CURRENT_MARKER = ".yolo/adoption.json"
STATE_LABELS = {"yolo:state:" + state for state in ("queued", "active", "waiting", "deferred")}
LABELS = STATE_LABELS | {"yolo:work"}
RULES = {"ownership", "congruence", "verification", "continuity"}
SHA = re.compile(r"[0-9a-f]{40}")


class GitHubError(ValueError):
    def __init__(self, endpoint, status, message):
        self.status = status
        self.message = message
        super().__init__("GitHub observation unavailable: " + endpoint + " (HTTP " + str(status) + "): " + message)


class Check:
    def __init__(self, root, offline=False):
        self.root = root.resolve()
        self.findings = []
        self.offline = offline
        self.marker_name = MARKER if (self.root / MARKER).exists() and not (self.root / CURRENT_MARKER).exists() else CURRENT_MARKER

    def git(self, *args, binary=False):
        env = dict(os.environ, GIT_OPTIONAL_LOCKS="0")
        result = subprocess.run(
            ["git", "-C", str(self.root), *args], capture_output=True, env=env
        )
        if result.returncode:
            raise ValueError(result.stderr.decode("utf-8", "replace").strip())
        return result.stdout if binary else result.stdout.decode("utf-8", "replace").strip()

    def path(self, name):
        if not isinstance(name, str) or not name or Path(name).is_absolute():
            raise ValueError("Expected a nonempty repo-relative path")
        path = (self.root / name.split("#", 1)[0]).resolve()
        if path == self.root or self.root not in path.parents:
            raise ValueError("Path escapes the target repository")
        return path

    def note(self, rule, status, detail, evidence):
        self.findings.append(dict(rule=rule, status=status, detail=detail, evidence=evidence))

    def ancestor(self, older, newer):
        if not isinstance(older, str) or not SHA.fullmatch(older):
            return False
        try:
            self.git("merge-base", "--is-ancestor", older, newer)
            return True
        except ValueError:
            return False

    def commits(self, older, newer):
        if not self.ancestor(older, newer):
            raise ValueError("History boundary is missing or is not an ancestor")
        return self.git("rev-list", "--reverse", "--topo-order", older + ".." + newer).split()

    def read_json(self, name, committed=False):
        path = self.path(name)
        raw = path.read_text()
        if committed and raw != self.git("show", "HEAD:" + name, binary=True).decode():
            raise ValueError("Checkpoint evidence is not unchanged committed content")
        data = json.loads(raw)
        if not isinstance(data, dict) or data.get("schema_version") not in (1, 2):
            raise ValueError("Unsupported record schema; expected 1 or 2")
        return data

    def checkpoint(self, marker, head):
        baseline = marker.get("adopted_at")
        if not self.ancestor(baseline, head):
            raise ValueError("Initial baseline is missing or not an ancestor of HEAD")
        checkpoint = marker.get("checkpoint")
        # Check published marker history so repeating init cannot erase prior coverage.
        previous_commit = baseline
        for commit in self.git("log", "--reverse", "--format=%H", "HEAD", "--", MARKER, CURRENT_MARKER).split():
            for name in (MARKER, CURRENT_MARKER):
                try:
                    raw = self.git("show", commit + ":" + name)
                except ValueError:
                    continue  # Relocation deletes the old marker; its history remains reviewed.
                old = json.loads(raw)
                if not isinstance(old, dict) or old.get("schema_version") not in (1, 2):
                    raise ValueError("Unsupported published adoption record")
                if old.get("adopted_at") != baseline:
                    raise ValueError("Initial baseline differs from published adoption history")
                old_checkpoint = old.get("checkpoint")
                if old_checkpoint:
                    candidate = old_checkpoint.get("commit")
                    if not self.ancestor(previous_commit, candidate):
                        raise ValueError("Published checkpoint moved backward or lost history")
                    previous_commit = candidate
                elif previous_commit != baseline:
                    raise ValueError("Published marker cleared a successful checkpoint")
        if checkpoint is None:
            if previous_commit != baseline:
                raise ValueError("Marker cleared a successful checkpoint")
            return baseline
        if not isinstance(checkpoint, dict) or not self.ancestor(previous_commit, checkpoint.get("commit")):
            raise ValueError("Checkpoint is malformed or moves backward")
        through = checkpoint["commit"]
        if not self.ancestor(through, head):
            raise ValueError("Checkpoint is not an ancestor of HEAD")
        report_name = checkpoint.get("report")
        if not isinstance(report_name, str) or not report_name:
            raise ValueError("Checkpoint needs a report path")
        expected = through
        visited = set()
        while report_name:
            if report_name in visited:
                raise ValueError("Checkpoint report chain contains a cycle")
            visited.add(report_name)
            report = self.read_json(report_name, committed=True)
            if report.get("revision") != expected:
                raise ValueError("Checkpoint/report revision mismatch")
            covered = self.commits(report.get("from"), expected)
            claimed = report.get("reviewed_commits")
            if not isinstance(claimed, list) or len(claimed) != len(covered) or set(claimed) != set(covered):
                raise ValueError("Report does not cover the full history interval")
            findings = report.get("findings", [])
            if not isinstance(findings, list) or not findings:
                raise ValueError("Report has no semantic findings")
            if any(not isinstance(f, dict) or f.get("status") != "compliant"
                   or not isinstance(f.get("evidence"), list) or not f["evidence"]
                   or not all(isinstance(e, str) and e for e in f["evidence"])
                   or not f.get("detail") for f in findings):
                raise ValueError("Report has unresolved or uncited findings")
            if not RULES.issubset({f.get("rule") for f in findings}):
                raise ValueError("Report omits a required semantic rule")
            verification = report.get("verification", [])
            if not isinstance(verification, list) or not any(
                isinstance(v, dict) and v.get("revision") == expected
                and v.get("result") == "pass" and v.get("evidence") for v in verification
            ):
                raise ValueError("Report lacks passing verification for its subject revision")
            expected = report["from"]
            report_name = report.get("previous_report")
        if expected != baseline:
            raise ValueError("Report chain does not reach the initial baseline")
        return through

    def layout(self, marker):
        """Observe only the layout supplied with the matching adopted bundle."""
        try:
            protocol = marker['protocol']
            installed = self.path(marker['harness']['skill']['path'])
            manifest = json.loads((installed / 'references/provenance.json').read_text())
            snapshot = self.path(protocol['path']).read_bytes()
            if (manifest.get('protocol_format') != protocol.get('format')
                    or manifest.get('revision') != protocol.get('revision')
                    or manifest.get('inputs') != protocol.get('inputs')
                    or manifest['output']['sha256'] != protocol.get('sha256')
                    or hashlib.sha256(snapshot).hexdigest() != protocol.get('sha256')):
                raise ValueError('Installed layout definition does not match the adopted protocol; no new rules applied')
            layout = manifest.get('layout')
            if not isinstance(layout, dict):
                raise ValueError('This adopted bundle has no machine-readable layout; reconcile its rules through agent review')
            before = len(self.findings)
            for parent, entries in [('.yolo', layout['root']), ('.yolo/governance', layout['governance'])]:
                directory = self.root / parent
                if not directory.exists():
                    continue  # Governing roles may all be mapped outside the namespace.
                if directory.is_symlink() or not directory.is_dir():
                    self.note('layout', 'conflicting', 'Reserved container must be a real directory', [parent])
                    continue
                for child in directory.iterdir():
                    kind = entries.get(child.name)
                    valid = (child.is_file() if kind == 'file' else child.is_dir() if kind == 'directory' else False)
                    if child.is_symlink() or not valid:
                        self.note('layout', 'conflicting', 'Unexpected reserved entry or wrong file/directory type', [str(child.relative_to(self.root))])
            if protocol['path'] != '.yolo/protocol.md':
                self.note('layout', 'conflicting', 'Snapshot must use its reserved slot', [protocol['path']])
            for role, canonical in layout['roles'].items():
                reference = marker['documents'].get(role)
                path = self.path(reference)
                relative = path.relative_to(self.root).as_posix()
                if relative.startswith('.yolo/') and relative != canonical:
                    self.note('layout', 'conflicting', 'Mapped role must use its canonical reserved slot', [reference, canonical])
                elif not path.is_file():
                    self.note('layout', 'missing', 'Required governing role is missing', [reference])
                elif not relative.startswith('.yolo/'):
                    try:
                        self.git('cat-file', '-e', marker['adopted_at'] + ':' + relative)
                    except ValueError:
                        self.note('layout', 'conflicting', 'Mapped external document did not exist at the pre-onboarding baseline; new documents use canonical slots', [reference])
            if len(self.findings) == before:
                self.note('layout', 'compliant', 'Reserved entries and governing mappings match the adopted layout; meaning still needs review', [self.marker_name])
        except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
            self.note('layout', 'unverified', str(error), [self.marker_name])

    def context(self, marker):
        """Observe required record fields, never authenticate acceptance from their presence."""
        def references(value):
            return isinstance(value, list) and bool(value) and all(isinstance(v, str) and v.strip() for v in value)
        target = marker.get("target", {})
        authority = marker.get("authority", {})
        harness = marker.get("harness", {})
        verification = marker.get("verification", {})
        activation = marker.get("activation", {})
        protocol = marker.get("protocol", {})
        try:
            if marker["schema_version"] != 2:
                raise ValueError("New .yolo adoption requires schema 2; migration must be explicit")
            if protocol.get("format") != "github-v1":
                raise ValueError("Unsupported protocol format; do not substitute installed rules")
            inputs = protocol.get("inputs")
            if not isinstance(inputs, list) or not inputs or any(
                not isinstance(i, dict) or not i.get("path") or not re.fullmatch(r"[0-9a-f]{64}", i.get("sha256", "")) for i in inputs
            ):
                raise ValueError("Source-input provenance is missing or malformed")
            if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", target.get("repository", "")) or not target.get("default_branch") or not target.get("scope") or target.get("level") != 1:
                raise ValueError("Target repository/default branch/scope/L1 must be explicit; L2 is not implemented")
            if not references(authority.get("maintainers")) or not references(authority.get("source")) or not references(authority.get("acceptance")) or authority.get("pending") != []:
                raise ValueError("Recognized authority/identified acceptance is missing or pending; review its authenticity")
            if activation.get("state") != "active" or not references(activation.get("evidence")):
                raise ValueError("Setup is proposed or lacks accepted activation evidence")
            if not harness.get("name") or not harness.get("version") or not references(harness.get("instructions")):
                raise ValueError("Harness/version/instruction route is unverified")
            for name in harness["instructions"]:
                if not self.path(name).is_file(): raise ValueError("Native instruction binding is missing")
            skill = harness.get("skill", {})
            installed = self.path(skill.get("path"))
            manifest = json.loads((installed / "references/provenance.json").read_text())
            output = (installed / manifest["output"]["path"]).resolve()
            if installed not in output.parents:
                raise ValueError("Bundle output escapes its installation")
            raw = output.read_bytes()
            if manifest.get("revision") != protocol.get("revision") or manifest.get("inputs") != inputs or manifest["output"]["sha256"] != hashlib.sha256(raw).hexdigest() or manifest["output"]["sha256"] != protocol.get("sha256"):
                raise ValueError("Installed bundle identity differs; review adoption compatibility before any upgrade")
            if not SHA.fullmatch(skill.get("revision", "")):
                raise ValueError("Installed skill needs identified publication/installation revision")
            for role in ("checks", "delivery", "recovery", "limits"):
                if not references(verification.get(role)): raise ValueError("Missing target verification binding: " + role)
            if not isinstance(marker.get("upgrades"), list): raise ValueError("Upgrade applicability records must be preserved")
            for upgrade in marker["upgrades"]:
                if not isinstance(upgrade, dict) or not all(SHA.fullmatch(upgrade.get(key, "")) for key in ("from", "to", "effective_commit")) or not references(upgrade.get("evidence")):
                    raise ValueError("Upgrade needs identified old/new/effective revisions and acceptance evidence")
            self.note("context", "compliant", "Required context references exist; authority, loading and meaning need agent review", [self.marker_name])
        except (ValueError, OSError, KeyError, TypeError, AttributeError) as error:
            self.note("context", "unverified", str(error), [self.marker_name])

    def api(self, endpoint, paginate=False):
        command = ["gh", "api", endpoint]
        if paginate: command += ["--paginate", "--slurp"]
        response = subprocess.run(command, capture_output=True, text=True, timeout=30)
        if response.returncode:
            try:
                failure = json.loads(response.stdout)
                if isinstance(failure, list): failure = failure[0]
                message = failure.get("message", "Unavailable")
                status = int(failure.get("status", 0))
            except (ValueError, IndexError, AttributeError, TypeError):
                message = "Request failed; inspect authorized access/capability"
                status = 0
            raise GitHubError(endpoint, status, message)
        data = json.loads(response.stdout)
        if paginate and all(isinstance(page, list) for page in data):
            data = [entry for page in data for entry in page]
        return data

    def github(self, marker, result):
        if self.offline:
            result["github"] = {"evidence_source": "none (offline)", "observed_at": None,
                                "coverage": "None: GitHub observation disabled."}
            self.note("github", "unverified", "Offline: GitHub state/configuration was not observed", [self.marker_name])
            return
        result["github"] = {"evidence_source": "live gh api", "observed_at": datetime.now(timezone.utc).isoformat(), "coverage": "Metadata, default branch, labels, all issues/comments, branch rules/rulesets, classic protection, workflows. PR checks/reviews, approval authenticity and delivery require agent reconciliation."}
        try:
            target = marker["target"]
            repo = target["repository"]
            if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo): raise ValueError("Invalid target repository")
            base = "repos/" + repo
            metadata = self.api(base)
            result["github"]["repository"] = metadata
            branch = metadata["default_branch"]
            if branch != target["default_branch"]: raise ValueError("Observed default branch differs from adoption")
            facts = result["github"]
            endpoints = {
                "default_branch": (base + "/branches/" + quote(branch, safe=""), False),
                "labels": (base + "/labels?per_page=100", True),
                "issues": (base + "/issues?state=all&per_page=100", True),
                "comments": (base + "/issues/comments?per_page=100", True),
                "rules": (base + "/rules/branches/" + quote(branch, safe=""), True),
                "rulesets": (base + "/rulesets?includes_parents=true&per_page=100", True),
                "workflows": (base + "/actions/workflows?per_page=100", True),
            }
            for key, (endpoint, paginate) in endpoints.items():
                try: facts[key] = self.api(endpoint, paginate)
                except (ValueError, OSError, subprocess.TimeoutExpired) as error:
                    # GitHub's explicit plan/capability denial is known absence, not an
                    # unknown permissions response. This never establishes L2 enforcement.
                    unsupported = isinstance(error, GitHubError) and error.status == 403 and error.message == "Upgrade to GitHub Pro or make this repository public to enable this feature."
                    if key in ("rules", "rulesets") and unsupported and marker["target"].get("level", 1) == 1:
                        facts[key] = None
                        facts.setdefault("capability_limits", []).append(dict(endpoint=endpoint, status=error.status, message=error.message))
                        self.note("github_" + key, "compliant", "Native feature explicitly unavailable; observed L1 limitation, not enforced controls", [endpoint, error.message])
                    else:
                        self.note("github_" + key, "unverified", str(error), [endpoint])
            if facts.get("default_branch", {}).get("protected") is False:
                facts["classic_protection"] = None
            else:
                endpoint = base + "/branches/" + quote(branch, safe="") + "/protection"
                try: facts["classic_protection"] = self.api(endpoint)
                except (ValueError, OSError, subprocess.TimeoutExpired) as error:
                    self.note("github_protection", "unverified", str(error), [endpoint])
            facts["ruleset_details"] = []
            for ruleset in facts.get("rulesets") or []:
                if not isinstance(ruleset.get("id"), int):
                    self.note("github_rulesets", "unverified", "Malformed ruleset identity", [base + "/rulesets"])
                    continue
                endpoint = base + "/rulesets/" + str(ruleset["id"])
                try: facts["ruleset_details"].append(self.api(endpoint))
                except (ValueError, OSError, subprocess.TimeoutExpired) as error:
                    self.note("github_ruleset_detail", "unverified", str(error), [endpoint])
            if "labels" in facts:
                missing = LABELS - {label["name"] for label in facts["labels"]}
                if missing: self.note("github_labels", "missing", "Missing reserved labels: " + ", ".join(sorted(missing)), [base + "/labels"])
            for issue in facts.get("issues", []):
                if "pull_request" in issue: continue
                labels = {label["name"] for label in issue["labels"]}
                states = labels & STATE_LABELS
                if any(label.startswith("yolo:") and label not in LABELS for label in labels):
                    self.note("issue_labels", "unverified", "Reserved namespace needs reconciliation", [issue["html_url"]])
                if "yolo:work" not in labels:
                    if states: self.note("issue_state", "conflicting", "State label without admitted work", [issue["html_url"]])
                    continue
                if (issue["state"] == "open" and len(states) != 1) or (issue["state"] == "closed" and states):
                    self.note("issue_state", "conflicting", "Managed state needs reconciliation", [issue["html_url"]])
                if "comments" in facts:
                    summaries = [c for c in facts["comments"] if c["issue_url"] == issue["url"] and re.search(r"^## YOLO status\s*$", c["body"], re.M)]
                    if len(summaries) != 1:
                        self.note("issue_summary", "missing", "Expected one recognizable status summary; agent must verify authorship/content", [issue["html_url"]])
            if "default_branch" in facts:
                revision = facts["default_branch"]["commit"]["sha"]
                facts["default_revision"] = revision
                try:
                    self.git("cat-file", "-e", revision + "^{commit}")
                    facts["default_files"] = self.git("ls-tree", "-r", "--name-only", revision).splitlines()
                    facts["default_adoption"] = json.loads(self.git("show", revision + ":" + self.marker_name))
                    if facts["default_adoption"].get("protocol") != marker.get("protocol") or facts["default_adoption"].get("activation") != marker.get("activation"):
                        raise ValueError("Default-branch adopted protocol/activation differs from local proposal")
                except ValueError:
                    self.note("default_branch_context", "unverified", "Default-branch adoption is missing, different or not available locally; agent must fetch/reconcile before attesting it", [branch, revision])
            self.note("github", "compliant", "Available observations retained; effective authority, PR/check evidence and outcomes still require semantic review", [base])
        except (ValueError, OSError, KeyError, TypeError, AttributeError, subprocess.TimeoutExpired) as error:
            self.note("github", "unverified", str(error), [self.marker_name])

    def run(self):
        if Path(self.git("rev-parse", "--show-toplevel")).resolve() != self.root:
            raise ValueError("Invoke the helper against the repository root")
        head = self.git("rev-parse", "HEAD")
        status = self.git("status", "--porcelain=v1", "--untracked-files=all")
        digest = hashlib.sha256()
        digest.update(status.encode())
        digest.update(self.git("diff", "HEAD", "--binary", binary=True))
        for name in self.git("ls-files", "--others", "--exclude-standard", "-z", binary=True).split(b"\0"):
            if name:
                path = self.root / os.fsdecode(name)
                digest.update(name)
                digest.update(os.readlink(path).encode() if path.is_symlink() else path.read_bytes())
        result = dict(schema_version=1, revision=head, working_state=status.splitlines(),
                      working_digest=digest.hexdigest(), history=[], findings=self.findings,
                      semantic_review="required")
        if (self.root / CURRENT_MARKER).exists() and (self.root / MARKER).exists():
            self.note("adoption", "conflicting", "Two adoption markers: reconcile explicitly; never choose an implicit upgrade", [CURRENT_MARKER, MARKER])
            result["marker"] = None
            result["marker_candidates"] = [CURRENT_MARKER, MARKER]
            result["factual_status"] = "gaps"
            return result
        result["marker"] = self.marker_name
        try:
            marker = self.read_json(self.marker_name)
        except (ValueError, OSError) as error:
            self.note("adoption", "missing" if not (self.root / self.marker_name).exists() else "conflicting", str(error), [self.marker_name])
            result["factual_status"] = "gaps"
            return result
        if self.marker_name == MARKER and marker.get("schema_version") != 1:
            self.note("adoption", "conflicting", "Legacy location supports schema 1 only; explicit migration is required", [self.marker_name])
        protocol = marker.get("protocol", {})
        if not isinstance(protocol, dict) or not isinstance(protocol.get("revision"), str) or not SHA.fullmatch(protocol["revision"]) or protocol.get("repository") != "https://github.com/normzhou/yolo-dev":
            self.note("protocol", "conflicting", "Expected the canonical protocol repository and full commit ID", [self.marker_name])
        else:
            self.note("protocol", "compliant", "Reference is identified; agent must read and verify applicability", [self.marker_name])
        if not isinstance(protocol, dict):
            protocol = {}
        try:
            snapshot = self.path(protocol.get("path"))
            expected_digest = protocol.get("sha256")
            if not isinstance(expected_digest, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_digest):
                raise ValueError("Protocol snapshot needs a SHA-256 digest")
            raw = snapshot.read_bytes()
            if not raw.strip() or hashlib.sha256(raw).hexdigest() != expected_digest:
                raise ValueError("Protocol snapshot is empty or differs from the adopted digest")
            expected_sources = ("skills/yolo/references/protocol.md", "skills/yolo-dev/references/protocol.md") if self.marker_name == CURRENT_MARKER else ("skills/yolo-dev/references/assisted-protocol.md",)
            if protocol.get("source") not in expected_sources:
                raise ValueError("Protocol snapshot needs its bundled source path")
            self.note("protocol_snapshot", "compliant", "Local snapshot matches its recorded digest; provenance and meaning require review", [protocol["path"], self.marker_name])
        except (ValueError, OSError, AttributeError) as error:
            self.note("protocol_snapshot", "missing" if isinstance(error, FileNotFoundError) else "conflicting", str(error), [self.marker_name])
        documents = marker.get("documents", {})
        if not isinstance(documents, dict):
            documents = {}
        for role in ("charter", "architecture", "instructions", "authority"):
            name = documents.get(role)
            try:
                path = self.path(name)
                if not path.is_file() or not path.read_text().strip():
                    raise ValueError("Document is missing or empty")
                self.note(role, "compliant", "Mapped document exists; meaning requires agent review", [name])
            except (ValueError, OSError) as error:
                self.note(role, "missing", str(error), [self.marker_name])
        try:
            instructions = self.path(documents.get("instructions"))
            links = re.findall(r"\]\(([^)]+)\)", instructions.read_text())
            destinations = {(instructions.parent / p.split("#")[0]).resolve() for p in links if not p.startswith(("http:", "https:"))}
            if self.path(self.marker_name) not in destinations:
                raise ValueError("Ordinary instructions do not link the adoption record")
            if self.path(protocol.get("path")) not in destinations:
                raise ValueError("Ordinary instructions do not link the local operating protocol")
            self.note("instruction_entry", "compliant", "Adoption and protocol links exist; read/apply instructions and actual harness loading need review", [documents["instructions"]])
        except (ValueError, OSError) as error:
            self.note("instruction_entry", "missing", str(error), [self.marker_name])
        unresolved = marker.get("unresolved")
        if not isinstance(unresolved, list) or unresolved:
            self.note("unresolved_findings", "unverified", "Resolve and cite recorded findings before advancing", [self.marker_name])
        else:
            self.note("unresolved_findings", "compliant", "No unresolved findings recorded; agent must reconcile reports", [self.marker_name])
        try:
            start = self.checkpoint(marker, head)
            for commit in self.commits(start, head):
                result["history"].append(dict(commit=commit, summary=self.git("show", "-s", "--format=%s", commit),
                                               files=self.git("diff-tree", "--root", "-m", "--no-commit-id", "--name-only", "-r", commit).splitlines()))
            result["from"] = start
            self.note("checkpoint", "compliant", "History boundaries and cited checkpoint structure are available", [self.marker_name])
        except (ValueError, OSError, TypeError, KeyError, AttributeError) as error:
            self.note("checkpoint", "unverified", str(error), [self.marker_name])
        if self.marker_name == CURRENT_MARKER:
            self.layout(marker)
            self.context(marker)
            self.github(marker, result)
        else:
            result["compatibility"] = "Legacy schema 1/local protocol preserved; no new GitHub protocol or L2 qualification implied. Agent must still reconcile related GitHub records."
        result["factual_status"] = "ready_for_review" if all(f["status"] == "compliant" for f in self.findings) else "gaps"
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("repo", type=Path)
    parser.add_argument("--offline", action="store_true", help="Do not access GitHub; current protocol reports an observation gap")
    args = parser.parse_args()
    try:
        result = Check(args.repo, offline=args.offline).run()
    except (ValueError, OSError) as error:
        print(json.dumps(dict(factual_status="error", error=str(error), semantic_review="required")))
        return 2
    print(json.dumps(result, indent=2))
    return 0 if result["factual_status"] == "ready_for_review" else 1


if __name__ == "__main__":
    raise SystemExit(main())
