"""Persistence for recurring run ownership and model-use accounting."""
import json
import uuid
from datetime import datetime, timezone

SCHEMA = """
CREATE TABLE IF NOT EXISTS monitor_state (
    name TEXT PRIMARY KEY, token TEXT, lease_until REAL,
    next_due REAL NOT NULL, interval INTEGER NOT NULL, runner TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS monitor_runs (
    id INTEGER PRIMARY KEY, token TEXT NOT NULL UNIQUE,
    started_at REAL NOT NULL, finished_at REAL, runner TEXT NOT NULL,
    state TEXT NOT NULL, collection TEXT, analysis TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS model_budget (day TEXT PRIMARY KEY, calls INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS budget_migrations (name TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS model_cache (
    key TEXT PRIMARY KEY, response TEXT NOT NULL, provenance TEXT NOT NULL, created_at REAL NOT NULL
);
"""


def migrate_recorded_calls(db):
    """Include known pre-budget live steps once, without recounting cached steps."""
    marker = "legacy-recorded-model-steps"
    if db.execute("SELECT 1 FROM budget_migrations WHERE name=?", (marker,)).fetchone():
        return
    for row in db.execute("SELECT completed_at,report FROM analyses").fetchall():
        report = json.loads(row["report"])
        steps = report.get("model_calls", [])
        count = sum(isinstance(step, dict) and "cached" not in step and step.get("provider") in ("meta", "baseten") for step in steps)
        if count:
            day = datetime.fromtimestamp(row["completed_at"], timezone.utc).date().isoformat()
            db.execute("INSERT INTO model_budget(day,calls) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET calls=calls+excluded.calls", (day, count))
    db.execute("INSERT INTO budget_migrations(name) VALUES (?)", (marker,))


class MonitorState:
    """Mixed into Store, whose _db supplies committed SQLite transactions."""

    def begin_run(self, now, interval, runner, lease_seconds=3600):
        from .store import timestamp
        timestamp(now)
        if type(interval) is not int or not 10 <= interval <= 86400 or type(lease_seconds) is not int or not 60 <= lease_seconds <= 7200 or runner not in ("manual", "verification", "scheduled"):
            raise ValueError("Invalid monitor interval, lease or runner")
        with self._db() as db:
            state = db.execute("SELECT * FROM monitor_state WHERE name='main'").fetchone()
            if state and state["token"] and state["lease_until"] > now:
                return None
            if state and state["token"]:
                db.execute("UPDATE monitor_runs SET state='interrupted',finished_at=?,error='Worker run lease expired before completion' WHERE token=? AND state='running'", (now, state["token"]))
            elif state and state["next_due"] > now:
                return None
            token = uuid.uuid4().hex
            run_id = db.execute("INSERT INTO monitor_runs(token,started_at,runner,state) VALUES (?,?,?,'running')", (token, now, runner)).lastrowid
            db.execute("INSERT INTO monitor_state(name,token,lease_until,next_due,interval,runner) VALUES ('main',?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET token=excluded.token,lease_until=excluded.lease_until,next_due=excluded.next_due,interval=excluded.interval,runner=excluded.runner", (token, now + lease_seconds, now + interval, interval, runner))
        return {"id": run_id, "token": token}

    def end_run(self, run_id, token, now, collection, analysis, error=None):
        from .store import timestamp
        timestamp(now)
        state_name = "failed" if error else "partial" if collection.get("failed", 0) or collection.get("discovery_failed", 0) or analysis.get("failed", 0) else "completed"
        with self._db() as db:
            state = db.execute("SELECT * FROM monitor_state WHERE name='main' AND token=? AND lease_until>?", (token, now)).fetchone()
            if state is None:
                raise ValueError("Monitor lease expired or belongs to another worker")
            updated = db.execute("UPDATE monitor_runs SET finished_at=?,state=?,collection=?,analysis=?,error=? WHERE id=? AND token=? AND state='running'", (now, state_name, json.dumps(collection), json.dumps(analysis), error, run_id, token))
            if updated.rowcount != 1:
                raise ValueError("Monitor run is no longer active")
            db.execute("UPDATE monitor_state SET token=NULL,lease_until=NULL,next_due=? WHERE name='main'", (now + state["interval"],))
        return state_name

    def run_history(self, limit=20):
        if type(limit) is not int or not 1 <= limit <= 100:
            raise ValueError("Run history limit must be 1–100")
        with self._db() as db:
            rows = db.execute("SELECT id,started_at,finished_at,runner,state,collection,analysis,error FROM monitor_runs ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [dict(row, collection=json.loads(row["collection"]) if row["collection"] else None, analysis=json.loads(row["analysis"]) if row["analysis"] else None) for row in rows]

    def monitor_status(self):
        with self._db() as db:
            state = db.execute("SELECT next_due,interval,runner,lease_until FROM monitor_state WHERE name='main'").fetchone()
            budget = [dict(row) for row in db.execute("SELECT * FROM model_budget ORDER BY day DESC LIMIT 7")]
        return {"schedule": dict(state) if state else None, "runs": self.run_history(), "model_usage": budget}
