"""Bounded public document discovery and per-publisher crawler rules."""
from urllib.parse import urlsplit, unquote
from urllib.robotparser import RobotFileParser

from .fetch import canonical_url, fetch_public, SourceHTTPError
from .embeds import trusted_story

USER_AGENT = "BlindspotEngine"


def is_uo(host):
    return host == "uoregon.edu" or host.endswith(".uoregon.edu")


def discover(source, links, *, max_links=10, max_depth=2, history=None):
    if type(max_links) is not int or not 0 <= max_links <= 100:
        raise ValueError("Discovery limit must be 0–100")
    depth = source.get("depth", 0)
    if type(depth) is not int or depth < 0:
        raise ValueError("Invalid discovery depth")
    if depth >= max_depth or max_links == 0:
        return []
    parent = canonical_url(source["url"])
    parent_host = urlsplit(parent).hostname
    terms = source.get("discovery_terms", ["university-of-oregon", "university-oregon", "uoregon"])
    history = history or {}
    found, seen = [], {parent}
    for candidate in links:
        try:
            url = canonical_url(candidate)
            parsed = urlsplit(url)
            path = unquote(parsed.path).lower()
            if url in seen or parsed.query:
                continue
            seen.add(url)
            if path.endswith((".ics", ".jpg", ".jpeg", ".png", ".svg", ".mp4", ".mp3", ".zip", ".css", ".js")):
                continue
            if any(part in {"login", "logout", "user", "search", "subscribe", "donate"} for part in path.split("/")):
                continue
            embedded = url in source.get("embedded_documents", []) and trusted_story(parent, url)
            if is_uo(parent_host):
                if not is_uo(parsed.hostname) and not embedded:
                    continue
            elif parsed.hostname != parent_host or not any(term.lower() in path for term in terms):
                continue
            if history.get(url, {}).get("active"):
                continue
            child = dict(source, url=url, discovered_from=parent, depth=depth + 1)
            # A curated source's analysis order does not endorse every link.
            child.pop("analysis_priority", None)
            child.pop("embedded_documents", None)
            child.pop("embedded_from", None)
            if parsed.hostname != parent_host:
                child["publisher"] = "University of Oregon"
                child["category"] = source.get("category", "press_release") if embedded else "policy" if parsed.hostname == "policies.uoregon.edu" else "administration"
                if embedded:
                    child["embedded_from"] = parent
            found.append(child)
        except (ValueError, TypeError):
            continue
    # Job IDs give durable scheduling order without treating fetch dates as
    # document dates. Stable sorting preserves page order among unseen links.
    found.sort(key=lambda child: history.get(child["url"], {}).get("last_job", 0))
    return found[:max_links]


class RobotsRules:
    def __init__(self, *, fetch=fetch_public):
        self.fetch = fetch
        self.cache = {}

    def check(self, url):
        parsed = urlsplit(canonical_url(url))
        origin = f"https://{parsed.netloc}"
        if origin not in self.cache:
            parser = RobotFileParser(origin + "/robots.txt")
            try:
                response = self.fetch(origin + "/robots.txt", max_bytes=256 * 1024, timeout=15)
                parser.parse(response["body"].decode("utf8", errors="replace").splitlines())
            except SourceHTTPError as exc:
                if exc.status in (404, 410):
                    parser.parse([])
                elif exc.status in (401, 403):
                    parser.parse(["User-agent: *", "Disallow: /"])
                else:
                    raise ValueError("Could not check publisher robots rules; retry later") from exc
            self.cache[origin] = parser
        parser = self.cache[origin]
        if not parser.can_fetch(USER_AGENT, url):
            raise ValueError("Publisher robots rules disallow this document")
        delay = max(2, parser.crawl_delay(USER_AGENT) or 0)
        rate = parser.request_rate(USER_AGENT)
        if rate and rate.requests > 0:
            delay = max(delay, rate.seconds / rate.requests)
        return delay
