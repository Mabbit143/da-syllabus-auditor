"""Append-only owner assessments of specific source-passage relationships."""
SCHEMA = """
CREATE TABLE IF NOT EXISTS origin_reviews (
    id INTEGER PRIMARY KEY,
    source_synthesis_id INTEGER NOT NULL REFERENCES syntheses(id),
    left_id TEXT NOT NULL,
    right_id TEXT NOT NULL,
    relation TEXT NOT NULL CHECK(relation IN ('same_origin','different_origin','unresolved')),
    left_receipt TEXT NOT NULL,
    right_receipt TEXT NOT NULL,
    note TEXT NOT NULL,
    actor TEXT NOT NULL,
    created_at REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS origin_review_pair ON origin_reviews(left_id,right_id,id);
"""


def reviewed_rows(store, ids):
    ids = list(dict.fromkeys(ids))[:64]
    if not ids:
        return [], [], 0, 0
    placeholders = ",".join("?" for _ in ids)
    where = f"left_id IN ({placeholders}) AND right_id IN ({placeholders})"
    columns = "id,source_synthesis_id,left_id,right_id,relation,note,actor,created_at"
    latest = "id IN (SELECT max(id) FROM origin_reviews GROUP BY left_id,right_id) AND " + where
    with store._db() as db:
        history = [dict(row) for row in db.execute(f"SELECT {columns} FROM origin_reviews WHERE {where} ORDER BY id DESC LIMIT 200", ids + ids)]
        rows = [dict(row) for row in db.execute(f"SELECT {columns} FROM origin_reviews WHERE {latest} ORDER BY id DESC LIMIT 200", ids + ids)]
        total = db.execute(f"SELECT count(*) FROM origin_reviews WHERE {where}", ids + ids).fetchone()[0]
        pairs = db.execute(f"SELECT count(*) FROM origin_reviews WHERE {latest}", ids + ids).fetchone()[0]
    return rows, history, total, pairs
