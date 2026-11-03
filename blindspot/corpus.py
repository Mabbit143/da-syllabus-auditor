"""Import dated, saved UO web text; never silently treat it as current web evidence."""
from datetime import date
from pathlib import Path
import re
from urllib.parse import urlsplit

from .discovery import is_uo
from .fetch import canonical_url


def import_corpus(store, directory, now):
    root = Path(directory)
    if not root.is_dir():
        raise ValueError("Saved UO web corpus directory is missing")
    result = {"imported": 0, "skipped": 0, "failed": 0, "errors": []}
    # Deliberately non-recursive: legacy OCR in pdf/ has a different review contract.
    for file in sorted(root.glob("*.md")):
        if file.is_symlink():
            result["skipped"] += 1
            continue
        try:
            raw = file.read_text(encoding="utf-8-sig")
            match = re.search(r"^Source: (https://\S+)\s*$", raw, re.M)
            fetched = re.search(r"^Fetched: (\d{4}-\d{2}-\d{2})\s*$", raw, re.M)
            marker = re.search(r"^Found from: ([^\n]*)\r?\n\r?\n", raw, re.M)
            if not match or not fetched or not marker:
                raise ValueError("Missing source, original fetch date, or web body marker")
            url = canonical_url(match[1])
            if not is_uo(urlsplit(url).hostname):
                raise ValueError("Saved web source is outside UO")
            date.fromisoformat(fetched[1])
            if store.history(url):
                # A historical import never supersedes an already observed source.
                result["skipped"] += 1
                continue
            text = raw[marker.end():].strip()
            title = raw.splitlines()[0].removeprefix("# ")
            metadata = {"title": title, "category": "policy", "publisher": "University of Oregon", "method": "saved-web-text", "archived_snapshot": True, "original_fetched_date": fetched[1], "published_at": None, "discovered_from": marker[1].strip(), "corpus_file": file.name, "coverage": "saved web text; not re-fetched at import"}
            version_id = store.snapshot(url, text, metadata, now)
            store.enqueue("analyze", str(version_id), {"version_id": version_id, "url": url}, now)
            result["imported"] += 1
        except (ValueError, OSError, UnicodeError) as exc:
            result["failed"] += 1
            result["errors"].append({"file": file.name, "error": str(exc)})
    return result
