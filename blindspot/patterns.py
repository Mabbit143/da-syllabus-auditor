"""Read-only triage groups; never infer incident identity or independent origins."""
import hashlib
import json


def _normalized(value):
    return " ".join(value.split())


def _id(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:20]


def summarize(reports, reviews=()):
    latest = {}
    for review in sorted(reviews, key=lambda row: row["id"]):
        latest[(review["report_id"], review["finding_id"])] = review["status"]
    items = []
    for report in sorted(reports, key=lambda row: row["id"]):
        for finding in sorted(report["report"].get("findings", []), key=lambda row: row["id"]):
            key = (report["id"], finding["id"])
            if latest.get(key) == "dismissed":
                continue
            actions = [e for e in finding.get("evidence", []) if e.get("role") == "action" and e.get("quote", "").strip()]
            if not actions:
                continue
            items.append({"report_id": report["id"], "finding_id": finding["id"],
                          "claim": finding["claim"], "topic": finding.get("topic", ""),
                          "mechanism": finding.get("mechanism", ""), "status": finding["status"],
                          "owner_status": latest.get(key), "actions": actions})
    # Connected components collapse exact shared action passages, including copies
    # on other URLs. Different wording is deliberately not treated as a new event.
    parents = list(range(len(items)))

    def root(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    seen = {}
    for index, item in enumerate(items):
        for evidence in item["actions"]:
            fingerprint = _normalized(evidence["quote"])
            if fingerprint in seen:
                parents[root(index)] = root(seen[fingerprint])
            seen[fingerprint] = index
    components = {}
    for index, item in enumerate(items):
        components.setdefault(root(index), []).append(item)
    groups = []
    for members in components.values():
        passages = sorted({_normalized(e["quote"]) for m in members for e in m["actions"]})
        groups.append({"id": _id(passages), "members": members,
                       "status": "incident_identity_unverified"})
    groups.sort(key=lambda group: (group["members"][0]["report_id"], group["members"][0]["finding_id"]))
    mechanisms = {}
    for group in groups:
        for member in group["members"]:
            label = _normalized(member["mechanism"]).casefold()
            if label:
                candidate = mechanisms.setdefault(label, {"id": _id(label), "mechanism": member["mechanism"], "group_ids": [], "status": "incident_identity_unverified"})
                if group["id"] not in candidate["group_ids"]:
                    candidate["group_ids"].append(group["id"])
    return {"evidence_groups": groups,
            "mechanism_candidates": [mechanisms[key] for key in sorted(mechanisms) if len(mechanisms[key]["group_ids"]) > 1],
            "limitations": "Recent reports only. Shared exact action passages are grouped with whitespace normalization. Different passages may describe the same incident; matching mechanism labels are review candidates, not confirmed recurrence or independent support. Allegations and outcomes require source review. Owner dismissals within the loaded review history are excluded."}
