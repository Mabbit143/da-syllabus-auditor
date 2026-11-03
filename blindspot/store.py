"""Durable document history and transactional, fenced collection jobs.

Times are UTC Unix seconds supplied by the worker, making retries deterministic.
Each operation opens its own connection so worker processes share no connections.
"""
from contextlib import contextmanager
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import uuid
from .monitor_state import MonitorState, SCHEMA as MONITOR_SCHEMA, migrate_recorded_calls
from .search import SCHEMA as SEARCH_SCHEMA, search_status


SCHEMA = """
CREATE TABLE IF NOT EXISTS content (
    hash TEXT PRIMARY KEY,
    text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS versions (
    id INTEGER PRIMARY KEY,
    url TEXT NOT NULL,
    content_hash TEXT NOT NULL REFERENCES content(hash),
    metadata TEXT NOT NULL,
    first_seen REAL NOT NULL,
    last_seen REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS versions_url ON versions(url, id);
CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY,
    kind TEXT NOT NULL,
    key TEXT NOT NULL,
    payload TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'pending',
    due REAL NOT NULL,
    token TEXT,
    lease_until REAL,
    attempts INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    UNIQUE(kind, key)
);
CREATE TABLE IF NOT EXISTS host_slots (
    host TEXT PRIMARY KEY,
    next_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS analyses (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
    completed_at REAL NOT NULL,
    report TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY,
    report_id INTEGER NOT NULL REFERENCES analyses(id),
    finding_id TEXT NOT NULL,
    actor TEXT NOT NULL,
    status TEXT NOT NULL,
    note TEXT NOT NULL,
    created_at REAL NOT NULL
);
"""


def timestamp(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ValueError("Expected a finite UTC timestamp")
    return value


SCHEMA += MONITOR_SCHEMA + SEARCH_SCHEMA


class Store(MonitorState):
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self._db() as db:
            db.executescript(SCHEMA)
            db.execute("BEGIN IMMEDIATE")
            columns = {row["name"] for row in db.execute("PRAGMA table_info(jobs)")}
            if "priority" not in columns:
                db.execute("ALTER TABLE jobs ADD COLUMN priority INTEGER NOT NULL DEFAULT 0")
                db.execute("UPDATE jobs SET priority=10 WHERE kind='analyze' AND CAST(json_extract(payload,'$.version_id') AS INTEGER) IN (SELECT id FROM versions WHERE coalesce(json_extract(metadata,'$.archived_snapshot'),0)=0)")
            migrate_recorded_calls(db)

    @contextmanager
    def _db(self):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA foreign_keys = ON")
            db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except BaseException:
            db.rollback()
            raise
        finally:
            db.close()

    def snapshot(self, url, text, metadata, now):
        """Append a version only on change; retain provenance per source URL."""
        timestamp(now)
        if not isinstance(url, str) or not url.strip():
            raise ValueError("Document URL is required")
        if not isinstance(text, str) or not text.strip():
            raise ValueError("Document has no readable text")
        if not isinstance(metadata, dict):
            raise ValueError("Document metadata must be an object")
        encoded = json.dumps(metadata, ensure_ascii=False, allow_nan=False)
        digest = hashlib.sha256(text.encode("utf8")).hexdigest()
        with self._db() as db:
            previous = db.execute("SELECT * FROM versions WHERE url=? ORDER BY id DESC LIMIT 1", (url,)).fetchone()
            if previous and now < previous["last_seen"]:
                raise ValueError("Observation predates the latest source observation")
            if previous and previous["content_hash"] == digest:
                db.execute("UPDATE versions SET last_seen=? WHERE id=?", (now, previous["id"]))
                return previous["id"]
            db.execute("INSERT OR IGNORE INTO content(hash,text) VALUES (?,?)", (digest, text))
            return db.execute(
                "INSERT INTO versions(url,content_hash,metadata,first_seen,last_seen) VALUES (?,?,?,?,?)",
                (url, digest, encoded, now, now),
            ).lastrowid

    def history(self, url):
        with self._db() as db:
            rows = db.execute(
                "SELECT v.*,c.text FROM versions v JOIN content c ON c.hash=v.content_hash WHERE url=? ORDER BY v.id",
                (url,),
            ).fetchall()
        return [dict(row, metadata=json.loads(row["metadata"])) for row in rows]

    def get_version(self, version_id):
        with self._db() as db:
            row = db.execute("SELECT v.*,c.text FROM versions v JOIN content c ON c.hash=v.content_hash WHERE v.id=?", (version_id,)).fetchone()
        if row is None:
            raise ValueError("Research document version does not exist")
        return dict(row, metadata=json.loads(row["metadata"]))

    def latest_versions(self):
        with self._db() as db:
            rows = db.execute("SELECT v.*,c.text FROM versions v JOIN content c ON c.hash=v.content_hash WHERE v.id IN (SELECT max(id) FROM versions GROUP BY url) ORDER BY v.id").fetchall()
        return [dict(row, metadata=json.loads(row["metadata"])) for row in rows]

    def complete_analysis(self, job_id, token, now, report):
        timestamp(now)
        encoded = json.dumps(report, ensure_ascii=False, allow_nan=False)
        with self._db() as db:
            job = db.execute("SELECT id FROM jobs WHERE id=? AND token=? AND kind='analyze' AND state='running' AND lease_until>?", (job_id, token, now)).fetchone()
            if job is None:
                raise ValueError("Analysis lease expired or belongs to another worker")
            db.execute("INSERT INTO analyses(job_id,completed_at,report) VALUES (?,?,?)", (job_id, now, encoded))
            db.execute("UPDATE jobs SET state='done',token=NULL,lease_until=NULL,last_error=NULL WHERE id=?", (job_id,))

    def analyses(self, limit=100):
        from .evidence import report_view
        if type(limit) is not int or not 1 <= limit <= 1000:
            raise ValueError("Analysis report limit must be 1–1000")
        with self._db() as db:
            rows = db.execute("SELECT * FROM analyses ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row, report=report_view(json.loads(row["report"]))) for row in rows]

    def enqueue(self, kind, key, payload, due, *, priority=0):
        """Idempotent per work key. Use a new key for each scheduled occurrence."""
        timestamp(due)
        if not isinstance(kind, str) or not kind or not isinstance(key, str) or not key:
            raise ValueError("Job kind and work key are required")
        if not isinstance(payload, dict):
            raise ValueError("Job payload must be an object")
        if type(priority) is not int or not 0 <= priority <= 100:
            raise ValueError("Job priority must be 0–100")
        encoded = json.dumps(payload, allow_nan=False)
        with self._db() as db:
            db.execute("INSERT OR IGNORE INTO jobs(kind,key,payload,due,priority) VALUES (?,?,?,?,?)", (kind, key, encoded, due, priority))
            return db.execute("SELECT id FROM jobs WHERE kind=? AND key=?", (kind, key)).fetchone()["id"]

    def claim(self, now, lease_seconds, *, kind=None):
        timestamp(now)
        if isinstance(lease_seconds, bool) or not isinstance(lease_seconds, int) or not 1 <= lease_seconds <= 3600:
            raise ValueError("Job lease must be 1–3600 seconds")
        with self._db() as db:
            row = db.execute(
                "SELECT * FROM jobs WHERE ((state='pending' AND due<=?) OR (state='running' AND lease_until<=?)) AND (? IS NULL OR kind=?) ORDER BY priority DESC,due,id LIMIT 1",
                (now, now, kind, kind),
            ).fetchone()
            if row is None:
                return None
            token = uuid.uuid4().hex
            until = now + lease_seconds
            db.execute("UPDATE jobs SET state='running',token=?,lease_until=?,attempts=attempts+1 WHERE id=?", (token, until, row["id"]))
            result = dict(row, token=token, lease_until=until, state="running", attempts=row["attempts"] + 1)
            result["payload"] = json.loads(result["payload"])
            return result

    def status(self):
        with self._db() as db:
            counts = [dict(row) for row in db.execute("SELECT kind,state,count(*) AS count FROM jobs GROUP BY kind,state")]
            failures = [dict(row) for row in db.execute("SELECT id,kind,key,last_error,due,attempts FROM jobs WHERE last_error IS NOT NULL ORDER BY id DESC LIMIT 20")]
            documents = db.execute("SELECT count(DISTINCT url) FROM versions").fetchone()[0]
            versions = db.execute("SELECT count(*) FROM versions").fetchone()[0]
            analysis = db.execute("SELECT count(*) AS count,max(completed_at) AS latest FROM analyses").fetchone()
        return {"documents": documents, "versions": versions, "jobs": counts, "failures": failures, "analysis_reports": analysis["count"], "latest_analysis_at": analysis["latest"], "monitor": self.monitor_status(), "discovery": search_status(self)}

    def reserve_host(self, host, now, delay):
        timestamp(now)
        timestamp(delay)
        if delay < 2 or delay > 86400:
            raise ValueError("Publisher crawl interval must be 2–86400 seconds")
        with self._db() as db:
            previous = db.execute("SELECT next_at FROM host_slots WHERE host=?", (host,)).fetchone()
            if previous and previous["next_at"] > now:
                return previous["next_at"]
            db.execute("INSERT INTO host_slots(host,next_at) VALUES (?,?) ON CONFLICT(host) DO UPDATE SET next_at=excluded.next_at", (host, now + delay))
        return now

    def defer(self, job_id, token, now, due):
        timestamp(now)
        timestamp(due)
        if due <= now:
            raise ValueError("Deferred job must become due in the future")
        with self._db() as db:
            result = db.execute("UPDATE jobs SET state='pending',due=?,token=NULL,lease_until=NULL,attempts=attempts-1 WHERE id=? AND token=? AND state='running' AND lease_until>?", (due, job_id, token, now))
            if result.rowcount != 1:
                raise ValueError("Job lease expired or belongs to another worker")

    def finish(self, job_id, token, now, error=None):
        """Reject stale completion; failed jobs retain the error and retry later."""
        timestamp(now)
        if error is not None and (not isinstance(error, str) or not error.strip()):
            raise ValueError("Failure needs a readable error")
        with self._db() as db:
            job = db.execute(
                "SELECT * FROM jobs WHERE id=? AND token=? AND state='running' AND lease_until>?",
                (job_id, token, now),
            ).fetchone()
            if job is None:
                raise ValueError("Job lease expired or belongs to another worker")
            delay = min(3600, 30 * 2 ** min(job["attempts"] - 1, 7))
            db.execute(
                "UPDATE jobs SET state=?,due=?,token=NULL,lease_until=NULL,last_error=? WHERE id=?",
                ("pending" if error else "done", now + delay if error else now, error[:1000] if error else None, job_id),
            )
