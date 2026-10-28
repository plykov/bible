#!/usr/bin/env python3
"""Fetch the upstream datasets listed in sources.json at their pinned commits.

Each source is a sparse, shallow git checkout under .cache/sources/<name>, so
re-running is cheap and only the files we use are downloaded.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "sources"


def git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def fetch(name, src):
    dest = CACHE / name
    if not (dest / ".git").exists():
        dest.mkdir(parents=True, exist_ok=True)
        git("init", "-q", cwd=dest)
        git("remote", "add", "origin", src["repo"], cwd=dest)
    head = subprocess.run(["git", "rev-parse", "HEAD"], cwd=dest,
                          capture_output=True, text=True).stdout.strip()
    if head == src["commit"]:
        print(f"{name}: up to date at {head[:10]}")
        return
    git("sparse-checkout", "set", "--no-cone", *src["paths"], cwd=dest)
    git("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", src["commit"], cwd=dest)
    git("checkout", "-q", "FETCH_HEAD", cwd=dest)
    print(f"{name}: checked out {src['commit'][:10]}")


def main():
    sources = json.loads((ROOT / "scripts" / "sources.json").read_text())
    only = set(sys.argv[1:])
    for name, src in sources.items():
        if name.startswith("_") or (only and name not in only):
            continue
        fetch(name, src)


if __name__ == "__main__":
    main()
