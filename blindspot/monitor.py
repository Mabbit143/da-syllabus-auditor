"""Recurring bounded collection/analysis cycles with durable run ownership."""
import logging
import time

from .analyze import run_analysis
from .worker import run_once, seed
from .search import discover_web, registered_sources
from .synthesis import enqueue_synthesis, run_synthesis, synthesis_due

logger = logging.getLogger("blindspot")


def cycle(store, sources, *, interval=600, max_jobs=3, ask_factory=None, search_factory=None, runner="manual", clock=time.time, collect_pass=run_once, analyze_pass=run_analysis):
    if type(max_jobs) is not int or not 1 <= max_jobs <= 12:
        raise ValueError("A monitor cycle must collect 1–12 jobs")
    run = store.begin_run(clock(), interval, runner)
    if not run:
        return {"state": "not_due_or_busy"}
    collection, analysis = {}, {"completed": 0, "failed": 0, "enabled": False}
    error = None
    try:
        seed(store, [*sources, *registered_sources(store)], clock())
        collection = collect_pass(store, max_jobs, clock=clock)
        if ask_factory:
            enqueue_synthesis(store, clock())
            if synthesis_due(store, clock()):
                patterns = run_synthesis(store, ask_factory(), clock=clock)
                analysis = dict(patterns, completed=0, pattern_completed=patterns["completed"], enabled=True)
            else:
                analysis = dict(analyze_pass(store, ask_factory(), max_jobs=1, clock=clock), enabled=True)
                enqueue_synthesis(store, clock())
        if search_factory:
            discovery = discover_web(store, search_factory(), clock=clock)
            collection["discovery"] = discovery
            collection["discovery_failed"] = int(discovery["state"] in ("failed", "unconfirmed"))
    except Exception as exc:
        logger.error("Monitor run %s failed (%s)", run["id"], type(exc).__name__)
        error = "Collection or analysis pass failed; inspect worker logs and queued jobs"
    state = store.end_run(run["id"], run["token"], clock(), collection, analysis, error)
    logger.info("Monitor run %s %s", run["id"], state)
    return {"id": run["id"], "state": state, "collection": collection, "analysis": analysis}


def watch(store, sources, *, interval=600, max_cycles=None, wait=time.sleep, clock=time.time, runner="verification", **kwargs):
    if type(interval) is not int or not 10 <= interval <= 86400 or (max_cycles is not None and (type(max_cycles) is not int or not 1 <= max_cycles <= 1000)):
        raise ValueError("Invalid recurring worker interval or cycle limit")
    completed, result = 0, None
    while max_cycles is None or completed < max_cycles:
        result = cycle(store, sources, interval=interval, runner=runner, clock=clock, **kwargs)
        if result["state"] != "not_due_or_busy":
            completed += 1
        if max_cycles is not None and completed >= max_cycles:
            break
        state = store.monitor_status()["schedule"]
        due = max(state["next_due"], state["lease_until"] or 0) if state else clock() + interval
        wait(max(1, min(interval, due - clock())))
    return {"cycles": completed, "last": result}
