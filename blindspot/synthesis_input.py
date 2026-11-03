"""Bounded immutable-evidence inputs for cross-report incident research."""
import hashlib
import json


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def build_input(store):
    reports = store.analyses(100)
    with store._db() as db:
        reviews = [dict(row) for row in db.execute("SELECT report_id,finding_id,status,id FROM reviews WHERE id IN (SELECT max(id) FROM reviews GROUP BY report_id,finding_id)")]
    latest = {(r["report_id"], r["finding_id"]): r for r in reviews}
    versions, evidence, leads = {}, {}, []
    omitted = invalid = 0
    for record in reports:
        for finding in record["report"].get("findings", []):
            review = latest.get((record["id"], finding["id"]))
            if review and review["status"] == "dismissed":
                continue
            if len(leads) >= 24:
                omitted += 1
                continue
            supplied, bad = {}, False
            counter = finding.get("skeptic", {}).get("counterevidence", [])
            for item in finding.get("evidence", []) + counter:
                try:
                    version_id = item["version_id"]
                    if version_id not in versions:
                        versions[version_id] = store.get_version(version_id)
                    version = versions[version_id]
                    start, end = item["start"], item["end"]
                    if type(start) is not int or type(end) is not int or not 0 <= start < end <= len(version["text"]) or not 12 <= len(" ".join(item["quote"].split())) <= 500 or version["text"][start:end] != item["quote"] or version["content_hash"] != item["content_hash"] or version["url"] != item["url"] or item["role"] not in ("policy", "action", "context"):
                        raise ValueError("Saved source locator did not verify")
                    if "admitted_ranges" in version["metadata"] and not any(a <= start and end <= b for a, b in version["metadata"]["admitted_ranges"]):
                        raise ValueError("Saved evidence spans an unreviewed fragment gap")
                    key = "e" + digest([version_id, item["content_hash"], start, end, item["role"]])[:20]
                    supplied[key] = {"id": key, **item, "context": version["text"][max(0, start - 200):min(len(version["text"]), end + 200)], "metadata": {k: version["metadata"].get(k) for k in ("title", "published_at", "archived_snapshot", "original_fetched_date", "category", "method", "coverage", "missing_formula_values")}}
                except (KeyError, TypeError, ValueError):
                    bad = True
                    break
            if bad or not any(e["role"] == "action" for e in supplied.values()):
                invalid += 1
                continue
            if len(set(evidence) | set(supplied)) > 64:
                omitted += 1
                continue
            lead = {"id": f"r{record['id']}:{finding['id']}", "report_id": record["id"], "finding_id": finding["id"], "claim": finding["claim"], "topic": finding.get("topic", ""), "mechanism": finding.get("mechanism", ""), "status": finding["status"], "temporal_scope": finding.get("temporal_scope", "unknown"), "questions": finding.get("questions", []), "skeptic": {k: finding.get("skeptic", {}).get(k) for k in ("reason", "counterevidence_search", "alternative_explanations", "temporal_scope")}, "evidence_ids": list(supplied), "owner_review": review}
            # ASCII-encoded length conservatively bounds the bridge's JS string
            # length even for non-BMP characters. Reserve space for coverage and
            # the second step's proposals; skip whole leads, never partial quotes.
            if len(json.dumps({"leads": leads + [lead], "evidence": list((evidence | supplied).values())})) > 59000:
                omitted += 1
                continue
            evidence.update(supplied)
            leads.append(lead)
    return {"schema_version": 1, "leads": leads, "evidence": list(evidence.values()), "coverage": {"recent_reports": len(reports), "report_limit": 100, "lead_limit": 24, "evidence_limit": 64, "context_character_limit": 60000, "omitted_leads": omitted, "invalid_evidence_leads": invalid, "note": "Only saved verified passages and nearby context, not a full-corpus review. Owner reviews do not establish independent origins."}}
