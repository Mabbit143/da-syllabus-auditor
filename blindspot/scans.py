"""Stage scans for owner image review; never approve worker-generated text."""
import base64
import hashlib
import io
import json
import re

from .fetch import canonical_url
from .scan_render import render_page


def _hash(data):
    return hashlib.sha256(data).hexdigest()


def _directory(store, digest):
    if not isinstance(digest, str) or not re.fullmatch(r"[0-9a-f]{64}", digest):
        raise ValueError("Invalid saved scan hash")
    return store.path.resolve().parent / "scans" / digest


def _source(store, source_id):
    if type(source_id) is not int or source_id < 1:
        raise ValueError("Choose a valid saved scan")
    with store._db() as db:
        row = db.execute("SELECT * FROM scan_sources WHERE id=?", (source_id,)).fetchone()
    if row is None:
        raise ValueError("Saved scan does not exist")
    path = _directory(store, row["pdf_sha256"]) / "source.pdf"
    if not path.is_file() or path.stat().st_size > 20 * 1024 * 1024 or _hash(path.read_bytes()) != row["pdf_sha256"]:
        raise ValueError("Saved source PDF changed; no review can be admitted")
    return dict(row), path


def stage_scan(store, url, data, inspection, metadata, now):
    from .store import timestamp
    timestamp(now)
    url = canonical_url(url)
    count = inspection.get("pageCount")
    if not isinstance(data, bytes) or not data.startswith(b"%PDF-") or len(data) > 20 * 1024 * 1024 or type(count) is not int or not 1 <= count <= 500:
        raise ValueError("Invalid or excessive source scan")
    digest = _hash(data)
    directory = _directory(store, digest)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / "source.pdf"
    try:
        with path.open("xb") as output:
            output.write(data)
    except FileExistsError:
        if _hash(path.read_bytes()) != digest:
            raise ValueError("Existing saved scan differs from its hash") from None
    needs = [p["page"] for p in inspection.get("pages", []) if p.get("method") != "text"]
    with store._db() as db:
        db.execute("INSERT INTO scan_sources(url,pdf_sha256,page_count,needs_review_pages,metadata,first_seen,last_seen) VALUES (?,?,?,?,?,?,?) ON CONFLICT(url,pdf_sha256) DO UPDATE SET last_seen=max(last_seen,excluded.last_seen)", (url, digest, count, json.dumps(needs), json.dumps(metadata, ensure_ascii=False), now, now))
        return db.execute("SELECT id FROM scan_sources WHERE url=? AND pdf_sha256=?", (url, digest)).fetchone()["id"]


def scan_status(store):
    with store._db() as db:
        rows = db.execute("SELECT s.id,s.url,s.pdf_sha256,s.page_count,s.needs_review_pages,s.first_seen,s.last_seen,count(p.id) AS approved_passages FROM scan_sources s LEFT JOIN scan_passages p ON p.source_id=s.id GROUP BY s.id ORDER BY s.id DESC LIMIT 20").fetchall()
        total = db.execute("SELECT count(*) FROM scan_sources").fetchone()[0]
    return {"total_sources": total, "limit": 20, "sources": [dict(row, needs_review_pages=json.loads(row["needs_review_pages"])) for row in rows]}


def scan_preview(store, source_id, page, *, render=render_page):
    source, path = _source(store, source_id)
    if type(page) is not int or not 1 <= page <= source["page_count"]:
        raise ValueError("Choose a physical page in this scan")
    image_path = path.parent / f"page-{page}.png"
    with store._db() as db:
        prior = db.execute("SELECT * FROM scan_previews WHERE source_id=? AND page=?", (source_id, page)).fetchone()
    if prior:
        image, width, height = image_path.read_bytes(), prior["width"], prior["height"]
        if _hash(image) != prior["image_sha256"]:
            raise ValueError("Saved review image changed")
    else:
        image, width, height = render(path, page)
        if len(image) > 2 * 1024 * 1024 or type(width) is not int or type(height) is not int or not 0 < width * height <= 16000000:
            raise ValueError("Invalid or excessive review image")
        from PIL import Image
        with Image.open(io.BytesIO(image)) as decoded:
            if decoded.format != "PNG" or decoded.size != (width, height):
                raise ValueError("Review image dimensions did not verify")
            decoded.verify()
        try:
            with image_path.open("xb") as output:
                output.write(image)
        except FileExistsError:
            if image_path.read_bytes() != image:
                raise ValueError("Existing review image differs") from None
        with store._db() as db:
            db.execute("INSERT OR IGNORE INTO scan_previews(source_id,page,image_sha256,width,height) VALUES (?,?,?,?,?)", (source_id, page, _hash(image), width, height))
    with store._db() as db:
        receipts = [dict(row) for row in db.execute("SELECT id,page,quote,actor,reviewed_at FROM scan_passages WHERE source_id=? AND page=? ORDER BY reviewed_at,id", (source_id, page))]
    return {"scan_id": source_id, "url": source["url"], "pdf_sha256": source["pdf_sha256"], "page": page, "page_count": source["page_count"], "image_sha256": _hash(image), "width": width, "height": height, "image_data_url": "data:image/png;base64," + base64.b64encode(image).decode(), "receipts": receipts, "method": "owner-reviewed transcription; no automatic OCR approval"}


def admit_passage(store, request, *, now):
    from .store import snapshot_into, timestamp
    timestamp(now)
    source_id, page, quote, actor, region = (request.get(k) for k in ("scan_id", "page", "quote", "actor", "region"))
    if request.get("confirmed") is not True or not isinstance(actor, str) or not actor or len(actor) > 100 or not isinstance(quote, str) or not 40 <= len(quote.strip()) <= 500:
        raise ValueError("The owner must check the exact passage against the page image and confirm review")
    preview = scan_preview(store, source_id, page)
    if request.get("pdf_sha256") != preview["pdf_sha256"] or request.get("image_sha256") != preview["image_sha256"]:
        raise ValueError("Review hashes do not match the saved PDF and page image")
    if not isinstance(region, list) or len(region) != 4 or any(type(v) is not int or v < 0 for v in region) or not region[2] or not region[3] or region[0] + region[2] > preview["width"] or region[1] + region[3] > preview["height"]:
        raise ValueError("Review region must fit the saved image")
    quote = quote.strip()
    receipt_id = _hash(json.dumps([preview["url"], preview["pdf_sha256"], page, quote, region, actor], ensure_ascii=False).encode())
    with store._db() as db:
        if db.execute("SELECT count(*) FROM scan_passages WHERE source_id=?", (source_id,)).fetchone()[0] >= 500:
            raise ValueError("This source has reached its 500-passage review limit")
        db.execute("INSERT OR IGNORE INTO scan_passages(id,source_id,page,quote,region,pdf_sha256,image_sha256,actor,reviewed_at) VALUES (?,?,?,?,?,?,?,?,?)", (receipt_id, source_id, page, quote, json.dumps(region), preview["pdf_sha256"], preview["image_sha256"], actor, now))
        rows = db.execute("SELECT * FROM scan_passages WHERE source_id=? ORDER BY page,rowid", (source_id,)).fetchall()
        source = db.execute("SELECT * FROM scan_sources WHERE id=?", (source_id,)).fetchone()
        pages, ranges, parts, cursor = [], [], [], 0
        for number in sorted({r["page"] for r in rows}):
            fragments = list(dict.fromkeys(r["quote"] for r in rows if r["page"] == number))
            text = "\n\n".join(fragments)
            for fragment in fragments:
                ranges.append([cursor, cursor + len(fragment)])
                cursor += len(fragment) + 2
            parts.append(text)
            pages.append({"page": number, "text": text})
        metadata = dict(json.loads(source["metadata"]), method="reviewed-transcription", pages=pages, admitted_ranges=ranges, source_pdf_sha256=preview["pdf_sha256"], source_page_count=source["page_count"], review_receipts=[r["id"] for r in rows], coverage=f"Owner-reviewed passages only; partial source coverage across {len(pages)} of {source['page_count']} physical pages. Unreviewed text and gaps are not evidence. Transcription is owner-attested, not automatic OCR verification.")
        version = snapshot_into(db, source["url"], "\n\n".join(parts), metadata, now)
        db.execute("INSERT OR IGNORE INTO jobs(kind,key,payload,due,priority) VALUES ('analyze',?,?,?,10)", (str(version), json.dumps({"version_id": version, "url": source["url"]}), now))
    return {"saved": True, "receipt_id": receipt_id, "version_id": version}
