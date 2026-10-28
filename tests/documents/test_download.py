import unittest
from unittest.mock import patch

from document_jobs.download import download_pdf, public_url, Limits

URL = "https://provost.uoregon.edu/policy.pdf"


class Response:
    def __init__(self, status=200, body=b"%PDF-synthetic", location=None):
        self.status, self.body, self.location = status, body, location

    def getheader(self, name, default=None):
        return self.location if name.lower() == "location" else default

    def read(self, size):
        chunk, self.body = self.body[:size], self.body[size:]
        return chunk


class DownloadTests(unittest.TestCase):
    def test_rejects_untrusted_urls(self):
        for url in ["http://provost.uoregon.edu/a", "https://uoregon.edu.evil/a", "https://user@uoregon.edu/a", "https://uoregon.edu:444/a", "https://127.0.0.1/a"]:
            with self.subTest(url=url), self.assertRaises(ValueError):
                public_url(url)

    def test_requires_manifest_and_public_dns(self):
        with self.assertRaises(ValueError):
            download_pdf(URL, set())
        with patch("document_jobs.download.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]):
            with self.assertRaises(ValueError):
                download_pdf(URL, {URL})

    def test_pins_vetted_address_and_caps_stream(self):
        used = []

        def connect(host, address, timeout):
            used.append((host, address))
            return Response(body=b"%PDF-" + b"x" * 100)

        with patch("document_jobs.download.public_addresses", return_value=["8.8.8.8"]):
            with self.assertRaises(ValueError):
                download_pdf(URL, {URL}, Limits(max_bytes=30), transport=connect)
        self.assertEqual(used, [("provost.uoregon.edu", "8.8.8.8")])

    def test_redirect_is_revalidated_and_access_denial_not_bypassed(self):
        with patch("document_jobs.download.public_addresses", return_value=["8.8.8.8"]):
            for response in [Response(302, location="https://127.0.0.1/internal"), Response(403)]:
                with self.assertRaises(ValueError):
                    download_pdf(URL, {URL}, transport=lambda *args: response)

    def test_limits_can_only_be_lowered(self):
        for kwargs in [dict(max_bytes=30_000_000), dict(max_pages=21), dict(dpi=300), dict(max_pixels=17_000_000), dict(timeout=301)]:
            with self.assertRaises(ValueError):
                Limits(**kwargs)

    def test_accepts_pdf_and_rejects_non_pdf(self):
        with patch("document_jobs.download.public_addresses", return_value=["8.8.8.8"]):
            self.assertEqual(download_pdf(URL, {URL}, transport=lambda *args: Response()), b"%PDF-synthetic")
            with self.assertRaises(ValueError):
                download_pdf(URL, {URL}, transport=lambda *args: Response(body=b"<html>not a pdf</html>"))


if __name__ == "__main__":
    unittest.main()
