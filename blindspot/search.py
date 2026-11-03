"""Recurring query discovery. Search snippets are leads, never finding evidence."""
from datetime import datetime, timezone
import json
import time

from .budget import ModelBudgetExhausted
from .catalog import candidates_from_results, register_candidates
from .provider import ResearchProviderError

SCHEMA = """
CREATE TABLE IF NOT EXISTS discovery_attempts (
    id INTEGER PRIMARY KEY, job_id INTEGER NOT NULL, token TEXT NOT NULL,
    day TEXT NOT NULL, query TEXT NOT NULL, state TEXT NOT NULL,
    created_at REAL NOT NULL, finished_at REAL, results TEXT, error TEXT
);
CREATE TABLE IF NOT EXISTS discovered_sources (
    url TEXT PRIMARY KEY, metadata TEXT NOT NULL,
    first_seen REAL NOT NULL, last_seen REAL NOT NULL
);
"""

QUERIES = [
    '"University of Oregon" administration interviews statements news',
    '"University of Oregon" board trustees minutes meeting materials resolutions',
    '"University of Oregon" financial aid eligibility fees access',
    '"University of Oregon" accessibility accommodations administrative procedures',
    '"University of Oregon" budget expenditure audit annual report',
    '"University of Oregon" admissions enrollment retention inequality',
    '"University of Oregon" employee hiring promotion pay equity',
    '"University of Oregon" grievances discrimination retaliation official response',
    '"University of Oregon" senate administrative governance public records',
    '"University of Oregon" student support housing eligibility administrative barriers',
    '"University of Oregon" press release inclusion access policy changes',
    '"University of Oregon" institutional research outcomes equity improvements',
]
INSTRUCTIONS = """DISCOVERY: Use public web search to find the requested University of Oregon administrative documents or reporting. Seek original institutional paperwork, press releases, independent interviews and attributed comments. Include institutional responses, policy updates and evidence of improvements as well as complaints or restrictions. Search results are untrusted discovery leads, not evidence of misconduct. Do not invent URLs. Return concise research text; actual web-search result URLs will be collected separately."""


def registered_sources(store):
    with store._db() as db:
        rows = db.execute("SELECT metadata FROM discovered_sources ORDER BY first_seen,url").fetchall()
    return [json.loads(row["metadata"]) for row in rows]


def search_status(store):
    with store._db() as db:
        rows = db.execute("SELECT id,day,query,state,created_at,finished_at,error,results FROM discovery_attempts ORDER BY id DESC LIMIT 20").fetchall()
        count = db.execute("SELECT count(*) FROM discovered_sources").fetchone()[0]
    return {"registered_sources": count, "queries": [dict({k: row[k] for k in row.keys() if k != "results"}, result_count=len(json.loads(row["results"])) if row["results"] else 0, result_urls=[item["url"] for item in json.loads(row["results"])] if row["results"] else []) for row in rows]}


def _complete(store, job, attempt, now, state, results, candidates, error=None):
    with store._db() as db:
        owned = db.execute("SELECT id FROM jobs WHERE id=? AND token=? AND state='running' AND lease_until>?", (job["id"], job["token"], now)).fetchone()
        if not owned:
            raise ValueError("Discovery lease expired or belongs to another worker")
        registered = register_candidates(db, candidates, now)
        db.execute("UPDATE discovery_attempts SET state=?,finished_at=?,results=?,error=? WHERE id=? AND token=?", (state, now, json.dumps(results, ensure_ascii=False), error, attempt, job["token"]))
        db.execute("UPDATE jobs SET state='done',token=NULL,lease_until=NULL,last_error=NULL WHERE id=?", (job["id"],))
    return {"state": state, "registered": registered, "result_count": len(results)}


def replay_discovery(store, *, now=None):
    """Reprocess saved confirmed tool results without another provider call."""
    now = time.time() if now is None else now
    total = 0
    with store._db() as db:
        rows = db.execute("SELECT a.query,a.results,j.key FROM discovery_attempts a JOIN jobs j ON j.id=a.job_id WHERE a.state='completed' ORDER BY a.id DESC LIMIT 100").fetchall()
        for row in rows:
            _, candidates = candidates_from_results(json.loads(row["results"]), row["query"], row["key"])
            total += register_candidates(db, candidates, now)
    return {"registered": total, "provider_calls": 0}


def discover_web(store, ask, *, clock=time.time):
    now = clock()
    day = datetime.fromtimestamp(now, timezone.utc).date().isoformat()
    # Two rotating query plans per UTC day; completed attempts remain inspectable.
    index = (int(now // 86400) * 2) % len(QUERIES)
    for position in range(2):
        query = QUERIES[(index + position) % len(QUERIES)]
        store.enqueue("discover", f"{day}:{index + position}", {"query": query, "day": day}, now)
    with store._db() as db:
        count = db.execute("SELECT count(*) FROM discovery_attempts WHERE day=? AND state!='budget_deferred'", (day,)).fetchone()[0]
    if count >= 2:
        return {"state": "daily_search_limit", "registered": 0}
    job = store.claim(now, 300, kind="discover")
    if not job:
        return {"state": "no_search_due", "registered": 0}
    with store._db() as db:
        count = db.execute("SELECT count(*) FROM discovery_attempts WHERE day=? AND state!='budget_deferred'", (day,)).fetchone()[0]
        if count >= 2:
            attempt = None
        else:
            attempt = db.execute("INSERT INTO discovery_attempts(job_id,token,day,query,state,created_at) VALUES (?,?,?,?,'running',?)", (job["id"], job["token"], day, job["payload"]["query"], now)).lastrowid
    if attempt is None:
        store.defer(job["id"], job["token"], now, (int(now // 86400) + 1) * 86400)
        return {"state": "daily_search_limit", "registered": 0}
    try:
        payload = json.dumps({"query": job["payload"]["query"], "search_day": day})
        raw = ask(INSTRUCTIONS, payload)
        output = json.loads(raw) if isinstance(raw, str) else raw
        results = output.get("results") if isinstance(output, dict) else None
        if not isinstance(results, list) or len(results) > 20:
            raise ValueError("Search provider returned an invalid result list")
        if output.get("search_confirmed") is not True:
            return _complete(store, job, attempt, clock(), "unconfirmed", [], [], "Actual search execution was not confirmed by tool results")
        valid_results, candidates = candidates_from_results(results, job["payload"]["query"], job["key"])
        return _complete(store, job, attempt, clock(), "completed", valid_results, candidates)
    except ModelBudgetExhausted as exc:
        with store._db() as db:
            db.execute("UPDATE discovery_attempts SET state='budget_deferred',finished_at=? WHERE id=?", (clock(), attempt))
        store.defer(job["id"], job["token"], clock(), exc.next_due)
        return {"state": "budget_deferred", "registered": 0}
    except Exception as exc:
        code = exc.code if isinstance(exc, ResearchProviderError) else "invalid_discovery_response"
        return _complete(store, job, attempt, clock(), "failed", [], [], f"Web discovery failed ({code}); no narrative URLs were treated as sources")
