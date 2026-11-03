"""Atomic persistence for repeatable cross-report research."""
import json

SCHEMA = """
CREATE TABLE IF NOT EXISTS syntheses (
    id INTEGER PRIMARY KEY,
    job_id INTEGER NOT NULL UNIQUE REFERENCES jobs(id),
    input_hash TEXT NOT NULL,
    completed_at REAL NOT NULL,
    report TEXT NOT NULL
);
"""


def complete(store, job, now, report):
    from .store import timestamp
    timestamp(now)
    with store._db() as db:
        active = db.execute("SELECT id FROM jobs WHERE id=? AND token=? AND kind='synthesize' AND state='running' AND lease_until>?", (job["id"], job["token"], now)).fetchone()
        if active is None:
            raise ValueError("Pattern analysis lease expired or belongs to another worker")
        db.execute("INSERT INTO syntheses(job_id,input_hash,completed_at,report) VALUES (?,?,?,?)", (job["id"], job["payload"]["input_hash"], now, json.dumps(report, ensure_ascii=False, allow_nan=False)))
        db.execute("UPDATE jobs SET state='done',token=NULL,lease_until=NULL,last_error=NULL WHERE id=?", (job["id"],))


def latest_synthesis(store):
    from .synthesis_input import build_input, digest
    with store._db() as db:
        row = db.execute("SELECT * FROM syntheses ORDER BY id DESC LIMIT 1").fetchone()
    return dict(row, report=json.loads(row["report"]), input_current=row["input_hash"] == digest(build_input(store))) if row else None
