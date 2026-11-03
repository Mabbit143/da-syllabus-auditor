"""Bounded collection passes; callers invoke periodically with durable storage."""
import logging
import time
from urllib.parse import urlsplit

from .collect import collect
from .fetch import canonical_url
from .store import timestamp
from .discovery import discover, RobotsRules
from .fetch import fetch_public

logger = logging.getLogger("blindspot")


def seed(store, sources, now, interval=86400):
    timestamp(now)
    if type(interval) is not int or interval < 60:
        raise ValueError("Collection interval must be at least 60 seconds")
    period = int(now // interval)
    for source in sources:
        url = canonical_url(source["url"])
        store.enqueue("collect", f"{url}:{interval}:{period}", dict(source, url=url), now, priority=source.get("collection_priority", 0))


def run_once(store, max_jobs=10, *, clock=time.time, collector=collect):
    if type(max_jobs) is not int or not 1 <= max_jobs <= 100:
        raise ValueError("Collection pass must process 1–100 jobs")
    result = {"processed": 0, "collected": 0, "failed": 0, "discovered": 0, "deferred": 0, "review_pending": 0, "incomplete": 0}
    rules = RobotsRules() if collector is collect else None
    for _ in range(max_jobs):
        job = store.claim(clock(), 600, kind="collect")
        if not job:
            break
        result["processed"] += 1
        try:
            if rules:
                delay = rules.check(job["payload"]["url"])
                now = clock()
                available = store.reserve_host(urlsplit(job["payload"]["url"]).hostname, now, delay)
                if available > now:
                    store.defer(job["id"], job["token"], now, available)
                    result["deferred"] += 1
                    continue
                document = collector(store, job["payload"], clock(), fetch=lambda url: fetch_public(url, before_fetch=rules.check))
            else:
                document = collector(store, job["payload"], clock())
            if document.get("needs_review"):
                store.finish(job["id"], job["token"], clock())
                result["review_pending"] += 1
                continue
            if document.get("analysis_ready") is False:
                result["incomplete"] += 1
            else:
                store.enqueue("analyze", str(document["version_id"]), {"version_id": document["version_id"], "url": document["url"]}, clock(), priority=10)
            children = discover(dict(job["payload"], url=document["url"]), document["links"], max_links=min(10, 30 - result["discovered"]), history=store.collection_history())
            seed(store, children, clock())
            result["discovered"] += len(children)
            store.finish(job["id"], job["token"], clock())
            result["collected"] += 1
        except Exception as exc:
            # Never log source bodies or provider credentials.
            error = str(exc)[:1000] or type(exc).__name__
            logger.error("Collection job %s failed: %s", job["id"], error)
            try:
                store.finish(job["id"], job["token"], clock(), error=error)
            except ValueError:
                logger.error("Collection job %s lease expired; leaving it available for recovery", job["id"])
            result["failed"] += 1
    return result
