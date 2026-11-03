"""Code verifies passage provenance; semantic conclusions remain reviewed leads."""
import re
from urllib.parse import urlsplit

from .discovery import is_uo


def report_view(report):
    """Project legacy policy summaries as observations; keep stored history intact."""
    observations = list(report.get("observations", []))
    findings = []
    for item in report.get("findings", []):
        if any(e.get("role") == "action" for e in item.get("evidence", [])):
            findings.append(item)
        else:
            observations.append(dict(item, status="source_observation"))
    return dict(report, recorded_schema_version=report.get("schema_version", 1), findings=findings, observations=observations)


def _normalize(text):
    chars, offsets = [], []
    for match in re.finditer(r"\s+|\S", text):
        value = match.group()
        if value.isspace():
            if chars:
                chars.append(" ")
                offsets.append(match.start())
        else:
            chars.append(value)
            offsets.append(match.start())
    return "".join(chars).rstrip(), offsets


def verify_evidence(proposal, versions):
    if not isinstance(proposal, dict):
        return None
    version_id, quote = proposal.get("version_id"), proposal.get("quote")
    if type(version_id) is not int or not isinstance(quote, str) or proposal.get("role") not in ("policy", "action", "context"):
        return None
    version = next((v for v in versions if v["id"] == version_id), None)
    if version is None:
        return None
    normalized, _ = _normalize(quote.strip())
    if not 12 <= len(normalized) <= 500:
        return None
    page_number = proposal.get("page")
    text, offset = version["text"], 0
    pages = version["metadata"].get("pages", [])
    if page_number is not None:
        if type(page_number) is not int:
            return None
        page = next((p for p in pages if p["page"] == page_number), None)
        if page is None:
            return None
        offset = sum(len(p["text"]) + 2 for p in pages[:pages.index(page)])
        text = page["text"]
    haystack, offsets = _normalize(text)
    start = haystack.find(normalized)
    if start < 0 or haystack.find(normalized, start + 1) >= 0:
        return None
    end = offsets[start + len(normalized) - 1] + 1
    start = offsets[start]
    absolute_start, absolute_end = offset + start, offset + end
    if "visible_ranges" in version and not any(a <= absolute_start and absolute_end <= b for a, b in version["visible_ranges"]):
        return None
    if page_number is None and pages:
        cursor = 0
        for page in pages:
            if cursor <= absolute_start and absolute_end <= cursor + len(page["text"]):
                page_number = page["page"]
                break
            cursor += len(page["text"]) + 2
        if page_number is None:
            return None  # One evidence span must not straddle physical pages.
    return {"version_id": version_id, "url": version["url"], "content_hash": version["content_hash"], "quote": text[start:end], "start": absolute_start, "end": absolute_end, "page": page_number, "role": proposal["role"]}


def source_groups(versions):
    """Conservative publisher/content clusters, never proof of independence."""
    parents = list(range(len(versions)))
    def root(i):
        while parents[i] != i:
            i = parents[i]
        return i
    def publisher(version):
        host = urlsplit(version["url"]).hostname
        return "uoregon.edu" if is_uo(host) else host.removeprefix("www.")
    for i, version in enumerate(versions):
        for j in range(i):
            if version["content_hash"] == versions[j]["content_hash"] or publisher(version) == publisher(versions[j]):
                parents[root(i)] = root(j)
    return len({root(i) for i in range(len(versions))})
