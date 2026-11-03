"""Local worker data adapter. HTTP authorization belongs to the Next server."""
import json
from pathlib import Path
import sys
import time

from .store import Store, timestamp
from .patterns import summarize
from .synthesis_state import latest_synthesis
from .locations import source_locations


def _positive(value, maximum, *, zero=False):
    if type(value) is not int or not (0 if zero else 1) <= value <= maximum:
        raise ValueError("Invalid research document, page or offset")
    return value


def query(store, request, *, now=None):
    action = request.get("action")
    if action == "overview":
        page = _positive(request.get("page", 1), 100000)
        search = request.get("search", "")
        if not isinstance(search, str) or len(search) > 200:
            raise ValueError("Source search is too long")
        pattern = "%" + search.strip() + "%"
        with store._db() as db:
            where = "id IN (SELECT max(id) FROM versions GROUP BY url) AND (url LIKE ? OR metadata LIKE ?)"
            total = db.execute("SELECT count(*) FROM versions WHERE " + where, (pattern, pattern)).fetchone()[0]
            rows = db.execute("SELECT * FROM versions WHERE " + where + " ORDER BY id DESC LIMIT 20 OFFSET ?", (pattern, pattern, (page - 1) * 20)).fetchall()
            reviews = [dict(row) for row in db.execute("SELECT * FROM reviews ORDER BY id DESC LIMIT 500")]
        documents = []
        for row in rows:
            meta = json.loads(row["metadata"])
            documents.append({"id": row["id"], "url": row["url"], "title": meta.get("title") or row["url"], "category": meta.get("category", "unknown"), "method": meta.get("method", "unknown"), "archived_snapshot": bool(meta.get("archived_snapshot")), "original_fetched_date": meta.get("original_fetched_date"), "published_at": meta.get("published_at"), "first_seen": row["first_seen"], "last_seen": row["last_seen"]})
        reports = store.analyses(100)
        return {"status": store.status(), "documents": documents, "page": page, "total_documents": total, "reports": reports, "patterns": summarize(reports, reviews), "synthesis": latest_synthesis(store), "reviews": reviews, "storage": "local-worker", "history_limits": {"reports": 100, "reviews": 500}}
    if action == "document":
        version = store.get_version(_positive(request.get("version_id"), 1000000000))
        start = _positive(request.get("start", 0), 4000000, zero=True)
        if start > len(version["text"]):
            raise ValueError("Requested text position is outside this document")
        with store._db() as db:
            history = [dict(row) for row in db.execute("SELECT id,content_hash,first_seen,last_seen FROM versions WHERE url=? ORDER BY id DESC LIMIT 100", (version["url"],))]
        physical_pages, offset = [], 0
        for page in version["metadata"].get("pages", []):
            end = offset + len(page["text"])
            if start < end and offset < start + 10000:
                physical_pages.append({"page": page["page"], "start": offset, "end": end})
            offset = end + 2
        return {"id": version["id"], "url": version["url"], "content_hash": version["content_hash"], "metadata": {k: v for k, v in version["metadata"].items() if k not in ("pages", "locations")}, "text": version["text"][start:start + 10000], "start": start, "total_characters": len(version["text"]), "physical_pages": physical_pages, "source_locations": source_locations(version["metadata"], [(start, start + 10000)]), "history": history}
    if action == "review":
        report_id = _positive(request.get("report_id"), 1000000000)
        finding_id, actor, note, status = (request.get(key) for key in ("finding_id", "actor", "note", "status"))
        if status not in ("reviewed", "dismissed", "follow_up") or not isinstance(note, str) or not note.strip() or len(note) > 2000 or not isinstance(actor, str) or not actor or len(actor) > 100 or not isinstance(finding_id, str) or not 1 <= len(finding_id) <= 80:
            raise ValueError("A review needs a valid finding, status, owner and note")
        created = time.time() if now is None else timestamp(now)
        with store._db() as db:
            row = db.execute("SELECT report FROM analyses WHERE id=?", (report_id,)).fetchone()
            if not row:
                raise ValueError("Research report does not exist")
            report = json.loads(row["report"])
            if finding_id not in {item.get("id") for item in report.get("findings", []) + report.get("observations", [])}:
                raise ValueError("Finding does not exist in this report")
            review_id = db.execute("INSERT INTO reviews(report_id,finding_id,actor,status,note,created_at) VALUES (?,?,?,?,?,?)", (report_id, finding_id, actor, status, note.strip(), created)).lastrowid
        return {"id": review_id, "saved": True}
    raise ValueError("Unknown research request")


if __name__ == "__main__":
    try:
        path = Path(".blindspot/research.sqlite")
        if not path.is_file():
            raise ValueError("Worker database is not available on this host")
        request = json.loads(sys.stdin.read(16385))
        print(json.dumps(query(Store(path), request), ensure_ascii=False))
    except Exception:
        print("Research storage could not complete the request", file=sys.stderr)
        sys.exit(1)
