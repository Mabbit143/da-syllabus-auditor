"""Private scan staging and append-only owner review receipts."""
SCHEMA = """
CREATE TABLE IF NOT EXISTS scan_sources (
    id INTEGER PRIMARY KEY, url TEXT NOT NULL, pdf_sha256 TEXT NOT NULL,
    page_count INTEGER NOT NULL, needs_review_pages TEXT NOT NULL,
    metadata TEXT NOT NULL, first_seen REAL NOT NULL, last_seen REAL NOT NULL,
    UNIQUE(url,pdf_sha256)
);
CREATE TABLE IF NOT EXISTS scan_previews (
    source_id INTEGER NOT NULL REFERENCES scan_sources(id), page INTEGER NOT NULL,
    image_sha256 TEXT NOT NULL, width INTEGER NOT NULL, height INTEGER NOT NULL,
    PRIMARY KEY(source_id,page)
);
CREATE TABLE IF NOT EXISTS scan_passages (
    id TEXT PRIMARY KEY, source_id INTEGER NOT NULL REFERENCES scan_sources(id),
    page INTEGER NOT NULL, quote TEXT NOT NULL, region TEXT NOT NULL,
    pdf_sha256 TEXT NOT NULL, image_sha256 TEXT NOT NULL,
    actor TEXT NOT NULL, reviewed_at REAL NOT NULL
);
"""
