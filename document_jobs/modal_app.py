"""Deploy once with Modal; invoke only via the authenticated owner CLI."""
from pathlib import Path
import time
import modal

from document_jobs.download import Limits, download_pdf
from document_jobs.extract import process_document as extract_document
from document_jobs.cli import manifest_urls

ROOT = Path(__file__).resolve().parents[1]
image = (modal.Image.debian_slim(python_version="3.12")
         .apt_install("tesseract-ocr", "tesseract-ocr-eng")
         .pip_install("pypdfium2==5.14.0", "Pillow==13.0.0")
         .add_local_python_source("document_jobs")
         .add_local_file(ROOT / "data/uo-policies/pdf/_index.json", "/root/uo-pdf-index.json"))
app = modal.App("da-public-policy-documents", image=image)


@app.function(cpu=1, memory=1024, timeout=300, max_containers=1, retries=0)
def process_document(job_id: str, source_url: str, page_selection: str | None, lower_limits: dict):
    started = time.monotonic()
    limits = Limits(**lower_limits)
    if not isinstance(job_id, str) or len(job_id) != 24 or any(c not in "0123456789abcdef" for c in job_id):
        raise ValueError("Invalid document job ID")
    allowlist = manifest_urls(Path("/root/uo-pdf-index.json"))
    try:
        data = download_pdf(source_url, allowlist, limits)
        remaining = int(limits.timeout - (time.monotonic() - started)) - 10
        if remaining <= 0:
            raise ValueError("Document download exhausted the job deadline")
        processing = Limits(**{**limits.__dict__, "timeout": remaining})
        result = extract_document(data, source_url, selection=page_selection, limits=processing)
        return {**result, "jobId": job_id}
    except Exception:
        # Cloud logs must not include provider/source-document contents.
        return {"version": 1, "jobId": job_id, "status": "failed", "sourceUrl": source_url, "pages": [], "error": "Public document processing failed within configured limits."}
