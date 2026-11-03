"""Read-only native page rendering outside the web/collection process."""
import base64
import io
import json
import subprocess
import sys
from pathlib import Path


def render_page(path, page):
    try:
        child = subprocess.run([sys.executable, "-m", "blindspot.scan_render", str(path), str(page)], cwd=Path(__file__).resolve().parent.parent, capture_output=True, timeout=12, check=True)
        if len(child.stdout) > 3 * 1024 * 1024:
            raise ValueError("Page preview exceeds the review limit")
        result = json.loads(child.stdout)
        return base64.b64decode(result["png"], validate=True), result["width"], result["height"]
    except (subprocess.SubprocessError, OSError, ValueError, KeyError) as exc:
        raise ValueError("Could not render source page within review limits") from exc


if __name__ == "__main__":
    try:
        if sys.platform != "win32":
            import resource
            resource.setrlimit(resource.RLIMIT_AS, (512 * 1024 * 1024, 512 * 1024 * 1024))
            resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
        import pypdfium2 as pdfium
        with pdfium.PdfDocument(sys.argv[1]) as pdf:
            page = pdf[int(sys.argv[2]) - 1]
            try:
                width, height = page.get_size()
                if not 0 < width <= 3000 or not 0 < height <= 3000 or width * height * 4 > 16000000:
                    raise ValueError("Source page dimensions exceed review limits")
                bitmap = page.render(scale=2)
                try:
                    image = bitmap.to_pil()
                    buffer = io.BytesIO()
                    image.save(buffer, format="PNG")
                    if buffer.tell() > 2 * 1024 * 1024:
                        raise ValueError("Source image exceeds review limits")
                    print(json.dumps({"png": base64.b64encode(buffer.getvalue()).decode(), "width": image.width, "height": image.height}))
                finally:
                    bitmap.close()
            finally:
                page.close()
    except Exception:
        print("Source page rendering failed", file=sys.stderr)
        sys.exit(1)
