"""Convert actual tool results into fetch candidates, retaining scope uncertainty."""
import json
import re
from urllib.parse import unquote, urlsplit

from .discovery import is_uo
from .fetch import canonical_url


def candidates_from_results(results, query, query_key):
    candidates, seen, valid = [], set(), []
    for item in results:
        if not isinstance(item, dict) or not isinstance(item.get("snippet"), str) or len(item["snippet"]) > 4000:
            continue
        try:
            url = canonical_url(item.get("url"))
        except (ValueError, TypeError):
            continue
        valid.append({"url": url, "snippet": item["snippet"]})
        host = urlsplit(url).hostname
        scoped = bool(is_uo(host) or re.search(r"university[\s/_-]+of[\s/_-]+oregon|uoregon", unquote(url) + " " + item["snippet"], re.I))
        # Some real Meta result entries have no snippet at all. Retain those
        # as explicitly unverified candidates; the publisher document must be read.
        if url in seen or (not scoped and item["snippet"].strip()):
            continue
        seen.add(url)
        category = "policy" if host == "policies.uoregon.edu" else "press_release" if host in ("news.uoregon.edu", "around.uoregon.edu") else "administration" if is_uo(host) else "external_record" if host.endswith(".gov") else "news"
        candidates.append({"url": url, "publisher": host, "category": category, "discovered_from": "web-search:" + query, "discovery_query": query_key, "relevance_unverified": not scoped, "collection_priority": 5})
    return valid, candidates


def register_candidates(db, candidates, now):
    registered = 0
    for source in candidates:
        url = source["url"]
        if db.execute("SELECT 1 FROM discovered_sources WHERE url=?", (url,)).fetchone() is None:
            registered += 1
        encoded = json.dumps(source, ensure_ascii=False)
        db.execute("INSERT INTO discovered_sources(url,metadata,first_seen,last_seen) VALUES (?,?,?,?) ON CONFLICT(url) DO UPDATE SET metadata=excluded.metadata,last_seen=excluded.last_seen", (url, encoded, now, now))
        key = f"{url}:86400:{int(now // 86400)}"
        db.execute("INSERT INTO jobs(kind,key,payload,due,priority) VALUES ('collect',?,?,?,5) ON CONFLICT(kind,key) DO UPDATE SET priority=max(jobs.priority,excluded.priority)", (key, encoded, now))
    return registered
