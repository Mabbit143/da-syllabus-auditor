"""OCR service for scanned syllabi, run on Modal. Page images in, plain text out; nothing is stored or logged."""
import base64
import hmac
import io
import os

import modal

app = modal.App("da-syllabus-ocr")

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("tesseract-ocr")
    .pip_install("pytesseract==0.3.13", "pillow==11.0.0", "fastapi[standard]==0.115.6")
)

MAX_IMAGES = 6
MAX_IMAGE_BYTES = 3_000_000


@app.function(image=image, secrets=[modal.Secret.from_name("da-ocr")], timeout=120, max_containers=4)
@modal.asgi_app()
def web():
    from fastapi import FastAPI, Header, HTTPException
    from PIL import Image
    import pytesseract

    api = FastAPI()

    @api.post("/")
    def ocr(body: dict, authorization: str = Header(default="")):
        expected = os.environ.get("OCR_TOKEN", "")
        if not expected or not hmac.compare_digest(authorization, f"Bearer {expected}"):
            raise HTTPException(status_code=401, detail="Unauthorized")
        images = body.get("images")
        if not isinstance(images, list) or not 0 < len(images) <= MAX_IMAGES:
            raise HTTPException(status_code=400, detail=f"Send 1 to {MAX_IMAGES} images.")
        pages = []
        for item in images:
            try:
                raw = base64.b64decode(item, validate=True)
                if len(raw) > MAX_IMAGE_BYTES:
                    raise ValueError("image too large")
                with Image.open(io.BytesIO(raw)) as img:
                    pages.append(pytesseract.image_to_string(img.convert("L"), lang="eng").strip())
            except Exception:
                raise HTTPException(status_code=400, detail="An image could not be read.")
        return {"pages": pages}

    return api
