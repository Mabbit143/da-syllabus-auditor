"""Isolated, bounded native PDF text extraction for administrative packets."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile


def _extract_native(file):
    # Native parsing stays outside the collection process. Rendering/OCR remains
    # in document_jobs' reviewed workflow; this path never creates guessed text.
    if sys.platform != "win32":
        import resource
        resource.setrlimit(resource.RLIMIT_AS, (1024 ** 3, 1024 ** 3))
        resource.setrlimit(resource.RLIMIT_CPU, (50, 50))
    import pypdfium2 as pdfium
    pages = []
    characters = 0
    with pdfium.PdfDocument(file) as pdf:
        count = len(pdf)
        if not 1 <= count <= 500:
            raise ValueError("PDF exceeds the 500-page research limit")
        for number in range(count):
            page = pdf[number]
            try:
                textpage = page.get_textpage()
                try:
                    text = textpage.get_text_bounded()
                finally:
                    textpage.close()
            finally:
                page.close()
            characters += len(text)
            if len(text) > 100000 or characters > 2000000:
                raise ValueError("PDF text exceeds research extraction limits")
            method = "text" if len("".join(c for c in text if c.isalnum())) >= 20 else "needs_review"
            pages.append({"page": number + 1, "method": method, "text": text})
    return {"status": "ready_for_review", "pageCount": count, "pages": pages}


def extract_pdf(data):
    if not isinstance(data, bytes) or not data.startswith(b"%PDF-") or len(data) > 20 * 1024 * 1024:
        raise ValueError("Could not read PDF: invalid or excessive source data")
    with tempfile.TemporaryDirectory() as folder:
        source = Path(folder) / "source.pdf"
        source.write_bytes(data)
        try:
            process = subprocess.run([sys.executable, "-m", "blindspot.pdf", str(source)], capture_output=True, timeout=60, check=True)
            if len(process.stdout) > 12 * 1024 * 1024:
                raise ValueError("PDF extraction output exceeds research limits")
            result = json.loads(process.stdout)
        except (subprocess.SubprocessError, json.JSONDecodeError) as exc:
            raise ValueError("Could not read PDF within research limits; it may be corrupt, encrypted or too large") from exc
    if any(page["method"] != "text" for page in result["pages"]):
        raise ValueError("PDF has pages needing reviewed OCR or blank-page confirmation")
    return result


if __name__ == "__main__":
    try:
        print(json.dumps(_extract_native(sys.argv[1]), ensure_ascii=False))
    except Exception:
        print("PDF text extraction failed", file=sys.stderr)
        sys.exit(1)
