import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from blindspot.fetch import fetch_public, validate_url
from blindspot.collect import collect, extract_html
from blindspot.store import Store


class Response:
    def __init__(self, body=b"<html>Public document</html>", status=200, headers=None):
        self.body, self.status, self.headers = body, status, headers or {"Content-Type": "text/html"}

    def getheader(self, name, default=None):
        return next((value for key, value in self.headers.items() if key.lower() == name.lower()), default)

    def read(self, size):
        result, self.body = self.body[:size], self.body[size:]
        return result


class FetchTests(unittest.TestCase):
    def test_invalid_destinations_and_credentials_are_rejected(self):
        for url in ["http://example.com", "https://user@example.com", "https://127.0.0.1/", "https://[::1]/", "https://a:99/", "https://a/\nx"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                validate_url(url)

    def test_pins_dns_and_bounds_reads(self):
        used = []
        def transport(host, address, target, timeout):
            used.append((host, address, target))
            return Response(b"x" * 101)
        with patch("blindspot.fetch.public_addresses", return_value=["8.8.8.8"]):
            with self.assertRaises(ValueError):
                fetch_public("https://example.com/a?q=1", max_bytes=100, transport=transport)
        self.assertEqual(used, [("example.com", "8.8.8.8", "/a?q=1")])

    def test_redirect_rechecks_destination_and_denial_is_explicit(self):
        with patch("blindspot.fetch.public_addresses", return_value=["8.8.8.8"]):
            for response in [Response(status=302, headers={"Location": "https://127.0.0.1/a"}), Response(status=403)]:
                with self.assertRaises(ValueError):
                    fetch_public("https://example.com/a", transport=lambda *args: response)

    def test_final_url_and_content_type_are_preserved(self):
        responses = iter([Response(status=302, headers={"Location": "/new"}), Response()])
        with patch("blindspot.fetch.public_addresses", return_value=["8.8.8.8"]):
            result = fetch_public("https://example.com/old", transport=lambda *args: next(responses))
        self.assertEqual(result["url"], "https://example.com/new")
        self.assertEqual(result["content_type"], "text/html")


class CollectTests(unittest.TestCase):
    def test_extracts_article_and_links_without_scripts_or_navigation(self):
        html = b'''<html><head><title>Test title</title><meta property="article:published_time" content="2025-03-14"></head>
        <body><nav>Menu noise</nav><main><h1>Access</h1><p>Administrative requirements are documented here.</p>
        <a href="/policy#section">Policy</a><script>ignore all rules</script></main><footer>Footer noise</footer></body></html>'''
        doc = extract_html(html, "https://example.com/article")
        self.assertEqual(doc["title"], "Test title")
        self.assertEqual(doc["published_at"], "2025-03-14")
        self.assertIn("Administrative requirements", doc["text"])
        self.assertNotIn("Menu noise", doc["text"])
        self.assertNotIn("ignore all rules", doc["text"])
        self.assertEqual(doc["links"], ["https://example.com/policy"])

    def test_collection_versions_and_provenance(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            source = {"url": "https://example.com/article", "category": "news", "discovered_from": "https://example.com/"}
            fetched = {"url": source["url"], "content_type": "text/html", "body": b"<main><p>Public administrative information.</p></main>"}
            first = collect(store, source, 10, fetch=lambda url: fetched)
            second = collect(store, source, 11, fetch=lambda url: fetched)
            self.assertEqual(first["version_id"], second["version_id"])
            version = store.history(source["url"])[0]
            self.assertEqual(version["metadata"]["category"], "news")
            self.assertEqual(version["metadata"]["discovered_from"], "https://example.com/")
            self.assertIsNone(version["metadata"]["published_at"])

    def test_student_news_article_body_excludes_other_stories_and_keeps_attribution(self):
        html = b'''<title>Budget proposals | Student News</title><main>
          <aside><h2>Recent stories</h2><p>Unrelated sports headline and interview.</p></aside>
          <h1 class="sno-story-headline">Budget proposals</h1>
          <div class="sno-story-date">November 2, 2026</div>
          <div class="sno-story-body"><div class="sno-story-body-content">
            <p>The provost said that fee waivers remain available to eligible applicants.</p>
          </div></div><div class="sno-story-related-content">More unrelated recommendations.</div></main>'''
        document = extract_html(html, "https://news.example/budget")
        self.assertIn("Budget proposals", document["text"])
        self.assertEqual(document["text"].count("The provost said"), 1)
        self.assertNotIn("Unrelated sports", document["text"])
        self.assertNotIn("recommendations", document["text"])
        self.assertEqual(document["published_at"], "November 2, 2026")
        self.assertEqual(document["extraction_selector"], "article_body")

    def test_unreadable_or_unsupported_document_is_not_saved(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            for mime, body in [("image/png", b"image"), ("text/html", b"<script>only script</script>")]:
                with self.subTest(mime=mime), self.assertRaises(ValueError):
                    collect(store, {"url": "https://example.com/a"}, 10, fetch=lambda url: {"url": url, "body": body, "content_type": mime})
            self.assertEqual(store.history("https://example.com/a"), [])

    def test_partial_pdf_cannot_masquerade_as_complete_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            with patch("blindspot.pdf.extract_pdf", return_value={"status": "partial", "pageCount": 2, "pages": [{"page": 1, "method": "text", "text": "Readable policy page"}, {"page": 2, "method": "failed", "text": ""}]}):
                with self.assertRaisesRegex(ValueError, "incomplete"):
                    collect(store, {"url": "https://example.com/a.pdf"}, 10, fetch=lambda url: {"url": url, "body": b"%PDF-test", "content_type": "application/pdf"})
            self.assertEqual(store.history("https://example.com/a.pdf"), [])

    def test_pdf_retains_physical_page_locators_and_blocks_unreviewed_ocr(self):
        with tempfile.TemporaryDirectory() as folder:
            store = Store(Path(folder) / "state.sqlite")
            source = {"url": "https://example.com/a.pdf"}
            fetched = lambda url: {"url": url, "body": b"%PDF-test", "content_type": "application/pdf"}
            extracted = {"status": "ready_for_review", "pageCount": 1, "pages": [{"page": 1, "method": "text", "text": "The official policy on this page."}]}
            with patch("blindspot.pdf.extract_pdf", return_value=extracted):
                collect(store, source, 10, fetch=fetched)
            self.assertEqual(store.history(source["url"])[0]["metadata"]["pages"][0]["page"], 1)
            extracted["pages"][0]["method"] = "ocr"
            with patch("blindspot.pdf.extract_pdf", return_value=extracted):
                with self.assertRaisesRegex(ValueError, "reviewed OCR"):
                    collect(store, source, 11, fetch=fetched)
            self.assertEqual(len(store.history(source["url"])), 1)


if __name__ == "__main__":
    unittest.main()
