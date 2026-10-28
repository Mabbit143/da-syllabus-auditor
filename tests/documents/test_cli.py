import base64
import json
from pathlib import Path
import tempfile
import unittest
from document_jobs.cli import write_bundle, manifest_urls, job_key


class CliTests(unittest.TestCase):
    def test_manifest_reads_successes_and_recorded_scans(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "index.json"
            file.write_text(json.dumps({"done": [{"url": "https://provost.uoregon.edu/a.pdf"}], "failed": [{"url": "https://aec.uoregon.edu/b.pdf"}, {"url": "http://example.test/a"}]}))
            self.assertEqual(len(manifest_urls(file)), 2)

    def test_review_bundle_separate_images_and_no_overwrite(self):
        result = {"version": 1, "status": "ready_for_review", "sourceUrl": "https://provost.uoregon.edu/a.pdf", "sourcePdfSha256": "a" * 64, "pages": [{"page": 1, "method": "ocr", "text": "Policy text.", "image": base64.b64encode(b"synthetic image").decode(), "words": [], "width": 10, "height": 10}]}
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "job"
            write_bundle(target, result)
            self.assertTrue((target / "page-1.png").exists())
            self.assertIn("Policy text.", (target / "preview.md").read_text())
            with self.assertRaises(FileExistsError):
                write_bundle(target, result)

    def test_job_keys_dedupe_and_cannot_escape_output(self):
        self.assertEqual(job_key("https://provost.uoregon.edu/a.pdf", "1"), job_key("https://provost.uoregon.edu/a.pdf", "1"))
        self.assertNotEqual(job_key("https://provost.uoregon.edu/a.pdf", "1"), job_key("https://provost.uoregon.edu/a.pdf", "2"))
        with tempfile.TemporaryDirectory() as directory:
            with self.assertRaises(ValueError):
                write_bundle(Path(directory) / "job", {"pages": [{"page": "../escape", "image": ""} ]})
