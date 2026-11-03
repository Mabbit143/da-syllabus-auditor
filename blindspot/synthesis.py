"""Durable, budgeted Investigator/Skeptic synthesis across source reports."""
import json
import logging
import time

from .analyze import _object
from .budget import ModelBudgetExhausted
from .provider import ResearchProviderError
from .synthesis_input import build_input, digest
from .synthesis_state import complete, latest_synthesis
from .synthesis_contract import INVESTIGATOR, SKEPTIC, proposals, reviewed

logger = logging.getLogger("blindspot")


def enqueue_synthesis(store, now):
    from .store import timestamp
    timestamp(now)
    context = build_input(store)
    if len(context["leads"]) < 2:
        return False
    key = digest(context)
    with store._db() as db:
        if db.execute("SELECT 1 FROM jobs WHERE kind='synthesize' AND (state!='done' OR key=?)", (key,)).fetchone():
            return False
        db.execute("INSERT INTO jobs(kind,key,payload,due,priority) VALUES ('synthesize',?,?,?,10)", (key, json.dumps({"input_hash": key, "context": context}, ensure_ascii=False), now))
    return True


def synthesis_due(store, now):
    with store._db() as db:
        return db.execute("SELECT 1 FROM jobs WHERE kind='synthesize' AND ((state='pending' AND due<=?) OR (state='running' AND lease_until<=?))", (now, now)).fetchone() is not None


def synthesize(context, ask):
    proposed, rejected = proposals(_object(ask(INVESTIGATOR, json.dumps(context, ensure_ascii=False))), context)
    if len(json.dumps(proposed)) > 30000:
        rejected.append("Proposals exceeded the bounded Skeptic context; no incident interpretation retained")
        proposed = {"incidents": [], "patterns": []}
    result = {"incidents": [], "patterns": []}
    if proposed["incidents"]:
        review = _object(ask(SKEPTIC, json.dumps(dict(context, proposals=proposed), ensure_ascii=False)))
        result = reviewed(proposed, review, context, rejected)
    return dict(result, schema_version=1, evidence=context["evidence"], leads=context["leads"], coverage=context["coverage"], rejected_count=len(rejected), rejection_reasons=rejected, limitations="Model-proposed incident identities and mechanisms remain private review leads. Exact quotations establish source text, not the interpretation or independent originating lineages. Historical applicability, copied accounts, unresolved allegations and missing context require review. No pattern is eligible for publication.")


def run_synthesis(store, ask, *, clock=time.time):
    result = {"completed": 0, "failed": 0, "budget_deferred": 0}
    job = store.claim(clock(), 600, kind="synthesize")
    if not job:
        return result
    try:
        start = len(getattr(ask, "calls", []))
        report = synthesize(job["payload"]["context"], ask)
        report["model_calls"] = getattr(ask, "calls", [])[start:]
        complete(store, job, clock(), report)
        result["completed"] = 1
    except ModelBudgetExhausted as exc:
        store.defer(job["id"], job["token"], clock(), exc.next_due)
        result["budget_deferred"] = 1
    except Exception as exc:
        code = exc.code if isinstance(exc, ResearchProviderError) else "invalid_model_json" if isinstance(exc, json.JSONDecodeError) else "invalid_pattern_response"
        logger.error("Pattern job %s failed (%s); no synthesis saved", job["id"], code)
        try:
            store.finish(job["id"], job["token"], clock(), error=f"Pattern analysis failed ({code}); retry later")
        except ValueError:
            logger.error("Pattern job %s lease expired; leaving it available for recovery", job["id"])
        result["failed"] = 1
    return result
