"""Quoted unit names only; entity attribution still needs semantic review."""
import re


def checked_departments(value, evidence):
    if not isinstance(value, list) or len(value) > 8:
        return [], len(value) if isinstance(value, list) else 1
    checked, seen, rejected = [], set(), 0
    for item in value:
        if not isinstance(item, dict):
            rejected += 1
            continue
        name, index = item.get("name"), item.get("evidence_index")
        if not isinstance(name, str) or not 1 <= len(name) <= 200 or type(index) is not int or not 0 <= index < len(evidence):
            rejected += 1
            continue
        name = " ".join(name.split())
        quote = " ".join(evidence[index].get("quote", "").split())
        if not name or not re.search(r"(?<!\w)" + re.escape(name) + r"(?!\w)", quote):
            rejected += 1
            continue
        if name.casefold() not in seen:
            checked.append({"name": name, "evidence_index": index})
            seen.add(name.casefold())
    return checked, rejected
