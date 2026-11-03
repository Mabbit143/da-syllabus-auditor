import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from blindspot.store import Store
from blindspot.scans import stage_scan, scan_preview, admit_passage, scan_status
from blindspot.evidence import verify_evidence
from blindspot.worker import run_once

QUOTE = "Applications may be submitted without paying a nonrefundable fee."
OTHER = "Appeals must be requested within thirty days of the decision."


class ScanTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = Store(Path(self.temp.name) / "research.sqlite")
        self.pdf = (Path(__file__).resolve().parents[2] / "e2e/fixtures/syllabus.pdf").read_bytes()
        self.source = stage_scan(self.store, "https://uoregon.edu/scan.pdf", self.pdf, {"pageCount": 1, "pages": [{"page": 1, "method": "needs_review", "text": ""}]}, {}, 10)

    def tearDown(self):
        self.temp.cleanup()

    def render(self, *args):
        from PIL import Image
        stream = io.BytesIO()
        Image.new("RGB", (100, 100), "white").save(stream, "PNG")
        return stream.getvalue(), 100, 100

    def preview(self):
        return scan_preview(self.store, self.source, 1, render=self.render)

    def approve(self, preview, quote=QUOTE, **changes):
        request = {"scan_id": self.source, "page": 1, "pdf_sha256": preview["pdf_sha256"], "image_sha256": preview["image_sha256"], "quote": quote, "region": [0, 0, 100, 100], "confirmed": True, "actor": "verified-owner"}
        return admit_passage(self.store, dict(request, **changes), now=20)

    def test_staging_is_idempotent_and_unreviewed_text_never_enters_analysis(self):
        self.assertEqual(stage_scan(self.store, "https://uoregon.edu/scan.pdf", self.pdf, {"pageCount": 1, "pages": [{"page": 1, "method": "needs_review", "text": ""}]}, {}, 11), self.source)
        self.assertEqual(self.store.status()["documents"], 0)
        self.assertEqual(scan_status(self.store)["sources"][0]["approved_passages"], 0)
        self.assertEqual(self.store.analyses(), [])

    def test_owner_confirmation_and_preview_hashes_are_required(self):
        preview = self.preview()
        for changes in [{"confirmed": False}, {"actor": ""}, {"image_sha256": "0" * 64}, {"pdf_sha256": "0" * 64}, {"region": [90, 90, 100, 100]}]:
            with self.assertRaises(ValueError):
                self.approve(preview, **changes)
        self.assertEqual(self.store.status()["documents"], 0)

    def test_admission_saves_only_reviewed_passages_and_rejects_cross_fragment_quote(self):
        preview = self.preview()
        admitted = self.approve(preview)
        self.assertEqual(self.approve(preview)["version_id"], admitted["version_id"])
        self.approve(preview, OTHER)
        version = self.store.history("https://uoregon.edu/scan.pdf")[-1]
        self.assertEqual(version["text"], QUOTE + "\n\n" + OTHER)
        self.assertEqual(len(version["metadata"]["admitted_ranges"]), 2)
        self.assertIn("partial", version["metadata"]["coverage"])
        self.assertIsNotNone(verify_evidence({"version_id": version["id"], "page": 1, "quote": QUOTE, "role": "action"}, [version]))
        crossed = QUOTE[-25:] + " " + OTHER[:25]
        self.assertIsNone(verify_evidence({"version_id": version["id"], "quote": crossed, "role": "action"}, [version]))
        self.assertEqual(scan_status(self.store)["sources"][0]["approved_passages"], 2)
        self.assertTrue(any(job["kind"] == "analyze" for job in self.store.status()["jobs"]))

    def test_changed_preview_image_invalidates_admission(self):
        preview = self.preview()
        image = self.store.path.parent / "scans" / preview["pdf_sha256"] / "page-1.png"
        image.write_bytes(image.read_bytes() + b"changed")
        with self.assertRaises(ValueError):
            self.approve(preview)

    def test_scan_collection_is_review_pending_not_repeated_failure_or_analysis(self):
        from blindspot.pdf import PDFReviewRequired
        self.store.enqueue("collect", "scan", {"url": "https://uoregon.edu/another.pdf"}, 10)
        inspection = {"pageCount": 1, "pages": [{"page": 1, "method": "needs_review", "text": ""}]}
        with patch("blindspot.worker.RobotsRules") as rules, patch("blindspot.worker.fetch_public", return_value={"url": "https://uoregon.edu/another.pdf", "body": self.pdf, "content_type": "application/pdf"}), patch("blindspot.pdf.extract_pdf", side_effect=PDFReviewRequired(inspection)):
            rules.return_value.check.return_value = 2
            result = run_once(self.store, 1, clock=lambda: 12)
        self.assertEqual(result["review_pending"], 1)
        self.assertEqual(result["failed"], 0)
        self.assertEqual(self.store.status()["documents"], 0)

    def test_native_rendered_preview_has_valid_png_without_ocr_approval(self):
        preview = scan_preview(self.store, self.source, 1)
        self.assertTrue(preview["image_data_url"].startswith("data:image/png;base64,"))
        self.assertGreater(preview["width"], 100)
        self.assertEqual(self.store.status()["documents"], 0)

    def test_failed_snapshot_rolls_back_owner_receipt_and_job_changes(self):
        preview = self.preview()
        self.approve(preview)
        self.store.snapshot("https://uoregon.edu/scan.pdf", "A later observed native source version.", {}, 30)
        with self.assertRaises(ValueError):
            self.approve(preview, OTHER)
        self.assertEqual(scan_status(self.store)["sources"][0]["approved_passages"], 1)

    def test_synthesis_revalidation_rejects_a_saved_cross_fragment_span(self):
        from blindspot.synthesis_input import build_input
        preview = self.preview()
        self.approve(preview)
        self.approve(preview, OTHER)
        version = self.store.history("https://uoregon.edu/scan.pdf")[-1]
        start, end = len(QUOTE) - 25, len(QUOTE) + 2 + 25
        item = {"version_id": version["id"], "url": version["url"], "content_hash": version["content_hash"], "quote": version["text"][start:end], "start": start, "end": end, "role": "action", "page": 1}
        self.store.enqueue("analyze", "forged-gap-fixture", {}, 10)
        job = self.store.claim(21, 60, kind="analyze")
        self.store.complete_analysis(job["id"], job["token"], 22, {"schema_version": 2, "findings": [{"id": "f1", "claim": "A claim spanning two fragments", "status": "review_lead", "evidence": [item]}]})
        context = build_input(self.store)
        self.assertEqual(context["leads"], [])
        self.assertEqual(context["coverage"]["invalid_evidence_leads"], 1)


if __name__ == "__main__":
    unittest.main()
