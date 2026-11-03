"""Evidence-bound owner origin review, never independent-source certification."""
import hashlib
import json
from .evidence import verify_evidence
from .origin_state import reviewed_rows

RELATIONS = ("same_origin", "different_origin", "unresolved")
LIMITS = "Owner assessments of specific passages, not established independent origins. Shared-origin groups and conflict checks cover loaded reviews only. No source count or publication eligibility is certified."


def _checked(store, evidence):
    version = store.get_version(evidence["version_id"])
    if hashlib.sha256(version["text"].encode()).hexdigest() != version["content_hash"]:
        raise ValueError("Saved source hash changed")
    checked = verify_evidence({key: evidence.get(key) for key in ("version_id", "page", "quote", "role")}, [version])
    if not checked or any(checked[key] != evidence.get(key) for key in ("content_hash", "url", "start", "end", "quote")):
        raise ValueError("Origin-review passage did not reverify")
    return checked


def save_origin_review(store, request, *, now):
    from .store import timestamp
    timestamp(now)
    synthesis_id = request.get("synthesis_id")
    left, right, relation = request.get("left_id"), request.get("right_id"), request.get("relation")
    actor, note = request.get("actor"), request.get("note")
    if type(synthesis_id) is not int or synthesis_id < 1 or not all(isinstance(v, str) and 0 < len(v) <= 80 for v in (left, right)) or left == right or relation not in RELATIONS or not isinstance(actor, str) or not 0 < len(actor) <= 200 or not isinstance(note, str) or not note.strip() or len(note) > 1000:
        raise ValueError("Choose two source passages, an origin assessment and a short note")
    with store._db() as db:
        row = db.execute("SELECT report FROM syntheses WHERE id=?", (synthesis_id,)).fetchone()
    if not row:
        raise ValueError("Saved incident analysis does not exist")
    evidence = {e["id"]: e for e in json.loads(row["report"])["evidence"]}
    if left not in evidence or right not in evidence:
        raise ValueError("Origin review must reference this analysis's source passages")
    left, right = sorted((left, right))
    a, b = _checked(store, evidence[left]), _checked(store, evidence[right])
    if relation == "different_origin" and " ".join(a["quote"].split()) == " ".join(b["quote"].split()):
        raise ValueError("Identical passages cannot establish different origins")
    with store._db() as db:
        result = db.execute("INSERT INTO origin_reviews(source_synthesis_id,left_id,right_id,relation,left_receipt,right_receipt,note,actor,created_at) VALUES (?,?,?,?,?,?,?,?,?)", (synthesis_id, left, right, relation, json.dumps(a), json.dumps(b), note.strip(), actor, now))
    return {"saved": True, "id": result.lastrowid}


def origin_summary(store, synthesis):
    ids = [e["id"] for e in synthesis["report"]["evidence"]] if synthesis else []
    rows, history, total, pairs = reviewed_rows(store, ids)
    parents = {key: key for key in ids}
    def root(key):
        while parents[key] != key:
            parents[key] = parents[parents[key]]
            key = parents[key]
        return key
    for row in rows:
        if row["relation"] == "same_origin":
            parents[root(row["left_id"])] = root(row["right_id"])
    groups = {}
    for key in ids:
        groups.setdefault(root(key), []).append(key)
    conflicts = [{"left_id": r["left_id"], "right_id": r["right_id"]} for r in rows if r["relation"] == "different_origin" and root(r["left_id"]) == root(r["right_id"])]
    return {"latest": rows, "history": history, "history_total": total, "history_limit": 200,
            "omitted_latest_pairs": max(0, pairs - len(rows)),
            "same_origin_groups": [group for group in groups.values() if len(group) > 1],
            "conflicts": conflicts, "independent_origin_count": None, "publication_eligible": False,
            "limitations": LIMITS}


def attach_origin_context(store, context):
    rows, _, _, total = reviewed_rows(store, [e["id"] for e in context["evidence"]])
    if not total:
        return context
    result = dict(context, origin_reviews=[], coverage=dict(context["coverage"], origin_review_limit=200, omitted_origin_reviews=total))
    for row in rows:
        review = {key: row[key] for key in ("id", "source_synthesis_id", "left_id", "right_id", "relation", "note")}
        candidate = dict(result, origin_reviews=result["origin_reviews"] + [review])
        candidate["coverage"] = dict(result["coverage"], omitted_origin_reviews=result["coverage"]["omitted_origin_reviews"] - 1)
        if len(json.dumps(candidate)) <= 60000:
            result = candidate
    return result
