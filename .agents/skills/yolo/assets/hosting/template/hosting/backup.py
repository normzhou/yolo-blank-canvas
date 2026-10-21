#!/usr/bin/env python3
"""Encrypt a quiesced app directory; restore only to a new sibling for inspection."""
import argparse
import os
from pathlib import Path
import shutil
import subprocess
import tarfile
import tempfile


def main():
    p = argparse.ArgumentParser(description=__doc__)
    sub = p.add_subparsers(dest="command", required=True)
    b = sub.add_parser("backup")
    b.add_argument("directory", type=Path)
    b.add_argument("output", type=Path)
    b.add_argument("--recipient", required=True)
    b.add_argument("--quiesced", action="store_true", required=True)
    r = sub.add_parser("restore")
    r.add_argument("archive", type=Path)
    r.add_argument("destination", type=Path)
    r.add_argument("--identity", required=True)
    args = p.parse_args()
    os.umask(0o077)
    age = os.environ.get("YOLO_AGE", "age")
    if subprocess.check_output([age, "--version"], text=True).strip().lstrip("v") != "1.3.2":
        p.error("Use reviewed age 1.3.2")
    # Stage on the owner's encrypted local disk, never the public checkout.
    with tempfile.TemporaryDirectory(prefix="yolo-backup-") as d:
        archive = Path(d) / "data.tar"
        if args.command == "backup":
            if not args.directory.is_dir() or args.output.exists():
                p.error("Source must exist; encrypted destination must be new")
            # Avoid archiving outside data via links or special device entries.
            for item in args.directory.rglob("*"):
                if item.is_symlink() or not (item.is_file() or item.is_dir()):
                    p.error("Only regular files/directories are admitted")
            with tarfile.open(archive, "w") as tar:
                tar.add(args.directory, arcname="data", recursive=True)
            subprocess.run([age, "-r", args.recipient, "-o", str(args.output), str(archive)], check=True)
        else:
            if args.destination.exists():
                p.error("Restore destination must be new; live data is never overwritten")
            subprocess.run([age, "-d", "-i", args.identity, "-o", str(archive), str(args.archive)], check=True)
            with tarfile.open(archive) as tar:
                members = tar.getmembers()
                for m in members:
                    parts = Path(m.name).parts
                    if not parts or parts[0] != "data" or ".." in parts or m.name.startswith("/") or not (m.isfile() or m.isdir()):
                        p.error("Unsafe archive member refused")
                # New private staging path; validated regular entries only.
                tar.extractall(path=d, members=members)
            shutil.move(str(Path(d) / "data"), args.destination)
            args.destination.chmod(0o700)
    print("Done. Verify application consistency/schema before selecting restored data.")


if __name__ == "__main__":
    main()
