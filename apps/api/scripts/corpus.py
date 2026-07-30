"""Clone or update ChatPRD Lenny transcript corpus."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from app.core.config import get_settings


def main() -> int:
    settings = get_settings()
    dest = settings.corpus_dir
    dest.parent.mkdir(parents=True, exist_ok=True)
    if (dest / ".git").exists():
        print(f"Updating corpus at {dest}")
        subprocess.run(["git", "-C", str(dest), "pull", "--ff-only"], check=False)
    elif dest.exists() and any(dest.iterdir()):
        print(f"Corpus directory exists without git: {dest}")
    else:
        print(f"Cloning {settings.corpus_repo_url} → {dest}")
        subprocess.run(
            ["git", "clone", "--depth", "1", settings.corpus_repo_url, str(dest)],
            check=True,
        )
    episodes = dest / "episodes"
    count = len(list(episodes.glob("*/transcript.md"))) if episodes.exists() else 0
    print(f"Episodes discovered: {count}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
