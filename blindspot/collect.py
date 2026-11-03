"""Public document extraction and immutable snapshot ingestion."""
from html.parser import HTMLParser
from urllib.parse import urljoin

from .fetch import canonical_url, fetch_public


class DocumentHTML(HTMLParser):
    def __init__(self, url):
        super().__init__(convert_charrefs=True)
        self.url = url
        self.stack = []
        self.parts = []
        self.main = []
        self.title = []
        self.links = []
        self.published = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "meta" and attrs.get("property", attrs.get("name")) in ("article:published_time", "datePublished"):
            self.published = attrs.get("content")
        if tag not in {"meta", "link", "img", "br", "hr", "input", "source", "area", "base", "embed", "wbr", "param", "track", "col"}:
            self.stack.append(tag)
        if tag == "a" and attrs.get("href") and not self._ignored():
            try:
                link = canonical_url(urljoin(self.url, attrs["href"]))
                if link not in self.links:
                    self.links.append(link)
            except ValueError:
                pass  # Non-web links are not collection candidates.

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        self.handle_endtag(tag)

    def handle_endtag(self, tag):
        if tag in self.stack:
            self.stack = self.stack[:len(self.stack) - 1 - self.stack[::-1].index(tag)]

    def _ignored(self):
        return any(tag in {"script", "style", "noscript", "nav", "footer", "header", "svg", "form"} for tag in self.stack)

    def handle_data(self, data):
        text = " ".join(data.split())
        if not text:
            return
        if "title" in self.stack:
            self.title.append(text)
        elif not self._ignored() and "head" not in self.stack:
            self.parts.append(text)
            if "main" in self.stack or "article" in self.stack:
                self.main.append(text)


def extract_html(body, url):
    parser = DocumentHTML(url)
    parser.feed(body.decode("utf8", errors="replace"))
    text = "\n".join(parser.main or parser.parts)
    if not text.strip():
        raise ValueError("Could not read text from this public document")
    return {"text": text, "title": " ".join(parser.title), "published_at": parser.published, "links": parser.links, "method": "html", "coverage": "extracted HTML text; dynamic content not rendered"}


def collect(store, source, now, *, fetch=fetch_public):
    """Fetch actual document text; metadata does not claim publisher truth."""
    requested = canonical_url(source["url"])
    response = fetch(requested)
    url = canonical_url(response["url"])
    body = response["body"]
    mime = response["content_type"]
    if body.startswith(b"%PDF-"):
        from .pdf import extract_pdf
        extracted = extract_pdf(body)
        pages = extracted["pages"]
        if extracted.get("status") != "ready_for_review" or len(pages) != extracted.get("pageCount") or any(page.get("method") == "failed" for page in pages):
            raise ValueError("PDF extraction is incomplete; retry or review the document")
        if any(page.get("method") == "ocr" for page in pages):
            raise ValueError("Scanned PDF requires reviewed OCR before research ingestion")
        document = {"text": "\n\n".join(page["text"] for page in pages), "pages": [{"page": page["page"], "text": page["text"]} for page in pages], "title": "", "published_at": None, "links": [], "method": "pdf-text", "coverage": "all extracted pages"}
    elif body.startswith(b"PK\x03\x04"):
        from .office import extract_office
        document = extract_office(body)
    elif mime in ("text/html", "application/xhtml+xml"):
        document = extract_html(body, url)
    elif mime == "text/plain":
        document = {"text": body.decode("utf8"), "title": "", "published_at": None, "links": [], "method": "text", "coverage": "plain text"}
    else:
        raise ValueError("Source is not a supported HTML, text, PDF, DOCX or XLSX document")
    metadata = {key: value for key, value in source.items() if key != "url"}
    metadata.update({key: value for key, value in document.items() if key not in ("text", "links")})
    metadata.update(requested_url=requested, content_type=mime)
    version = store.snapshot(url, document["text"], metadata, now)
    return {"version_id": version, "url": url, "links": document["links"]}
