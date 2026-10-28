#!/usr/bin/env python3
"""Fetch the upstream datasets listed in sources.json at their pinned commits.

Each source is a sparse, shallow git checkout under .cache/sources/<name>, so
re-running is cheap and only the files we use are downloaded.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "sources"


def git(*args, cwd):
    subprocess.run(["git", *args], cwd=cwd, check=True)


def fetch_lfs(dest, src):
    """Git LFS files aren't in a sparse checkout; download them by commit from GitHub's media host."""
    owner_repo = re.search(r"github\.com/(.+?)(?:\.git)?$", src["repo"]).group(1)
    for path in src.get("lfs", []):
        target = dest / path
        if target.exists() and not target.read_bytes()[:40].startswith(b"version https://git-lfs"):
            continue
        url = f"https://media.githubusercontent.com/media/{owner_repo}/{src['commit']}/{path}"
        target.parent.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(url) as r, open(target, "wb") as f:
            shutil.copyfileobj(r, f)
        print(f"  lfs: {path} ({target.stat().st_size // 1_000_000} MB)")


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
    else:
        git("sparse-checkout", "set", "--no-cone", *src["paths"], cwd=dest)
        git("fetch", "-q", "--depth", "1", "--filter=blob:none", "origin", src["commit"], cwd=dest)
        # GIT_LFS_SKIP_SMUDGE: LFS files are fetched separately below.
        subprocess.run(["git", "checkout", "-q", "FETCH_HEAD"], cwd=dest, check=True,
                       env={**os.environ, "GIT_LFS_SKIP_SMUDGE": "1"})
        print(f"{name}: checked out {src['commit'][:10]}")
    fetch_lfs(dest, src)


def main():
    sources = json.loads((ROOT / "scripts" / "sources.json").read_text())
    only = set(sys.argv[1:])
    for name, src in sources.items():
        if name.startswith("_") or (only and name not in only):
            continue
        fetch(name, src)


if __name__ == "__main__":
    main()
