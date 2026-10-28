#!/usr/bin/env python3
"""Copy the optional hosting starter into an authorized target; no cloud calls."""
import argparse
import hashlib
import json
from pathlib import Path
import re


def instantiate(target, app, repository, profile="cloudflare-oracle", worker=None):
    if profile not in {"cloudflare", "cloudflare-oracle"}:
        raise ValueError("Choose cloudflare or cloudflare-oracle")
    if not re.fullmatch(r"[a-z](?:[a-z0-9-]{0,38}[a-z0-9])?", app) or app in {"www", "api", "cdn", "admin", "mail", "auth", "yolo-dev"}:
        raise ValueError("Choose a non-reserved lowercase app slug; operator admission is still required")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repository):
        raise ValueError("Repository must be OWNER/REPO")
    worker = f"yolo-{app}-app" if worker is None else worker
    if not re.fullmatch(r"[a-z](?:[a-z0-9-]{0,61}[a-z0-9])?", worker):
        raise ValueError("Use a supported lowercase Worker name; reconcile the existing identity before provisioning")
    if target.is_symlink() or not target.is_dir():
        raise ValueError("Target must be an existing nonsymlink directory")
    target = target.resolve()
    source = Path(__file__).resolve().parent / "template"
    rendered = {}
    for path in sorted(source.rglob("*")):
        if not path.is_file() or "__pycache__" in path.parts:
            continue
        relative = path.relative_to(source)
        if profile == "cloudflare" and relative.parts[0] == "infra":
            continue
        if profile == "cloudflare" and relative.parts[0] == "hosting" and relative.parts[1] not in {"cloudflare", "HOSTNAME-REQUEST.md", "ONBOARDING.md", "SETUP-GRANT.md"}:
            continue
        rendered[relative] = path.read_text().replace("__APP_SLUG__", app).replace("__REPOSITORY__", repository).replace("__WORKER_NAME__", worker).replace("__BACKEND_ORIGIN__", f"https://api-origin-{app}.yolo-dev.ai" if profile == "cloudflare-oracle" else "").replace("__HOSTING_PROFILE__", profile).replace("__BACKEND_HOSTNAME__", f"api-origin-{app}.yolo-dev.ai" if profile == "cloudflare-oracle" else "not required (edge-only)").encode()
    # Do all conflict/symlink checks before any write. Existing unrelated .gitignore
    # is retained; its hosting patterns must be merged explicitly by the agent.
    for relative, content in rendered.items():
        destination = target / relative
        if relative == Path(".gitignore") and destination.exists():
            continue
        if any((target / parent).is_symlink() for parent in [relative, *relative.parents]):
            raise ValueError("Symlink destination refused")
        if any((target / parent).exists() and not (target / parent).is_dir() for parent in relative.parents):
            raise ValueError("Destination parent is not a directory")
        if destination.exists() and (not destination.is_file() or destination.read_bytes() != content):
            raise ValueError(f"Existing content conflicts: {relative}; reconcile explicitly")
    for relative, content in rendered.items():
        destination = target / relative
        if destination.exists():
            continue
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)
    return {"result": "instantiated", "app": app, "repository": repository, "profile": profile, "worker": worker,
            "files": len(rendered), "template_sha256": hashlib.sha256(b"".join(str(k).encode() + v for k, v in rendered.items())).hexdigest(),
            "cloud_resources_created": False, "namespace_admitted": False,
            "next": "Read hosting/ONBOARDING.md first for complete intake and setup grant; then hosting/cloudflare/INTEGRATION.md. Backend setup also uses hosting/OWNER-SETUP.md. Merge existing .gitignore patterns; keep private files outside source"}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", type=Path)
    parser.add_argument("--app", required=True)
    parser.add_argument("--repository", required=True)
    parser.add_argument("--profile", choices=["cloudflare", "cloudflare-oracle"], default="cloudflare-oracle")
    parser.add_argument("--worker", help="Existing or selected client Worker name; defaults to yolo-APP-app")
    args = parser.parse_args()
    try:
        print(json.dumps(instantiate(args.target, args.app, args.repository, args.profile, args.worker)))
    except (ValueError, OSError) as error:
        parser.exit(1, f"Refused: {error}\n")
