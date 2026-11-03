"""Source-location projection for the supplied or displayed text window only."""
import json


def source_locations(metadata, ranges):
    result = []
    eligible = [location for location in metadata.get("locations", []) if any(a < location["end"] and location["start"] < b for a, b in ranges)]
    for location in eligible:
        item = dict(location)
        if "cells" in item:
            cells = [cell for cell in item["cells"] if any(a < location["start"] + cell["end"] and location["start"] + cell["start"] < b for a, b in ranges)]
            item["cells"] = [dict(cell, formula=cell["formula"][:300], formula_truncated=True) if isinstance(cell.get("formula"), str) and len(cell["formula"]) > 300 else cell for cell in cells[:200]]
            item["omitted_cells"] = max(0, len(cells) - 200)
            while item["cells"] and len(json.dumps(result + [item])) > 6000:
                item["cells"].pop()
                item["omitted_cells"] += 1
        if len(json.dumps(result + [item])) > 6000:
            break
        result.append(item)
        if len(result) == 100:
            break
    return {"items": result, "limit": 100, "omitted_locations": len(eligible) - len(result), "note": "Locators intersect supplied text only; capped at 6,000 encoded characters, 100 locations and 200 cells per row. Long formula metadata is abbreviated. This does not reconstruct rendered layout."}
