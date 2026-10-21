#!/usr/bin/env python3
"""One local writer, private backend, reviewed exact plan; no fresh-plan auto-approval."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from provider_check import validate_review

HERE = Path(__file__).resolve().parent


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"init", "plan", "review", "apply", "check-state"}:
        sys.exit("Usage: python3 infra/hostctl.py init|plan|review|apply|check-state")
    if any(k == "TF_ENCRYPTION" or k.startswith("TF_CLI_ARGS") for k in os.environ):
        sys.exit("Remove TF_ENCRYPTION/TF_CLI_ARGS overrides; only the committed encryption/CLI settings are admitted.")
    if os.environ.get("TF_WORKSPACE", "default") != "default":
        sys.exit("Only the default workspace is admitted.")
    configured = Path(os.environ["YOLO_HOST_PRIVATE_DIR"]).expanduser()
    if not configured.is_absolute():
        sys.exit("Use an absolute private directory outside the repository.")
    private = configured.resolve()
    if private == HERE.parent or HERE.parent in private.parents:
        sys.exit("Use an absolute private directory outside the repository.")
    os.umask(0o077)
    private.mkdir(parents=True, exist_ok=True, mode=0o700)
    if private.stat().st_mode & 0o077:
        sys.exit("Private directory must have mode 0700.")
    tool = os.environ.get("YOLO_TOFU", "tofu")
    version = json.loads(subprocess.check_output([tool, "version", "-json"]))
    if version["terraform_version"] != "1.13.1":
        sys.exit("Use the reviewed OpenTofu 1.13.1 binary.")
    lock = (private / "writer.lock").open("a")
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        sys.exit("Another local infrastructure writer is active; do not disable locking.")
    state = private / "terraform.tfstate"
    plan = private / "approved.tfplan"
    receipt = private / "review.json"
    base = [tool, f"-chdir={HERE}"]

    def run(args, **kw):
        return subprocess.run(base + args, check=True, **kw)

    def digest(path):
        return hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None

    def subject():
        # Refuse source or private-input changes between review and apply.
        source = hashlib.sha256()
        for p in sorted(HERE.glob("*.tf")) + [HERE / "bootstrap.sh", HERE / ".terraform.lock.hcl", HERE / "review_plan.py", HERE / "hostctl.py", HERE / "provider_check.py", HERE / "providers.json"]:
            source.update(p.name.encode() + p.read_bytes())
        return {"source": source.hexdigest(), "state": digest(state), "plan": digest(plan), "variables": digest(private / "terraform.tfvars"), "provider_review": digest(private / "provider-review.json")}

    command = sys.argv[1]
    if "TF_DATA_DIR" in os.environ or (HERE / ".terraform/environment").exists() and (HERE / ".terraform/environment").read_text().strip() != "default":
        sys.exit("Custom data directories and non-default workspaces are not admitted.")
    if command in {"plan", "apply"}:
        validate_review(json.loads((private / "provider-review.json").read_text()), digest(private / "terraform.tfvars"))
    if command == "init":
        run(["init", "-input=false", "-reconfigure", "-lockfile=readonly", f"-backend-config=path={state}"])
        return
    # Verify init selected this exact private backend, not a previous workspace.
    backend = json.loads((HERE / ".terraform/terraform.tfstate").read_text())["backend"]
    if backend["type"] != "local" or Path(backend["config"]["path"]).resolve() != state:
        sys.exit("Run hostctl.py init for this private directory first.")
    if command == "plan":
        receipt.unlink(missing_ok=True)
        run(["plan", "-input=false", "-lock-timeout=0s", f"-var-file={private / 'terraform.tfvars'}", f"-out={plan}"])
    elif command == "review":
        if not plan.exists():
            sys.exit("Create the saved plan first.")
        # JSON is plaintext only in process memory/pipe, never saved to disk/logs.
        shown = subprocess.check_output(base + ["show", "-json", str(plan)])
        subprocess.run([sys.executable, str(HERE / "review_plan.py")], input=shown, check=True)
        receipt.write_text(json.dumps(subject(), sort_keys=True))
        print("Saved exact-plan review receipt privately. Inspect the human plan/account checks before apply.")
    elif command == "apply":
        if not receipt.exists() or json.loads(receipt.read_text()) != subject():
            sys.exit("Missing/stale plan review; create and review a fresh plan.")
        run(["apply", "-input=false", "-lock-timeout=0s", str(plan)])
        receipt.unlink()
        backup = private / "state-backups"
        backup.mkdir(exist_ok=True, mode=0o700)
        shutil.copyfile(state, backup / f"{digest(state)}.tfstate")
        print("Apply finished; encrypted local backup saved. Copy state to the independent owner backup before another write.")
    elif command == "check-state":
        # Read verifies decryption/recovered lineage; output contains no values.
        recovered = json.loads(subprocess.check_output(base + ["state", "pull"]))
        print(f"State decrypts: serial={recovered['serial']}; lineage present={bool(recovered['lineage'])}.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        sys.exit(f"Stopped: {error}")
    except (KeyError, OSError, subprocess.CalledProcessError):
        sys.exit("Stopped: configuration/tool/private-path check failed. Review the preceding local diagnostics; do not post secret output.")
