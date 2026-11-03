"""Conservative extraction-quality checks; eligibility is not completeness proof."""
import json


class SourceTextUnavailable(ValueError):
    pass


def assess_text(text, metadata, *, character_count=None):
    count = len(text) if character_count is None else character_count
    headline = False
    if metadata.get("method") == "html" and 0 < count <= 1000:
        body = " ".join(text.split()).casefold()
        title = " ".join((metadata.get("title") or "").split()).casefold()
        headline = bool(body and title and body in title)
    if headline or metadata.get("quality_state") == "headline_only":
        return {"state": "headline_only", "analysis_ready": False, "note": "Only heading text was extracted; article/body content is unavailable in this snapshot. Analysis is deferred."}
    if not count or metadata.get("analysis_ready") is False:
        return {"state": "incomplete", "analysis_ready": False, "note": "This snapshot lacks analysis-ready source text."}
    return {"state": "extracted_text", "analysis_ready": True, "note": "Saved extractor output is available; document completeness and claim support still require review."}


def skip_analysis(store, job, now):
    with store._db() as db:
        result = db.execute("UPDATE jobs SET state='skipped',token=NULL,lease_until=NULL,last_error=NULL WHERE id=? AND kind='analyze' AND state='running' AND token=? AND lease_until>?", (job["id"], job["token"], now))
        if result.rowcount != 1:
            raise ValueError("Analysis lease expired or belongs to another worker")


def coverage_summary(store):
    with store._db() as db:
        rows = db.execute("""SELECT v.id,v.url,
            json_extract(v.metadata,'$.title','$.category','$.method','$.archived_snapshot','$.analysis_ready','$.quality_state') AS attributes,
            length(c.text) AS characters, CASE WHEN length(c.text)<=1000 THEN c.text ELSE '' END AS short_text
            FROM versions v JOIN content c ON c.hash=v.content_hash
            WHERE v.id IN (SELECT max(id) FROM versions GROUP BY url) ORDER BY v.id""").fetchall()
    categories, headlines, archived = {}, [], 0
    for row in rows:
        title, category, method, historical, ready, state = json.loads(row["attributes"])
        quality = assess_text(row["short_text"], {"title": title, "method": method, "analysis_ready": ready, "quality_state": state}, character_count=row["characters"])
        counts = categories.setdefault(category or "unknown", {"documents": 0, "analysis_ready": 0, "headline_only": 0, "archived": 0})
        counts["documents"] += 1
        counts["analysis_ready"] += int(quality["analysis_ready"])
        counts["headline_only"] += int(quality["state"] == "headline_only")
        counts["archived"] += int(bool(historical))
        archived += int(bool(historical))
        if quality["state"] == "headline_only":
            headlines.append({"version_id": row["id"], "url": row["url"], "title": title or row["url"]})
    return {"total_documents": len(rows), "archived_snapshots": archived, "headline_only": len(headlines), "categories": categories, "headline_examples": headlines[:20], "note": "Counts cover latest saved URLs. Categories are intake labels, not verified document types. Analysis-ready means extracted text is available, not full-document coverage or a supported finding. Failed/blocked URLs and unapproved scans are tracked separately."}
