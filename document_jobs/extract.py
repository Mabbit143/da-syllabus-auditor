"""Text-first PDF extraction, isolated native rendering and bounded OCR."""
import base64
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from .download import Limits


def page_selection(selection, total, maximum):
    if not selection:
        if total > maximum:
            raise ValueError("Choose explicit page ranges for this larger PDF")
        return list(range(1, total + 1))
    selected = set()
    try:
        for group in selection.split(","):
            ends = [int(value) for value in group.strip().split("-")]
            if len(ends) not in (1, 2) or ends[0] < 1 or ends[-1] > total or ends[-1] < ends[0] or ends[-1] - ends[0] >= maximum:
                raise ValueError()
            selected.update(range(ends[0], ends[-1] + 1))
            if len(selected) > maximum:
                raise ValueError()
    except (ValueError, AttributeError):
        raise ValueError("Invalid or excessive page selection") from None
    return sorted(selected)


def checked_dimensions(width, height, limits):
    if not all(math.isfinite(v) and v > 0 for v in (width, height)):
        raise ValueError("Invalid page dimensions")
    pixels = (math.ceil(width * limits.dpi / 72), math.ceil(height * limits.dpi / 72))
    if pixels[0] * pixels[1] > limits.max_pixels:
        raise ValueError("Page exceeds rendered pixel limit")
    return pixels


def _native_budget():
    if sys.platform != "win32":
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (1024 ** 3, 1024 ** 3))
        resource.setrlimit(resource.RLIMIT_CPU, (45, 45))


def _inspect(file):
    _native_budget()
    import pypdfium2 as pdfium
    with pdfium.PdfDocument(file) as pdf:
        return len(pdf)


def _page(file, page_number, limits):
    _native_budget()
    import pypdfium2 as pdfium
    with pdfium.PdfDocument(file) as pdf:
        page = pdf[page_number - 1]
        try:
            checked_dimensions(*page.get_size(), limits)
            textpage = page.get_textpage()
            try:
                text = textpage.get_text_bounded()
            finally:
                textpage.close()
            bitmap = page.render(scale=limits.dpi / 72)
            try:
                image = bitmap.to_pil()
                png = io.BytesIO()
                image.save(png, format="PNG")
                png_bytes = png.getvalue()
                if len(png_bytes) > 2 * 1024 * 1024:
                    raise ValueError("Review page image exceeds the 2 MB evidence limit")
                words = []
                method = "text"
                if len("".join(c for c in text if c.isalnum())) < 20:
                    method = "ocr"
                    with tempfile.TemporaryDirectory() as directory:
                        source = Path(directory) / "page.png"
                        source.write_bytes(png_bytes)
                        result = subprocess.run(["tesseract", str(source), "stdout", "-l", "eng", "tsv"], capture_output=True, timeout=35, check=True)
                        lines = {}
                        for row in csv.DictReader(io.StringIO(result.stdout.decode("utf8")), delimiter="\t"):
                            if row["level"] != "5" or not row["text"].strip():
                                continue
                            words.append({"text": row["text"], "confidence": float(row["conf"]), "box": [int(row[k]) for k in ("left", "top", "width", "height")]})
                            key = (row["block_num"], row["par_num"], row["line_num"])
                            lines.setdefault(key, []).append(row["text"])
                        text = "\n".join(" ".join(line) for line in lines.values())
                if not text.strip():
                    raise ValueError("No readable text recovered")
                return {"page": page_number, "method": method, "text": text, "image": base64.b64encode(png_bytes).decode("ascii"), "words": words, "width": image.width, "height": image.height}
            finally:
                bitmap.close()
        finally:
            page.close()


def _child(mode, file, timeout, *args):
    # Source files and parser diagnostics never appear in process output/logs.
    result = subprocess.run([sys.executable, "-m", "document_jobs.extract", mode, str(file), *map(str, args)], capture_output=True, timeout=max(0.1, min(50, timeout)), check=True)
    if len(result.stdout) > 4 * 1024 * 1024:
        raise ValueError("Page result exceeds the evidence limit")
    return json.loads(result.stdout)


def process_document(pdf_bytes, url, total=None, selection=None, limits=None, *, page_runner=None, clock=time.monotonic):
    limits = limits or Limits()
    start = clock()
    if not isinstance(pdf_bytes, bytes) or not pdf_bytes.startswith(b"%PDF-") or len(pdf_bytes) > limits.max_bytes:
        raise ValueError("Invalid or excessive PDF data")
    pages = []
    with tempfile.TemporaryDirectory() as directory:
        file = Path(directory) / "source.pdf"
        file.write_bytes(pdf_bytes)
        if total is None:
            try:
                total = _child("_inspect", file, limits.timeout)
            except Exception:
                raise ValueError("Could not read PDF; it may be corrupt or encrypted") from None
        selected = page_selection(selection, total, limits.max_pages)
        used_bytes = 0
        for number in selected:
            remaining = limits.timeout - (clock() - start)
            try:
                if remaining <= 1:
                    raise ValueError("Document processing deadline reached")
                page = page_runner(number, remaining) if page_runner else _child("_page", file, remaining, number, json.dumps(limits.__dict__))
                used_bytes += len(json.dumps(page).encode("utf8"))
                if used_bytes > 16 * 1024 * 1024:
                    raise ValueError("Job review bundle exceeds the 16 MB result limit")
                pages.append(page)
            except Exception:
                pages.append({"page": number, "method": "failed", "text": "", "error": "Page could not be processed within document limits."})
    success = sum(page["method"] != "failed" for page in pages)
    return {"version": 1, "status": "ready_for_review" if success == len(pages) else "partial" if success else "failed", "sourceUrl": url, "sourcePdfSha256": hashlib.sha256(pdf_bytes).hexdigest(), "fetchedAt": datetime.now(timezone.utc).isoformat(), "pageCount": total, "pages": pages}


if __name__ == "__main__":
    try:
        if sys.argv[1] == "_inspect":
            result = _inspect(sys.argv[2])
        elif sys.argv[1] == "_page":
            result = _page(sys.argv[2], int(sys.argv[3]), Limits(**json.loads(sys.argv[4])))
        else:
            raise ValueError("Unknown extraction operation")
        print(json.dumps(result))
    except Exception:
        print("Document processing failed", file=sys.stderr)
        sys.exit(1)

